'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import type { Task, User, TaskStatus } from '@/types/database';
import { isOverdue, formatDate } from '@/lib/dates';
import { canManage } from '@/lib/roles';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import {
  ClockIcon,
  ExclamationCircleIcon,
  NoSymbolIcon,
  EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline';

interface TaskItemProps {
  task: Task;
  currentUser: User;
  onClick: () => void;
  onStatusChange: (status: string) => void;
}

const priorityConfig = {
  high: { color: 'border-l-red', badge: 'danger' as const, label: 'High' },
  medium: { color: 'border-l-yellow', badge: 'warning' as const, label: 'Med' },
  low: { color: 'border-l-blue', badge: 'info' as const, label: 'Low' },
};

const statusConfig: Record<TaskStatus, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string; badge: 'default' | 'success' | 'info' | 'danger' }> = {
  todo: { icon: EllipsisHorizontalCircleIcon, color: 'text-muted', badge: 'default' },
  in_progress: { icon: ClockIcon, color: 'text-blue', badge: 'info' },
  done: { icon: CheckCircleIcon, color: 'text-green', badge: 'success' },
  blocked: { icon: NoSymbolIcon, color: 'text-red', badge: 'danger' },
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
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'group relative flex cursor-pointer items-center gap-4 rounded-xl border border-l-[3px] bg-card px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        overdue ? 'border-border border-l-red' : `border-border ${priority.color}`
      )}
    >
      {/* Status icon button */}
      <div className="relative">
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={!canChangeStatus}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <motion.div
          whileTap={{ scale: 0.85 }}
          className={cn('rounded-lg p-1', status.color)}
        >
          <StatusIcon className="h-5 w-5" />
        </motion.div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium leading-tight',
            task.status === 'done' ? 'text-muted line-through' : 'text-text'
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
          {task.project && (
            <span
              className="rounded-md px-1.5 py-0.5 font-semibold"
              style={{
                background: `${task.project.color}12`,
                color: task.project.color,
              }}
            >
              {task.project.name}
            </span>
          )}
          {task.due_date && (
            <span className={cn('flex items-center gap-1', overdue && 'font-semibold text-red')}>
              {overdue && <ExclamationCircleIcon className="h-3 w-3" />}
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Right side: priority badge + assignee */}
      <div className="flex items-center gap-3">
        <Badge variant={priority.badge}>{priority.label}</Badge>
        {task.assignee && (
          <Avatar
            name={task.assignee.full_name}
            src={task.assignee.avatar_url}
            size="sm"
          />
        )}
      </div>
    </motion.div>
  );
}
