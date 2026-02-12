'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import type { Task } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';

interface WeekFocusProps {
  tasks: Task[];
}

export function WeekFocus({ tasks }: WeekFocusProps) {
  const focusItems = useMemo(() => {
    // Pick the most important tasks this week: overdue high first, then due today, then due this week high/medium
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
        // Blocking others if has dependents (approximation: high priority overdue = blocking)
        const isBlocking = isOverdue(t.due_date, t.status) && t.priority === 'high';
        return { task: t, score, isBlocking };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 7);

    return scored;
  }, [tasks]);

  if (focusItems.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-bold text-text">This Week Focus</h3>
      <div className="rounded-xl border border-border bg-card">
        {focusItems.map(({ task, isBlocking }, idx) => (
          <div
            key={task.id}
            className={clsx(
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

            {/* Impact tag */}
            {isBlocking && (
              <span className="shrink-0 rounded-md bg-red-bg px-1.5 py-0.5 text-[10px] font-semibold text-red">
                Blocking
              </span>
            )}
            {!isBlocking && isOverdue(task.due_date, task.status) && (
              <span className="shrink-0 rounded-md bg-red-bg px-1.5 py-0.5 text-[10px] font-semibold text-red">
                Overdue
              </span>
            )}
            {!isBlocking && !isOverdue(task.due_date, task.status) && isDueToday(task.due_date) && (
              <span className="shrink-0 rounded-md bg-yellow-bg px-1.5 py-0.5 text-[10px] font-semibold text-yellow">
                Today
              </span>
            )}

            {/* Priority dot */}
            <span
              className={clsx(
                'h-2 w-2 shrink-0 rounded-full',
                task.priority === 'high' ? 'bg-red' : task.priority === 'medium' ? 'bg-yellow' : 'bg-blue'
              )}
            />

            {/* Due date */}
            <span className="shrink-0 text-[11px] tabular-nums text-muted">
              {formatDate(task.due_date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
