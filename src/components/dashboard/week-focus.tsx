'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';

interface WeekFocusProps {
  tasks: Task[];
}

export function WeekFocus({ tasks }: WeekFocusProps) {
  const focusItems = useMemo(() => {
    const candidates = tasks.filter(
      (t) => t.status !== 'done' && t.status !== 'blocked'
    );

    const scored = candidates
      .filter((t) => isOverdue(t.due_date, t.status) || isDueToday(t.due_date) || isDueThisWeek(t.due_date))
      .map((t) => {
        let score = 0;
        if (isOverdue(t.due_date, t.status)) score += 100;
        if (isDueToday(t.due_date)) score += 50;
        if (t.priority === 'high') score += 30;
        if (t.priority === 'medium') score += 10;
        const isBlocking = isOverdue(t.due_date, t.status) && t.priority === 'high';
        return { task: t, score, isBlocking };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);

    return scored;
  }, [tasks]);

  if (focusItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      <h3 className="mb-4 text-[14px] font-bold text-text">This Week Focus</h3>
      <div className="rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
        {focusItems.map(({ task, isBlocking }, idx) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + idx * 0.04, duration: 0.3 }}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5',
              idx !== focusItems.length - 1 && 'border-b border-border'
            )}
          >
            {/* Project color stripe */}
            <div
              className="h-6 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: task.project?.color ?? '#6b7280' }}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-text">
                {task.title}
              </p>
              <p className="text-[10px] text-muted">
                {task.project?.name ?? 'No project'}
                {task.assignee && ` · ${task.assignee.full_name}`}
              </p>
            </div>

            {/* Impact tags using Badge */}
            {isBlocking && (
              <Badge variant="danger">Blocking</Badge>
            )}
            {!isBlocking && isOverdue(task.due_date, task.status) && (
              <Badge variant="danger">Overdue</Badge>
            )}
            {!isBlocking && !isOverdue(task.due_date, task.status) && isDueToday(task.due_date) && (
              <Badge variant="warning">Today</Badge>
            )}

            {/* Priority dot */}
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                task.priority === 'high' ? 'bg-red' : task.priority === 'medium' ? 'bg-yellow' : 'bg-blue'
              )}
            />

            {/* Due date */}
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {formatDate(task.due_date)}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
