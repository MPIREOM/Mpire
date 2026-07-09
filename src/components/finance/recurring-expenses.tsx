'use client';

import { useState, useMemo } from 'react';
import { format, startOfMonth, isSameMonth, parseISO } from 'date-fns';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PlusIcon, XMarkIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOMR, parseAmount } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { useRecurringExpenses, useExpenses } from '@/hooks/use-finance-data';
import type { User, RecurringExpense, ExpenseType } from '@/types/database';

const FIXED_CATEGORIES = ['Salaries', 'Rent', 'Utilities', 'Subscriptions', 'Insurance', 'Other'];
const OPERATIONAL_CATEGORIES = ['Models', 'Editor', 'Space Rental', 'Equipment', 'Other'];

export function RecurringExpenses({ user }: { user: User }) {
  const { recurring, addRecurring, updateRecurring, deleteRecurring, generateForMonth } = useRecurringExpenses();
  const { expenses, mutate: mutateExpenses } = useExpenses();

  const monthDate = startOfMonth(new Date());
  const monthFirst = format(monthDate, 'yyyy-MM-dd');
  const monthLabel = format(monthDate, 'MMMM');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [form, setForm] = useState<{ type: ExpenseType; category: string; description: string; amount: string }>({ type: 'fixed', category: 'Salaries', description: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringExpense | null>(null);

  const pending = useMemo(() => {
    const done = new Set(
      expenses.filter((e) => e.recurring_id && isSameMonth(parseISO(e.expense_date), monthDate)).map((e) => e.recurring_id)
    );
    return recurring.filter((t) => t.active && !done.has(t.id));
  }, [recurring, expenses, monthDate]);

  const pendingTotal = pending.reduce((s, t) => s + t.amount, 0);
  const categories = form.type === 'fixed' ? FIXED_CATEGORIES : OPERATIONAL_CATEGORIES;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const n = await generateForMonth(monthFirst, user);
      mutateExpenses();
      toast.success(n > 0 ? `Added ${n} recurring expense${n !== 1 ? 's' : ''} for ${monthLabel}` : `Already up to date for ${monthLabel}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setGenerating(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ type: 'fixed', category: 'Salaries', description: '', amount: '' });
    setOpen(true);
  }
  function openEdit(t: RecurringExpense) {
    setEditing(t);
    setForm({ type: t.type, category: t.category, description: t.description ?? '', amount: String(t.amount) });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseAmount(form.amount);
    if (!form.category.trim()) { toast.error('Pick a category'); return; }
    if (amt <= 0) { toast.error('Enter an amount'); return; }
    setSaving(true);
    const payload = { type: form.type, category: form.category.trim(), description: form.description.trim() || null, amount: amt };
    try {
      if (editing) {
        await updateRecurring(editing.id, payload);
        toast.success('Updated');
      } else {
        await addRecurring({ ...payload, active: true, company_id: user.company_id, created_by: user.id });
        toast.success('Recurring expense added');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4 text-muted" />
          <h3 className="font-display text-base font-semibold tracking-tight text-text">Recurring</h3>
          <span className="text-xs text-faint">salaries, subscriptions…</span>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-semibold text-text transition-colors hover:border-border-hover hover:bg-bg">
          <PlusIcon className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* This-month action */}
      {recurring.some((t) => t.active) && (
        <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-3', pending.length > 0 ? 'bg-accent-muted' : 'bg-bg/50')}>
          {pending.length > 0 ? (
            <>
              <p className="text-[13px] text-text">
                <span className="font-semibold">{pending.length}</span> not yet added for <span className="font-semibold">{monthLabel}</span>
                <span className="text-muted"> · {formatOMR(pendingTotal)}</span>
              </p>
              <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-95 disabled:opacity-50">
                <PlusIcon className="h-3.5 w-3.5" /> {generating ? 'Adding…' : `Add all to ${monthLabel}`}
              </button>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-green"><CheckCircleIcon className="h-4 w-4" /> All recurring expenses added for {monthLabel}</p>
          )}
        </div>
      )}

      {/* Templates list */}
      {recurring.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">No recurring expenses yet. Add salaries, rent, subscriptions… once and reuse them every month.</p>
      ) : (
        <div>
          {recurring.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-3 px-5 py-3', i !== recurring.length - 1 && 'border-b border-border', !t.active && 'opacity-50')}>
              <Badge variant={t.type === 'fixed' ? 'warning' : 'default'}>{t.type === 'fixed' ? 'Fixed' : 'Op'}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{t.category}</p>
                {t.description && <p className="truncate text-xs text-muted">{t.description}</p>}
              </div>
              <span className="stat-numeral shrink-0 text-base text-text">{formatOMR(t.amount)}</span>
              <button onClick={() => updateRecurring(t.id, { active: !t.active })} title={t.active ? 'Pause' : 'Activate'}
                className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors', t.active ? 'border-green/30 text-green' : 'border-border text-muted')}>
                {t.active ? 'On' : 'Off'}
              </button>
              <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
              <button onClick={() => setDeleteTarget(t)} className="rounded-lg p-1.5 text-muted hover:bg-red-bg hover:text-red" title="Delete"><TrashIcon className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Add/edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">{editing ? 'Edit Recurring' : 'Add Recurring Expense'}</DialogTitle>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['fixed', 'operational'] as ExpenseType[]).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t, category: t === 'fixed' ? FIXED_CATEGORIES[0] : OPERATIONAL_CATEGORIES[0] })}
                      className={cn('rounded-lg border px-3 py-2 text-[13px] font-semibold capitalize transition-colors', form.type === t ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                      className={cn('rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors', form.category === c ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Label (optional)</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Salary — Ahmad, Adobe CC" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Monthly Amount (OMR)</label>
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" placeholder="0.000" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[85dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-card border border-border bg-card p-5 shadow-xl sm:p-6">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">Delete Recurring</DialogTitle>
            <p className="mt-2 text-sm text-muted">Remove the recurring template for <strong className="text-text">{deleteTarget?.category}</strong>? Expenses already added stay; future months just won&apos;t suggest it.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
              <button onClick={() => deleteTarget && deleteRecurring(deleteTarget.id).then(() => { toast.success('Removed'); setDeleteTarget(null); }).catch(() => toast.error('Failed'))} className="rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red/90">Remove</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
