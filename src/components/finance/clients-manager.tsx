'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { PlusIcon, XMarkIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatOMR, parseAmount } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useFinanceClients } from '@/hooks/use-finance-data';
import type { User, FinanceClient, ClientType } from '@/types/database';

interface FormState {
  name: string;
  type: ClientType;
  monthly_amount: string;
  status: 'active' | 'inactive';
  notes: string;
}

const empty: FormState = { name: '', type: 'retainer', monthly_amount: '', status: 'active', notes: '' };

export function ClientsManager({ user }: { user: User }) {
  const { clients, addClient, updateClient, deleteClient } = useFinanceClients();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceClient | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceClient | null>(null);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(c: FinanceClient) {
    setEditing(c);
    setForm({ name: c.name, type: c.type, monthly_amount: c.monthly_amount ? String(c.monthly_amount) : '', status: c.status, notes: c.notes ?? '' });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      monthly_amount: form.type === 'retainer' ? parseAmount(form.monthly_amount) : 0,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await updateClient(editing.id, payload);
        toast.success('Client updated');
      } else {
        await addClient({ ...payload, company_id: user.company_id, created_by: user.id });
        toast.success('Client added');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteClient(deleteTarget.id);
      toast.success('Client removed');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-95">
          <PlusIcon className="h-4 w-4" /> Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <EmptyState title="No clients yet" description="Add your retainer and campaign clients to start tracking revenue." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="group rounded-card border border-border bg-card p-5 transition-colors hover:border-border-hover">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold tracking-tight text-text">{c.name}</h3>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge variant={c.type === 'retainer' ? 'accent' : 'info'}>{c.type}</Badge>
                    {c.status === 'inactive' && <Badge variant="default">inactive</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-text" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteTarget(c)} className="rounded-lg p-1.5 text-muted hover:bg-red-bg hover:text-red" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                </div>
              </div>
              {c.type === 'retainer' && (
                <p className="stat-numeral mt-4 text-2xl text-text">{formatOMR(c.monthly_amount)}<span className="ml-1 font-sans text-xs font-normal text-faint">/mo</span></p>
              )}
              {c.notes && <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-2">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-card border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">{editing ? 'Edit Client' : 'Add Client'}</DialogTitle>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Client Name</label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Co." className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['retainer', 'campaign'] as ClientType[]).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                      className={cn('rounded-lg border px-3 py-2 text-[13px] font-semibold capitalize transition-colors', form.type === t ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {form.type === 'retainer' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Monthly Amount (OMR)</label>
                  <input value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} inputMode="decimal" placeholder="0.000" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save' : 'Add Client'}</button>
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
            <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">Remove Client</DialogTitle>
            <p className="mt-2 text-sm text-muted">Remove <strong className="text-text">{deleteTarget?.name}</strong>? Their invoices and linked expenses will also be removed. This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
              <button onClick={handleDelete} className="rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red/90">Remove</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
