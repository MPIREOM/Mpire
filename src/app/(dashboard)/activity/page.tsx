'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { Shell } from '@/components/layout/shell';
import { Avatar } from '@/components/ui/avatar';
import { useUser } from '@/hooks/use-user';
import { useTeam } from '@/hooks/use-team';
import { canManage } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';
import { getPageLabel } from '@/components/live/presence-bar';
import { ClockIcon, CalendarDaysIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const supabase = createClient();

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  page: string | null;
}

type DateRange = 'today' | 'week' | 'month' | 'all';

function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1m';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDateRangeStart(range: DateRange): string | null {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }
    case 'week': {
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      return start.toISOString();
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    case 'all':
      return null;
  }
}

export default function ActivityPage() {
  const { user } = useUser();
  const { team } = useTeam();
  const [range, setRange] = useState<DateRange>('week');
  const [filterUserId, setFilterUserId] = useState<string>('all');

  // Fetch all sessions (RLS scopes to company)
  const { data: sessions, isLoading } = useSWR<SessionRow[]>(
    'activity-backlog',
    async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, user_id, started_at, last_seen_at, ended_at, page')
        .order('started_at', { ascending: false })
        .limit(2000);

      if (error) return [];
      return data as SessionRow[];
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const userMap = useMemo(() => {
    const map = new Map<string, { full_name: string; avatar_url: string | null; role: string }>();
    team.forEach((u) => map.set(u.id, { full_name: u.full_name, avatar_url: u.avatar_url, role: u.role }));
    return map;
  }, [team]);

  // Filter sessions by date range and user
  const filtered = useMemo(() => {
    if (!sessions) return [];
    const rangeStart = getDateRangeStart(range);

    return sessions.filter((s) => {
      if (rangeStart && s.started_at < rangeStart) return false;
      if (filterUserId !== 'all' && s.user_id !== filterUserId) return false;
      return true;
    });
  }, [sessions, range, filterUserId]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    for (const s of filtered) {
      const dateKey = new Date(s.started_at).toDateString();
      const arr = map.get(dateKey) ?? [];
      arr.push(s);
      map.set(dateKey, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Summary stats per user
  const userStats = useMemo(() => {
    const stats = new Map<string, { sessions: number; totalMs: number; lastSeen: string }>();
    for (const s of filtered) {
      const existing = stats.get(s.user_id) ?? { sessions: 0, totalMs: 0, lastSeen: s.started_at };
      existing.sessions += 1;

      // Duration: use ended_at or last_seen_at, fall back to started_at
      const endTime = s.ended_at || s.last_seen_at || s.started_at;
      const duration = new Date(endTime).getTime() - new Date(s.started_at).getTime();
      existing.totalMs += Math.max(0, duration);

      if (s.started_at > existing.lastSeen) existing.lastSeen = s.started_at;
      stats.set(s.user_id, existing);
    }
    return stats;
  }, [filtered]);

  // Access check
  if (user && !canManage(user.role)) {
    return (
      <Shell title="Activity" subtitle="User activity backlog">
        <div className="flex h-64 items-center justify-center text-muted">
          Only owners and managers can view the activity backlog.
        </div>
      </Shell>
    );
  }

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];

  const totalSessions = filtered.length;
  const totalMs = Array.from(userStats.values()).reduce((sum, s) => sum + s.totalMs, 0);
  const uniqueUsers = userStats.size;

  return (
    <Shell title="Activity" subtitle="User activity backlog">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range pills */}
          <div className="flex rounded-xl border border-border bg-card p-1">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  range === opt.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* User filter */}
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
          >
            <option value="all">All Users</option>
            {team.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted">
              <UserGroupIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">{uniqueUsers}</p>
              <p className="text-xs text-muted">Active Users</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <CalendarDaysIcon className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">{totalSessions}</p>
              <p className="text-xs text-muted">Total Sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10">
              <ClockIcon className="h-5 w-5 text-green" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text">{formatDuration(totalMs)}</p>
              <p className="text-xs text-muted">Total Time Online</p>
            </div>
          </div>
        </motion.div>

        {/* Per-User Summary Table */}
        {userStats.size > 0 && filterUserId === 'all' && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-bold text-text">User Summary</h2>
            </div>
            <div className="divide-y divide-border">
              {Array.from(userStats.entries())
                .sort((a, b) => b[1].totalMs - a[1].totalMs)
                .map(([userId, stats]) => {
                  const info = userMap.get(userId);
                  return (
                    <div key={userId} className="flex items-center gap-4 px-5 py-3">
                      <Avatar name={info?.full_name ?? 'Unknown'} src={info?.avatar_url ?? null} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{info?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted capitalize">{info?.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-text">{formatDuration(stats.totalMs)}</p>
                        <p className="text-[11px] text-muted">{stats.sessions} session{stats.sessions !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.section>
        )}

        {/* Session Log grouped by date */}
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            No sessions found for the selected period.
          </div>
        ) : (
          grouped.map(([dateKey, daySessions], i) => (
            <motion.section
              key={dateKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * Math.min(i, 5) }}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="border-b border-border bg-bg/50 px-5 py-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
                  {formatDate(daySessions[0].started_at)}
                  <span className="ml-2 normal-case font-normal">
                    — {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-border">
                {daySessions.map((session) => {
                  const info = userMap.get(session.user_id);
                  const endTime = session.ended_at || session.last_seen_at || session.started_at;
                  const duration = new Date(endTime).getTime() - new Date(session.started_at).getTime();
                  const isActive = !session.ended_at && (Date.now() - new Date(session.last_seen_at).getTime() < 120_000);

                  return (
                    <div key={session.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="relative shrink-0">
                        <Avatar name={info?.full_name ?? 'Unknown'} src={info?.avatar_url ?? null} size="sm" />
                        {isActive && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-card bg-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">
                          {info?.full_name ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-muted">
                          {formatTime(session.started_at)}
                          {' — '}
                          {isActive ? (
                            <span className="font-semibold text-green">Online now</span>
                          ) : (
                            formatTime(endTime)
                          )}
                          {session.page && (
                            <span className="ml-1.5 text-muted/70">
                              on {getPageLabel(session.page)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          isActive
                            ? 'bg-green/10 text-green'
                            : 'bg-bg text-muted'
                        }`}>
                          <ClockIcon className="mr-1 h-3 w-3" />
                          {isActive ? 'Live' : formatDuration(Math.max(0, duration))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))
        )}
      </div>
    </Shell>
  );
}
