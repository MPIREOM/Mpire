'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import type { FeedEvent } from '@/hooks/use-activity-feed';
import {
  PlusCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  FolderPlusIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

function getEventIcon(type: FeedEvent['type']) {
  switch (type) {
    case 'task_created':
      return { Icon: PlusCircleIcon, color: 'text-green', bg: 'bg-green-bg' };
    case 'task_updated':
      return { Icon: PencilSquareIcon, color: 'text-blue', bg: 'bg-blue-bg' };
    case 'task_deleted':
      return { Icon: TrashIcon, color: 'text-red', bg: 'bg-red-bg' };
    case 'project_created':
      return { Icon: FolderPlusIcon, color: 'text-accent', bg: 'bg-accent-muted' };
    case 'project_updated':
      return { Icon: FolderIcon, color: 'text-blue', bg: 'bg-blue-bg' };
    case 'project_deleted':
      return { Icon: TrashIcon, color: 'text-red', bg: 'bg-red-bg' };
  }
}

function getEventLabel(event: FeedEvent): string {
  const name = (event.record?.title ?? event.record?.name ?? 'Unknown') as string;
  switch (event.type) {
    case 'task_created':
      return `New task: "${name}"`;
    case 'task_updated': {
      const oldStatus = event.old_record?.status as string | undefined;
      const newStatus = event.record?.status as string | undefined;
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        return `"${name}" moved to ${newStatus.replace('_', ' ')}`;
      }
      return `Task updated: "${name}"`;
    }
    case 'task_deleted':
      return `Task deleted: "${name}"`;
    case 'project_created':
      return `New project: "${name}"`;
    case 'project_updated':
      return `Project updated: "${name}"`;
    case 'project_deleted':
      return `Project deleted: "${name}"`;
  }
}

interface ActivityFeedProps {
  events: FeedEvent[];
  maxItems?: number;
}

export function ActivityFeed({ events, maxItems = 15 }: ActivityFeedProps) {
  const visible = events.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <h3 className="text-[13px] font-bold text-text">Live Activity</h3>
        </div>
        <span className="text-[11px] text-muted">{events.length} events</span>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-[13px] text-muted">No activity yet</p>
            <p className="mt-1 text-[11px] text-muted/60">
              Changes will appear here in real time
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((event) => {
              const { Icon, color, bg } = getEventIcon(event.type);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0, x: -20 }}
                  animate={{ opacity: 1, height: 'auto', x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="border-b border-border last:border-0"
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className={cn('mt-0.5 rounded-lg p-1.5', bg)}>
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-text line-clamp-2">
                        {getEventLabel(event)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted/70">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
