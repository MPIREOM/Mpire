'use client';

import { clsx } from 'clsx';
import type { Task, User, TaskStatus } from '@/types/database';
import { isOverdue, formatDate } from '@/lib/dates';
import { canManage } from '@/lib/roles';

interface TaskItemProps {
  task: Task;
  currentUser: User;
  onClick: () => void;
  onStatusChange: (status: string) => void;
}

const priorityStyles: Record<string, string> = {
  high: 'bg-red-bg text-red',
  medium: 'bg-yellow-bg text-yellow',
  low: 'bg-blue-bg text-blue',
};

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

export function TaskItem({
  task,
  currentUser,
  onClick,
  onStatusChange,
}: TaskItemProps) {
  const overdue = isOverdue(task.due_date, task.status);
  const canChangeStatus =
    canManage(currentUser.role) || task.assignee_id === currentUser.id;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:border-border-hover hover:shadow-sm',
        overdue ? 'border-red/20' : 'border-border'
      )}
    >
      {/* Status dropdown */}
      <select
        value={task.status}
        onChange={(e) => {
          e.stopPropagation();
          onStatusChange(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={!canChangeStatus}
        className={clsx(
          'h-7 shrink-0 cursor-pointer rounded-lg border-0 px-1.5 text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-accent-muted',
          task.status === 'done'
            ? 'bg-green-bg text-green'
            : task.status === 'in_progress'
            ? 'bg-blue-bg text-blue'
            : task.status === 'blocked'
            ? 'bg-red-bg text-red'
            : 'bg-bg text-muted'
        )}
      >
        {statusOptions.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'truncate text-[13px] font-medium',
            task.status === 'done' ? 'text-muted line-through' : 'text-text'
          )}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          {task.project && (
            <span
              className="rounded px-1 py-0.5 font-semibold"
              style={{
                background: `${task.project.color}10`,
                color: task.project.color,
              }}
            >
              {task.project.name}
            </span>
          )}
          {task.assignee && (
            <span>{task.assignee.full_name}</span>
          )}
          {task.due_date && (
            <span className={overdue ? 'font-semibold text-red' : ''}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <span
        className={clsx(
          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
          priorityStyles[task.priority]
        )}
      >
        {task.priority}
      </span>
    </div>
  );
}
