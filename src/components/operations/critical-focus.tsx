'use client';

import type { Task } from '@/types/database';
import { isOverdue, formatDate } from '@/lib/dates';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface CriticalFocusProps {
  tasks: Task[];
}

export function CriticalFocus({ tasks }: CriticalFocusProps) {
  const criticalTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      (isOverdue(t.due_date, t.status) ||
        (t.priority === 'high' && t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()))
  );

  if (criticalTasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-red/20 bg-red-bg p-4">
      <div className="mb-3 flex items-center gap-2">
        <ExclamationTriangleIcon className="h-4 w-4 text-red" />
        <h3 className="text-[13px] font-bold text-red">
          Critical Focus — {criticalTasks.length} item{criticalTasks.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div className="space-y-2">
        {criticalTasks.slice(0, 5).map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-lg bg-card px-3 py-2"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
            <span className="flex-1 truncate text-[13px] font-medium text-text">
              {task.title}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-red">
              {isOverdue(task.due_date, task.status) ? 'Overdue' : 'Today'}
            </span>
            {task.project && (
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: `${task.project.color}12`,
                  color: task.project.color,
                }}
              >
                {task.project.name}
              </span>
            )}
            <span className="shrink-0 text-[11px] text-muted">
              {formatDate(task.due_date)}
            </span>
          </div>
        ))}
        {criticalTasks.length > 5 && (
          <p className="px-3 text-[11px] text-muted">
            +{criticalTasks.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
