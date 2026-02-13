'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/use-tasks';
import { useUser } from '@/hooks/use-user';
import { isOverdue } from '@/lib/dates';
import { isAssignedTo } from '@/lib/task-helpers';
import { formatDistanceToNow } from 'date-fns';

interface TopNavProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  onCommandPalette?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'overdue' | 'assigned' | 'comment';
  title: string;
  detail: string;
  time: string;
}

export function TopNav({ title, subtitle, onMenuClick, onCommandPalette }: TopNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { tasks } = useTasks();
  const { user } = useUser();

  // Sync initial state from DOM (set by inline script in layout)
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [notifOpen]);

  // Build notifications from tasks data
  const notifications: NotificationItem[] = (() => {
    if (!user || !tasks) return [];
    const items: NotificationItem[] = [];

    // Overdue tasks assigned to me
    const myOverdue = tasks.filter(
      (t) => isAssignedTo(t, user.id) && isOverdue(t.due_date, t.status)
    );
    for (const t of myOverdue.slice(0, 5)) {
      items.push({
        id: `overdue-${t.id}`,
        type: 'overdue',
        title: t.title,
        detail: `Overdue · ${t.project?.name ?? 'No project'}`,
        time: t.due_date ?? '',
      });
    }

    // Recently assigned to me (tasks created in last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentAssigned = tasks.filter(
      (t) =>
        isAssignedTo(t, user.id) &&
        t.status !== 'done' &&
        !isOverdue(t.due_date, t.status) &&
        new Date(t.updated_at).getTime() > weekAgo
    );
    for (const t of recentAssigned.slice(0, 5)) {
      items.push({
        id: `assigned-${t.id}`,
        type: 'assigned',
        title: t.title,
        detail: `Assigned to you · ${t.project?.name ?? 'No project'}`,
        time: formatDistanceToNow(new Date(t.updated_at), { addSuffix: true }),
      });
    }

    return items.slice(0, 10);
  })();

  const notifCount = notifications.length;

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/95 px-4 backdrop-blur-xl transition-all duration-300 lg:px-8',
        scrolled ? 'border-border shadow-sm' : 'border-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-1.5 text-muted transition-all hover:bg-bg hover:text-text active:scale-90 lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-lg font-bold text-text">{title}</h1>
          {subtitle && (
            <p className="text-[13px] text-muted">{subtitle}</p>
          )}
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        {/* Command palette trigger */}
        {onCommandPalette && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCommandPalette}
            className="hidden items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-muted transition-all hover:border-border-hover hover:text-text sm:flex"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium">
              &#x2318;K
            </kbd>
          </motion.button>
        )}

        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted hover:text-text"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <motion.div
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </motion.div>
        </Button>

        {/* Notifications bell */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted hover:text-text"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label={`Notifications${notifCount > 0 ? ` (${notifCount})` : ''}`}
          >
            <BellIcon className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red px-0.5 text-[9px] font-bold text-white">
                {notifCount}
              </span>
            )}
          </Button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-bold text-text">Notifications</h3>
                  <button
                    onClick={() => setNotifOpen(false)}
                    aria-label="Close notifications"
                    className="rounded-md p-0.5 text-muted hover:text-text"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <BellIcon className="mx-auto mb-2 h-6 w-6 text-muted/40" />
                      <p className="text-[13px] text-muted">All caught up!</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 border-b border-border px-4 py-3 transition-all last:border-0 hover:bg-bg active:scale-[0.98]"
                      >
                        <div className={cn(
                          'mt-0.5 rounded-lg p-1.5',
                          n.type === 'overdue' ? 'bg-red-bg' : n.type === 'assigned' ? 'bg-blue-bg' : 'bg-accent-muted'
                        )}>
                          {n.type === 'overdue' ? (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red" />
                          ) : n.type === 'assigned' ? (
                            <UserPlusIcon className="h-4 w-4 text-blue" />
                          ) : (
                            <ChatBubbleLeftIcon className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-text">{n.title}</p>
                          <p className="text-[13px] text-muted">{n.detail}</p>
                          <p className="mt-0.5 text-xs text-muted/70">{n.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
