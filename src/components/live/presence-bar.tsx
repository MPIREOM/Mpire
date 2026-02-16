'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import type { PresenceUser } from '@/hooks/use-presence';
import type { UserVisitStats } from '@/hooks/use-visit-stats';
import { cn } from '@/lib/utils';

const pageLabels: Record<string, string> = {
  '/operations': 'Dashboard',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/timesheet': 'Timesheet',
  '/people': 'People',
  '/finance': 'Finance',
  '/settings': 'Settings',
  '/activity': 'Activity',
};

export function getPageLabel(page: string): string {
  if (pageLabels[page]) return pageLabels[page];
  if (page.startsWith('/projects/')) return 'Project Detail';
  return page;
}

interface PresenceBarProps {
  onlineUsers: PresenceUser[];
  visitStats?: UserVisitStats[];
  currentUserId?: string;
}

export function PresenceBar({ onlineUsers, visitStats = [], currentUserId }: PresenceBarProps) {
  const visitMap = new Map(visitStats.map((v) => [v.user_id, v]));

  return (
    <div className="flex items-center gap-2">
      {/* Online count badge */}
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[12px] font-semibold text-text">
          {onlineUsers.length} online
        </span>
      </div>

      {/* User avatars — show all online users including self */}
      <div className="flex -space-x-1.5">
        <AnimatePresence mode="popLayout">
          {onlineUsers.slice(0, 8).map((user) => {
            const isSelf = user.user_id === currentUserId;
            const stats = visitMap.get(user.user_id);
            return (
              <motion.div
                key={user.user_id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group relative"
              >
                <div className="relative">
                  <Avatar
                    name={user.full_name}
                    src={user.avatar_url}
                    size="sm"
                    className={cn('ring-2', isSelf ? 'ring-accent' : 'ring-card')}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-card bg-emerald-400" />
                </div>
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 shadow-xl group-hover:block">
                  <p className="whitespace-nowrap text-[12px] font-semibold text-text">
                    {user.full_name}{isSelf ? ' (you)' : ''}
                  </p>
                  <p className="whitespace-nowrap text-[11px] text-muted">
                    {getPageLabel(user.page)}
                  </p>
                  {stats && (
                    <p className="mt-0.5 whitespace-nowrap text-[10px] text-muted/70">
                      {stats.sessions_today} visit{stats.sessions_today !== 1 ? 's' : ''} today
                      {' / '}
                      {stats.sessions_this_week} this week
                    </p>
                  )}
                  <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-card" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {onlineUsers.length > 8 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-bg text-[10px] font-bold text-muted ring-2 ring-card">
            +{onlineUsers.length - 8}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar footer — just shows avatars with green dots.
 */
export function PresenceDots({ onlineUsers, currentUserId }: { onlineUsers: PresenceUser[]; currentUserId?: string }) {
  if (onlineUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[10px] font-medium text-gray-500">
        {onlineUsers.length} online
      </span>
      <div className="flex -space-x-1">
        {onlineUsers.filter((u) => u.user_id !== currentUserId).slice(0, 4).map((u) => (
          <Avatar
            key={u.user_id}
            name={u.full_name}
            src={u.avatar_url}
            size="sm"
            className="!h-4 !w-4 !text-[7px] ring-1 ring-gray-900"
          />
        ))}
      </div>
    </div>
  );
}
