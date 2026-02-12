'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Shell } from '@/components/layout/shell';
import { useTeam } from '@/hooks/use-team';
import { useUser } from '@/hooks/use-user';
import { canManage } from '@/lib/roles';
import type { Role } from '@/types/database';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
  { value: 'investor', label: 'Investor' },
];

export default function PeoplePage() {
  const { team, isLoading, mutate } = useTeam();
  const { user } = useUser();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff' as Role,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const showManage = user && canManage(user.role);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add user');
        return;
      }

      setShowAdd(false);
      setForm({ email: '', password: '', full_name: '', role: 'staff' });
      mutate();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title="People" subtitle="Team directory">
      {showManage && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-light"
          >
            <PlusIcon className="h-4 w-4" />
            Add Member
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                  {u.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-text">
                    {u.full_name}
                  </h3>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {u.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onClose={() => setShowAdd(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[15px] font-bold text-text">
                Add Team Member
              </DialogTitle>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-[12px] font-medium text-red">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-light disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </Shell>
  );
}
