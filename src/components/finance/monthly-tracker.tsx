'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOMR, parseAmount } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { canViewFixedExpenses } from '@/lib/roles';
import { useFinanceClients, useClientInvoices, useExpenses } from '@/hooks/use-finance-data';
import type { User, ClientInvoice } from '@/types/database';

export function MonthlyTracker({ user }: { user: User }) {
  const { clients } = useFinanceClients();
  const { invoices, addInvoice, updateInvoice } = useClientInvoices();
  const { expenses } = useExpenses();
  const canFixed = canViewFixedExpenses(user.role);

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const monthKey = format(month, 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ client_id: '', label: '', amount: '' });
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function togglePaid(row: typeof data.rows[number]) {
    setBusyId(row.client.id);
    try {
      if (row.isVirtualRetainer) {
        await addInvoice({
          company_id: user.company_id, client_id: row.client.id, month: monthKey, label: 'Retainer',
          amount: row.client.monthly_amount, paid_status: 'paid', paid_amount: row.client.monthly_amount, paid_date: today, created_by: user.id,
        });
      } else {
        const markPaid = !row.allPaid;
        await Promise.all(row.invs.map((i: ClientInvoice) =>
          updateInvoice(i.id, { paid_status: markPaid ? 'paid' : 'unpaid', paid_amount: markPaid ? i.amount : 0, paid_date: markPaid ? today : null })
        ));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

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
            <p className={cn('stat-numeral mt-1.5 text-xl', t.tone ?? 'text-text')}>{t.value}</p>
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
            <div key={r.client.id} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap', i !== data.rows.length - 1 && 'border-b border-border')}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-medium text-text">{r.client.name}</span>
                <Badge variant={r.client.type === 'retainer' ? 'accent' : 'info'}>{r.client.type}</Badge>
              </div>
              <span className="w-28 text-right text-[13px] tabular-nums text-text sm:w-28">{formatOMR(r.revenue)}</span>
              <span className="w-28 text-right text-[13px] tabular-nums text-muted">{formatOMR(r.op)}</span>
              <span className={cn('w-28 text-right text-[13px] font-semibold tabular-nums', r.profit >= 0 ? 'text-text' : 'text-red')}>{formatOMR(r.profit)}</span>
              <div className="w-24 text-center">
                <button
                  onClick={() => togglePaid(r)}
                  disabled={busyId === r.client.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50',
                    r.allPaid ? 'border-green/30 text-green' : 'border-border text-muted hover:border-accent hover:text-accent'
                  )}
                >
                  {r.allPaid ? <><CheckIcon className="h-3 w-3" /> Paid</> : 'Unpaid'}
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

      {/* Add revenue dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-xl">
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
