'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shell } from '@/components/layout/shell';
import { useUser } from '@/hooks/use-user';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { isOwner } from '@/lib/roles';
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

type ThemePref = 'light' | 'dark' | 'system';

export default function SettingsPage() {
  const { user, mutate } = useUser();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState<ThemePref>('system');
  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskDue: true,
    comments: true,
  });

  // Initialize from user data and localStorage
  useEffect(() => {
    if (user) setFullName(user.full_name);
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') setTheme('dark');
    else if (stored === 'light') setTheme('light');
    else setTheme('system');

    const notifStored = localStorage.getItem('notification-prefs');
    if (notifStored) {
      try { setNotifications(JSON.parse(notifStored)); } catch { /* ignore */ }
    }
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    if (!user || !fullName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (error) throw error;
      mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [user, fullName, supabase, mutate]);

  function applyTheme(pref: ThemePref) {
    setTheme(pref);
    if (pref === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', pref);
      document.documentElement.classList.toggle('dark', pref === 'dark');
    }
  }

  function updateNotification(key: keyof typeof notifications, value: boolean) {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    localStorage.setItem('notification-prefs', JSON.stringify(next));
  }

  if (!user) {
    return (
      <Shell title="Settings" subtitle="System configuration">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  const themeOptions: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <SunIcon className="h-5 w-5" /> },
    { value: 'dark', label: 'Dark', icon: <MoonIcon className="h-5 w-5" /> },
    { value: 'system', label: 'System', icon: <ComputerDesktopIcon className="h-5 w-5" /> },
  ];

  const notifOptions: { key: keyof typeof notifications; label: string; description: string }[] = [
    { key: 'taskAssigned', label: 'Task assigned', description: 'When a task is assigned to you' },
    { key: 'taskDue', label: 'Task due soon', description: 'Reminders for upcoming deadlines' },
    { key: 'comments', label: 'New comments', description: 'When someone comments on your tasks' },
  ];

  return (
    <Shell title="Settings" subtitle="System configuration">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Profile Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-base font-bold text-text">Profile</h2>
          <p className="mt-1 text-[13px] text-muted">Your personal information</p>

          <div className="mt-6 flex items-start gap-5">
            <div className="shrink-0">
              <Avatar name={user.full_name} src={user.avatar_url} size="lg" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-muted transition-colors disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Role
                </label>
                <span className="inline-flex items-center rounded-lg bg-accent-muted px-3 py-1.5 text-[13px] font-semibold capitalize text-accent">
                  {user.role}
                </span>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveProfile}
                  loading={saving}
                  disabled={fullName.trim() === user.full_name}
                  size="sm"
                >
                  {saved ? (
                    <span className="flex items-center gap-1.5">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Saved
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Appearance Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-base font-bold text-text">Appearance</h2>
          <p className="mt-1 text-[13px] text-muted">Choose your preferred theme</p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => applyTheme(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-[13px] font-semibold transition-all ${
                  theme === opt.value
                    ? 'border-accent bg-accent-muted text-accent'
                    : 'border-border text-muted hover:border-border-hover hover:text-text'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </motion.section>

        {/* Notifications Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-base font-bold text-text">Notifications</h2>
          <p className="mt-1 text-[13px] text-muted">Manage your notification preferences</p>

          <div className="mt-5 divide-y divide-border">
            {notifOptions.map((opt) => (
              <div key={opt.key} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-semibold text-text">{opt.label}</p>
                  <p className="text-xs text-muted">{opt.description}</p>
                </div>
                <button
                  onClick={() => updateNotification(opt.key, !notifications[opt.key])}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    notifications[opt.key] ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      notifications[opt.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Danger Zone (Owner only) */}
        {isOwner(user.role) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl border border-red/20 bg-card p-6"
          >
            <h2 className="text-base font-bold text-red">Danger Zone</h2>
            <p className="mt-1 text-[13px] text-muted">Irreversible actions for your organization</p>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold text-text">Export all data</p>
                <p className="text-xs text-muted">Download a copy of all your organization data</p>
              </div>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </div>
          </motion.section>
        )}
      </div>
    </Shell>
  );
}
