'use client';

import { useState, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { PlusIcon, TrashIcon, LockClosedIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOMR, parseAmount } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { canViewFixedExpenses, canManageFinance } from '@/lib/roles';
import { useExpenses, useClientNames, uploadExpenseInvoice, getInvoiceUrl } from '@/hooks/use-finance-data';
import { RecurringExpenses } from '@/components/finance/recurring-expenses';
import type { User, ExpenseType, ExpenseScope } from '@/types/database';

const OPERATIONAL_CATEGORIES = ['Models', 'Editor', 'Space Rental', 'Equipment', 'Travel', 'Other'];
const FIXED_CATEGORIES = ['Salaries', 'Rent', 'Utilities', 'Subscriptions', 'Insurance', 'Other'];

const SCOPES: { value: ExpenseScope; label: string; hint: string }[] = [
  { value: 'general', label: 'General Portfolio', hint: 'Day-to-day spend not tied to one client' },
  { value: 'client_based', label: 'Client Expense', hint: 'Spend for a specific client — pick the client below' },
  { value: 'asset_purchase', label: 'Asset Purchase', hint: 'Equipment or other assets the business keeps' },
];

export function ExpenseEntry({ user }: { user: User }) {
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const { clientNames } = useClientNames(); // names-only view — readable by all roles
  const canFixed = canViewFixedExpenses(user.role);

  const [type, setType] = useState<ExpenseType>('operational');
  const [scope, setScope] = useState<ExpenseScope>('general');
  const [category, setCategory] = useState('Models');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'operational' | 'fixed'>('all');

  const categories = type === 'fixed' ? FIXED_CATEGORIES : OPERATIONAL_CATEGORIES;

  const visible = useMemo(() => {
    if (filter === 'all') return expenses;
    return expenses.filter((e) => e.type === filter);
  }, [expenses, filter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseAmount(amount);
    const effectiveScope: ExpenseScope = type === 'operational' ? scope : 'general';
    if (!category.trim()) { toast.error('Pick a category'); return; }
    if (amt <= 0) { toast.error('Enter an amount'); return; }
    if (effectiveScope === 'client_based' && !clientId) { toast.error('Pick the client this expense is for'); return; }
    setSaving(true);
    try {
      let invoice: { path: string; name: string } | null = null;
      if (invoiceFile) {
        invoice = await uploadExpenseInvoice(invoiceFile, user.company_id);
      }
      await addExpense({
        company_id: user.company_id,
        type,
        scope: effectiveScope,
        category: category.trim(),
        description: description.trim() || null,
        amount: amt,
        expense_date: date,
        client_id: effectiveScope === 'client_based' && clientId ? clientId : null,
        invoice_path: invoice?.path ?? null,
        invoice_name: invoice?.name ?? null,
        created_by: user.id,
      });
      toast.success('Expense added');
      setAmount('');
      setDescription('');
      setClientId('');
      setInvoiceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(path: string) {
    try {
      const url = await getInvoiceUrl(path);
      window.open(url, '_blank', 'noopener');
    } catch {
      toast.error('Could not open invoice');
    }
  }

  return (
    <div className="space-y-6">
      {canManageFinance(user.role) && <RecurringExpenses user={user} />}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* ── Entry form ── */}
      <div className="rounded-card border border-border bg-card p-5 lg:sticky lg:top-20 lg:self-start">
        <h3 className="font-display text-lg font-semibold tracking-tight text-text">Log an Expense</h3>
        <p className="mb-4 text-[13px] text-muted">Amounts in OMR.</p>
        <form onSubmit={handleAdd} className="space-y-4">
          {canFixed && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['operational', 'fixed'] as ExpenseType[]).map((t) => (
                  <button key={t} type="button"
                    onClick={() => { setType(t); setCategory(t === 'fixed' ? FIXED_CATEGORIES[0] : OPERATIONAL_CATEGORIES[0]); }}
                    className={cn('rounded-lg border px-3 py-2 text-[13px] font-semibold capitalize transition-colors', type === t ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={cn('rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors', category === c ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                  {c}
                </button>
              ))}
            </div>
            {category === 'Other' && (
              <input value={category === 'Other' ? '' : category} onChange={(e) => setCategory(e.target.value || 'Other')} placeholder="Custom category" className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.000" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            </div>
          </div>

          {type === 'operational' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Expense Categorization</label>
              <div className="space-y-2">
                {SCOPES.map((s) => (
                  <button key={s.value} type="button"
                    onClick={() => { setScope(s.value); if (s.value !== 'client_based') setClientId(''); }}
                    className={cn('block w-full rounded-lg border px-3 py-2.5 text-left transition-colors', scope === s.value ? 'border-accent bg-accent-muted' : 'border-border hover:border-border-hover')}>
                    <span className={cn('block text-[13px] font-semibold', scope === s.value ? 'text-accent' : 'text-text')}>{s.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'operational' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Client</label>
              {clientNames.filter((c) => c.status === 'active').length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[13px] text-muted">No active clients yet — add one in the Clients tab first.</p>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClientId(v);
                    // Picking a client makes it a client expense; clearing it falls back to general.
                    if (v) setScope('client_based');
                    else if (scope === 'client_based') setScope('general');
                  }}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
                >
                  <option value="">— No specific client —</option>
                  {clientNames.filter((c) => c.status === 'active').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {scope === 'client_based' && !clientId && (
                <p className="mt-1 text-[11px] font-medium text-yellow">Pick which client this expense is for.</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Note (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Invoice (optional)</label>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 10 * 1024 * 1024) { toast.error('Invoice must be under 10 MB'); e.target.value = ''; return; }
                setInvoiceFile(f);
              }} />
            {invoiceFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
                <PaperClipIcon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text">{invoiceFile.name}</span>
                <button type="button" onClick={() => { setInvoiceFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="rounded-md p-1 text-muted hover:bg-red-bg hover:text-red" title="Remove file">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:border-border-hover hover:text-text">
                <PaperClipIcon className="h-4 w-4" /> Attach invoice (PDF or photo)
              </button>
            )}
          </div>

          <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-[0.99] disabled:opacity-50">
            <PlusIcon className="h-4 w-4" /> {saving ? 'Adding…' : 'Add Expense'}
          </button>
        </form>
      </div>

      {/* ── List ── */}
      <div>
        <div className="mb-3 flex items-center gap-1 border-b border-border">
          {(canFixed ? (['all', 'operational', 'fixed'] as const) : (['all', 'operational'] as const)).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('relative px-3 py-2 text-[13px] font-semibold capitalize transition-colors', filter === f ? 'text-accent' : 'text-muted hover:text-text')}>
              {f}
              {filter === f && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
          {!canFixed && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-faint"><LockClosedIcon className="h-3 w-3" /> Fixed expenses hidden</span>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No expenses yet" description="Logged expenses will appear here." />
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-card">
            {visible.map((ex, i) => {
              const canDelete = canManageFinance(user.role) || (ex.type === 'operational' && ex.created_by === user.id);
              return (
                <div key={ex.id} className={cn('flex items-center gap-3 px-4 py-3', i !== visible.length - 1 && 'border-b border-border')}>
                  <Badge variant={ex.type === 'fixed' ? 'warning' : 'default'}>{ex.type === 'fixed' ? 'Fixed' : 'Op'}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      {ex.category}
                      {ex.client && <span className="text-muted"> · {ex.client.name}</span>}
                      {ex.scope === 'asset_purchase' && <span className="text-muted"> · Asset</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {ex.description ? `${ex.description} · ` : ''}{format(parseISO(ex.expense_date), 'MMM d, yyyy')}
                      {ex.creator && ` · ${ex.creator.full_name}`}
                    </p>
                  </div>
                  {ex.invoice_path && (
                    <button onClick={() => openInvoice(ex.invoice_path!)} title={ex.invoice_name ? `Invoice: ${ex.invoice_name}` : 'View invoice'}
                      className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-accent">
                      <PaperClipIcon className="h-4 w-4" />
                    </button>
                  )}
                  <span className="stat-numeral shrink-0 text-base text-text">{formatOMR(ex.amount)}</span>
                  {canDelete && (
                    <button onClick={() => deleteExpense(ex.id).then(() => toast.success('Deleted')).catch(() => toast.error('Failed'))} className="rounded-lg p-1.5 text-muted hover:bg-red-bg hover:text-red" title="Delete">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
