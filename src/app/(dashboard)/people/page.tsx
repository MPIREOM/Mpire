'use client';

import { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, PlusIcon, PencilIcon, KeyIcon } from '@heroicons/react/24/outline';
import { Shell } from '@/components/layout/shell';
import { useTeam } from '@/hooks/use-team';
import { useUser } from '@/hooks/use-user';
import { useProjects } from '@/hooks/use-projects';
import { canManage, isOwner } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import type { Role, User } from '@/types/database';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
  { value: 'investor', label: 'Investor' },
];

export default function PeoplePage() {
  const { team, isLoading, mutate } = useTeam();
  const { user } = useUser();
  const { projects } = useProjects();
  const supabase = createClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff' as Role,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit user state (owner only)
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ role: 'staff' as Role, allowed_project_ids: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Change password state (owner only)
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showManage = user && canManage(user.role);
  const ownerMode = user && isOwner(user.role);

  function openEditUser(u: User) {
    setEditUser(u);
    setEditForm({
      role: u.role,
      allowed_project_ids: u.allowed_project_ids ?? [],
    });
    setEditError('');
    setNewPassword('');
    setPasswordMsg(null);
  }

  async function handleChangePassword() {
    if (!editUser || !newPassword) return;
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: editUser.id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to change password' });
        return;
      }
      setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
    } catch {
      setPasswordMsg({ type: 'error', text: 'Network error — please try again' });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updates: Record<string, unknown> = { role: editForm.role };
      // Empty array = no restriction (null), otherwise set specific projects
      updates.allowed_project_ids = editForm.allowed_project_ids.length > 0
        ? editForm.allowed_project_ids
        : null;

      const { error: err } = await supabase
        .from('users')
        .update(updates)
        .eq('id', editUser.id);

      if (err) throw err;
      setEditUser(null);
      mutate();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  }

  function toggleProjectAccess(projectId: string) {
    setEditForm((prev) => {
      const has = prev.allowed_project_ids.includes(projectId);
      return {
        ...prev,
        allowed_project_ids: has
          ? prev.allowed_project_ids.filter((id) => id !== projectId)
          : [...prev.allowed_project_ids, projectId],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // Guard against non-JSON responses (e.g. if session expired and server returned HTML)
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError(res.status === 401 || res.redirected ? 'Session expired — please refresh the page and try again' : 'Unexpected server response');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add user');
        return;
      }

      setShowAdd(false);
      setForm({ email: '', password: '', full_name: '', role: 'staff' });
      mutate();
    } catch {
      setError('Network error — please check your connection and try again');
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
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95"
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
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                  {u.full_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-text">
                    {u.full_name}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {u.role}
                    {u.allowed_project_ids && u.allowed_project_ids.length > 0 && (
                      <span className="ml-1 normal-case text-accent">
                        · {u.allowed_project_ids.length} project{u.allowed_project_ids.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {ownerMode && u.id !== user.id && (
                  <button
                    onClick={() => openEditUser(u)}
                    className="rounded-lg p-1.5 text-muted transition-all hover:bg-bg hover:text-text active:scale-90"
                    title="Edit role & project access"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit User Role & Access Dialog (owner only) */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-text">
                Edit {editUser?.full_name}
              </DialogTitle>
              <button onClick={() => setEditUser(null)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Project Access
                </label>
                <p className="mb-2 text-xs text-muted">
                  Select which projects this user can see. Leave all unchecked for full access.
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-bg p-3">
                  {projects.map((p) => {
                    const checked = editForm.allowed_project_ids.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-card"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProjectAccess(p.id)}
                          className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent-muted"
                        />
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="text-[13px] font-medium text-text">{p.name}</span>
                      </label>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted">No projects yet</p>
                  )}
                </div>
                {editForm.allowed_project_ids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, allowed_project_ids: [] })}
                    className="mt-2 text-xs font-semibold text-accent hover:text-accent-light"
                  >
                    Clear selection (allow all projects)
                  </button>
                )}
              </div>

              {editError && (
                <p className="text-[13px] font-medium text-red">{editError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            {/* Change Password Section */}
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyIcon className="h-4 w-4 text-muted" />
                <h3 className="text-sm font-bold text-text">Change Password</h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  minLength={6}
                  className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passwordSaving || newPassword.length < 6}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95 disabled:opacity-50"
                >
                  {passwordSaving ? 'Updating...' : 'Update'}
                </button>
              </div>
              {passwordMsg && (
                <p className={`mt-2 text-[13px] font-medium ${passwordMsg.type === 'success' ? 'text-green' : 'text-red'}`}>
                  {passwordMsg.text}
                </p>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onClose={() => setShowAdd(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-text">
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-[13px] font-medium text-red">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95 disabled:opacity-50"
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
