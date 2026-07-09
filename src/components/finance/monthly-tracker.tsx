'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOMR, parseAmount } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { canViewFixedExpenses } from '@/lib/roles';
import { useFinanceClients, useClientInvoices, useExpenses, useInvoicePayments } from '@/hooks/use-finance-data';
import type { User, ClientInvoice, FinanceClient, InvoicePayment } from '@/types/database';

interface TrackerRow {
  client: FinanceClient;
  invs: ClientInvoice[];
  isVirtualRetainer: boolean;
  revenue: number;
  collected: number;
  allPaid: boolean;
  op: number;
  profit: number;
}

export function MonthlyTracker({ user }: { user: User }) {
  const { clients } = useFinanceClients();
  const { invoices, addInvoice, updateInvoice } = useClientInvoices();
  const { payments, addPayment, deletePayment, deletePaymentsForInvoices } = useInvoicePayments();
  const { expenses } = useExpenses();
  const canFixed = canViewFixedExpenses(user.role);

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const monthKey = format(month, 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ client_id: '', label: '', amount: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payClientId, setPayClientId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today);

  const data = useMemo(() => {
    const monthInvoices = invoices.filter((i) => isSameMonth(parseISO(i.month), month));
    const opByClient = new Map<string, number>();
    let unattributedOp = 0;
    expenses
      .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), month))
      .forEach((e) => {
        if (e.client_id) opByClient.set(e.client_id, (opByClient.get(e.client_id) ?? 0) + e.amount);
        else unattributedOp += e.amount;
      });

    const ids = new Set<string>();
    clients.filter((c) => c.status === 'active' && c.type === 'retainer').forEach((c) => ids.add(c.id));
    monthInvoices.forEach((i) => ids.add(i.client_id));

    const rows = Array.from(ids).map((id) => {
      const client = clients.find((c) => c.id === id)!;
      const invs = monthInvoices.filter((i) => i.client_id === id);
      const isVirtualRetainer = invs.length === 0 && client?.type === 'retainer';
      const revenue = invs.length ? invs.reduce((s, i) => s + i.amount, 0) : client?.monthly_amount ?? 0;
      const collected = invs.reduce((s, i) => s + i.paid_amount, 0);
      const allPaid = invs.length > 0 && invs.every((i) => i.paid_status === 'paid');
      const op = opByClient.get(id) ?? 0;
      return { client, invs, isVirtualRetainer, revenue, collected, allPaid, op, profit: revenue - op };
    }).filter((r) => r.client).sort((a, b) => b.revenue - a.revenue);

    const expected = rows.reduce((s, r) => s + r.revenue, 0);
    const collected = rows.reduce((s, r) => s + r.collected, 0);
    const operational = Array.from(opByClient.values()).reduce((s, v) => s + v, 0) + unattributedOp;
    const fixed = canFixed
      ? expenses.filter((e) => e.type === 'fixed' && isSameMonth(parseISO(e.expense_date), month)).reduce((s, e) => s + e.amount, 0)
      : 0;

    return { rows, expected, collected, outstanding: expected - collected, operational, fixed, unattributedOp, net: expected - operational - fixed };
  }, [clients, invoices, expenses, month, canFixed]);

  // Payments belonging to a row's invoices, newest first (hook orders by paid_on desc).
  function rowPayments(row: TrackerRow): InvoicePayment[] {
    const ids = new Set(row.invs.map((i) => i.id));
    return payments.filter((p) => ids.has(p.invoice_id));
  }

  function openPayment(row: TrackerRow) {
    setPayClientId(row.client.id);
    setPayAmount('');
    setPayDate(today);
  }

  // Records a dated payment (full or partial) for the row's month. The amount
  // is capped at the balance due and distributed across the month's invoices;
  // each allocation is written to the invoice_payments ledger.
  async function recordPayment(row: TrackerRow, received: number, paidOn: string) {
    const balance = Math.max(0, row.revenue - row.collected);
    const capped = Math.min(received, balance);
    if (capped <= 0) { toast.error('Enter a payment amount'); return; }
    if (!paidOn) { toast.error('Pick the payment date'); return; }
    setBusyId(row.client.id);
    try {
      if (row.isVirtualRetainer) {
        const amt = row.client.monthly_amount;
        const inv = await addInvoice({
          company_id: user.company_id, client_id: row.client.id, month: monthKey, label: 'Retainer',
          amount: amt, paid_status: capped >= amt ? 'paid' : 'partial', paid_amount: capped, paid_date: paidOn, created_by: user.id,
        });
        await addPayment({ company_id: user.company_id, invoice_id: inv.id, amount: capped, paid_on: paidOn, created_by: user.id });
      } else {
        let remaining = capped;
        for (const inv of row.invs) {
          if (remaining <= 0) break;
          const capacity = inv.amount - inv.paid_amount;
          if (capacity <= 0) continue;
          const add = Math.min(capacity, remaining);
          remaining -= add;
          const newPaid = inv.paid_amount + add;
          await updateInvoice(inv.id, {
            paid_amount: newPaid,
            paid_status: newPaid >= inv.amount ? 'paid' : 'partial',
            paid_date: paidOn,
          });
          await addPayment({ company_id: user.company_id, invoice_id: inv.id, amount: add, paid_on: paidOn, created_by: user.id });
        }
      }
      toast.success(`Recorded ${formatOMR(capped)}${capped >= balance ? ' — paid in full' : ' — partial payment'}`);
      setPayClientId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  // Deletes one payment from the ledger and rolls its amount back off the invoice.
  async function removePayment(row: TrackerRow, p: InvoicePayment) {
    setBusyId(row.client.id);
    try {
      await deletePayment(p.id);
      const inv = row.invs.find((i) => i.id === p.invoice_id);
      if (inv) {
        const newPaid = Math.max(0, inv.paid_amount - p.amount);
        await updateInvoice(inv.id, {
          paid_amount: newPaid,
          paid_status: newPaid <= 0 ? 'unpaid' : newPaid >= inv.amount ? 'paid' : 'partial',
          paid_date: newPaid <= 0 ? null : inv.paid_date,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function resetUnpaid(row: TrackerRow) {
    setBusyId(row.client.id);
    try {
      await deletePaymentsForInvoices(row.invs.map((i) => i.id));
      await Promise.all(row.invs.map((i: ClientInvoice) =>
        updateInvoice(i.id, { paid_status: 'unpaid', paid_amount: 0, paid_date: null })
      ));
      setPayClientId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  // Live row for the payment dialog — re-derived after each mutation so the
  // history and balance stay current while the dialog is open.
  const payRow = payClientId ? data.rows.find((r) => r.client.id === payClientId) ?? null : null;

  async function handleAddRevenue(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseAmount(addForm.amount);
    if (!addForm.client_id) { toast.error('Pick a client'); return; }
    if (amt <= 0) { toast.error('Enter an amount'); return; }
    try {
      await addInvoice({
        company_id: user.company_id, client_id: addForm.client_id, month: monthKey,
        label: addForm.label.trim() || null, amount: amt, paid_status: 'unpaid', paid_amount: 0, created_by: user.id,
      });
      toast.success('Revenue added');
      setAddOpen(false);
      setAddForm({ client_id: '', label: '', amount: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const totals = [
    { label: 'Expected', value: formatOMR(data.expected) },
    { label: 'Collected', value: formatOMR(data.collected), tone: 'text-green' },
    { label: 'Outstanding', value: formatOMR(data.outstanding), tone: data.outstanding > 0 ? 'text-red' : 'text-text' },
    { label: 'Operational', value: formatOMR(data.operational) },
    ...(canFixed ? [{ label: 'Net Profit', value: formatOMR(data.net), tone: data.net >= 0 ? 'text-green' : 'text-red' }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(subMonths(month, 1))} className="rounded-lg border border-border p-1.5 text-muted hover:bg-bg hover:text-text"><ChevronLeftIcon className="h-4 w-4" /></button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-lg border border-border p-1.5 text-muted hover:bg-bg hover:text-text"><ChevronRightIcon className="h-4 w-4" /></button>
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">{format(month, 'MMMM yyyy')}</h2>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary-light active:scale-95">
          <PlusIcon className="h-4 w-4" /> Add Revenue
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-5">
        {totals.map((t) => (
          <div key={t.label} className="bg-card p-4">
            <p className="eyebrow truncate">{t.label}</p>
            <p className={cn('stat-numeral mt-1.5 break-all text-lg sm:text-xl', t.tone ?? 'text-text')}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* Client table */}
      {data.rows.length === 0 ? (
        <div className="rounded-card border border-border bg-card px-5 py-12 text-center text-[13px] text-muted">
          No active clients or revenue for {format(month, 'MMMM yyyy')}. Add retainer clients, or use “Add Revenue” for campaigns.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted sm:flex">
            <span className="flex-1">Client</span>
            <span className="w-28 text-right">Revenue</span>
            <span className="w-28 text-right">Op. Expense</span>
            <span className="w-28 text-right">Profit</span>
            <span className="w-24 text-center">Status</span>
          </div>
          {data.rows.map((r, i) => (
            <div key={r.client.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap', i !== data.rows.length - 1 && 'border-b border-border')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{r.client.name}</span>
                  <Badge variant={r.client.type === 'retainer' ? 'accent' : 'info'}>{r.client.type}</Badge>
                </div>
                {(() => {
                  const last = rowPayments(r)[0];
                  return last ? (
                    <p className="mt-0.5 text-[11px] text-faint">Last payment {format(parseISO(last.paid_on), 'MMM d, yyyy')} · {formatOMR(last.amount)}</p>
                  ) : null;
                })()}
              </div>
              {/* On phones the metrics get their own labelled row; ≥sm the wrapper
                  dissolves (contents) and they sit inline like table columns. */}
              <div className="order-last grid w-full grid-cols-3 gap-2 sm:order-none sm:contents">
                <div className="min-w-0 sm:w-28 sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint sm:hidden">Revenue</p>
                  <p className="text-[13px] tabular-nums text-text">{formatOMR(r.revenue)}</p>
                </div>
                <div className="min-w-0 sm:w-28 sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint sm:hidden">Op. Exp.</p>
                  <p className="text-[13px] tabular-nums text-muted">{formatOMR(r.op)}</p>
                </div>
                <div className="min-w-0 sm:w-28 sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint sm:hidden">Profit</p>
                  <p className={cn('text-[13px] font-semibold tabular-nums', r.profit >= 0 ? 'text-text' : 'text-red')}>{formatOMR(r.profit)}</p>
                </div>
              </div>
              <div className="w-24 text-center">
                <button
                  onClick={() => openPayment(r)}
                  disabled={busyId === r.client.id}
                  title={r.collected > 0 && !r.allPaid ? `${formatOMR(r.collected)} of ${formatOMR(r.revenue)} collected` : undefined}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50',
                    r.allPaid
                      ? 'border-green/30 text-green'
                      : r.collected > 0
                        ? 'border-yellow/40 text-yellow hover:border-accent hover:text-accent'
                        : 'border-border text-muted hover:border-accent hover:text-accent'
                  )}
                >
                  {r.allPaid ? <><CheckIcon className="h-3 w-3" /> Paid</> : r.collected > 0 ? 'Partial' : 'Unpaid'}
                </button>
              </div>
            </div>
          ))}
          {data.unattributedOp > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-bg/50 px-4 py-2.5 text-[13px]">
              <span className="text-muted">Unattributed operational expenses</span>
              <span className="tabular-nums text-muted">{formatOMR(data.unattributedOp)}</span>
            </div>
          )}
        </div>
      )}

      {/* Record payment dialog — dated advances / partial payments with history */}
      <Dialog open={!!payRow} onClose={() => setPayClientId(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[85dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-card border border-border bg-card p-5 shadow-xl sm:p-6">
            {payRow && (() => {
              const balance = Math.max(0, payRow.revenue - payRow.collected);
              const history = rowPayments(payRow);
              return (
                <>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">Record Payment</DialogTitle>
                    <button onClick={() => setPayClientId(null)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"><XMarkIcon className="h-5 w-5" /></button>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{payRow.client.name} · {format(month, 'MMMM yyyy')}</p>

                  <div className="mt-4 space-y-2 rounded-lg border border-border bg-bg/50 p-3 text-[13px]">
                    <div className="flex justify-between"><span className="text-muted">Expected</span><span className="tabular-nums text-text">{formatOMR(payRow.revenue)}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Collected so far</span><span className="tabular-nums text-green">{formatOMR(payRow.collected)}</span></div>
                    <div className="flex justify-between font-semibold"><span className="text-muted">Balance due</span><span className={cn('tabular-nums', balance > 0 ? 'text-red' : 'text-green')}>{formatOMR(balance)}</span></div>
                  </div>

                  {/* Revenue entries with the date they were added */}
                  {payRow.invs.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Revenue Entries</p>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {payRow.invs.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                            <div className="min-w-0">
                              <p className="truncate text-text">{inv.label || 'Invoice'}</p>
                              <p className="text-[11px] text-faint">Added {format(parseISO(inv.created_at), 'MMM d, yyyy')}</p>
                            </div>
                            <span className="shrink-0 tabular-nums text-text">{formatOMR(inv.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dated payment history */}
                  {history.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Payments Received</p>
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {history.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                            <span className="text-muted">{format(parseISO(p.paid_on), 'MMM d, yyyy')}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="tabular-nums font-medium text-green">{formatOMR(p.amount)}</span>
                              <button type="button" onClick={() => removePayment(payRow, p)} disabled={busyId === payRow.client.id}
                                className="rounded-md p-1 text-muted hover:bg-red-bg hover:text-red disabled:opacity-50" title="Delete payment">
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {balance > 0 ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); recordPayment(payRow, parseAmount(payAmount), payDate); }}
                      className="mt-4 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Amount (OMR)</label>
                          <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0.000"
                            className="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Payment Date</label>
                          <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                            className="w-full min-w-0 appearance-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => setPayAmount(String(balance))}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted hover:border-accent hover:text-accent">
                          Full balance · {formatOMR(balance)}
                        </button>
                        <p className="text-[11px] text-faint">Partial amounts are fine.</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {payRow.collected > 0 && !payRow.isVirtualRetainer ? (
                          <button type="button" onClick={() => resetUnpaid(payRow)} disabled={busyId === payRow.client.id}
                            className="text-xs font-semibold text-red hover:underline disabled:opacity-50">
                            Reset to unpaid
                          </button>
                        ) : <span />}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setPayClientId(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
                          <button type="submit" disabled={busyId === payRow.client.id}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50">
                            {busyId === payRow.client.id ? 'Saving…' : 'Record'}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[13px] text-green"><CheckIcon className="h-4 w-4" /> Paid in full</p>
                      <button type="button" onClick={() => resetUnpaid(payRow)} disabled={busyId === payRow.client.id}
                        className="text-xs font-semibold text-red hover:underline disabled:opacity-50">
                        Reset to unpaid
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </DialogPanel>
        </div>
      </Dialog>

      {/* Add revenue dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[85dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-card border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">Add Revenue · {format(month, 'MMM yyyy')}</DialogTitle>
              <button onClick={() => setAddOpen(false)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAddRevenue} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Client</label>
                <select value={addForm.client_id} onChange={(e) => setAddForm({ ...addForm, client_id: e.target.value })} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none">
                  <option value="">Select client…</option>
                  {clients.filter((c) => c.status === 'active').map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Label (optional)</label>
                <input value={addForm.label} onChange={(e) => setAddForm({ ...addForm, label: e.target.value })} placeholder="e.g. Instagram campaign — 5 reels" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Amount (OMR)</label>
                <input value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} inputMode="decimal" placeholder="0.000" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light">Add</button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
