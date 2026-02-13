'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/types/database';
import { isOverdue, formatDate } from '@/lib/dates';

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl border border-red/20 bg-red-bg p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-4 flex items-center gap-2">
        <ExclamationTriangleIcon className="h-4 w-4 text-red" />
        <h3 className="text-base font-bold text-red">
          Critical Focus — {criticalTasks.length} item{criticalTasks.length !== 1 ? 's' : ''}
        </h3>
      </div>
      <div className="space-y-2">
        {criticalTasks.slice(0, 5).map((task, idx) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 transition-shadow hover:shadow-md"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
            <span className="flex-1 truncate text-sm font-medium text-text">
              {task.title}
            </span>
            {isOverdue(task.due_date, task.status) ? (
              <Badge variant="danger">Overdue</Badge>
            ) : (
              <Badge variant="warning">Today</Badge>
            )}
            {task.project && (
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  background: `${task.project.color}12`,
                  color: task.project.color,
                }}
              >
                {task.project.name}
              </span>
            )}
            <span className="shrink-0 text-[13px] text-muted">
              {formatDate(task.due_date)}
            </span>
          </motion.div>
        ))}
        {criticalTasks.length > 5 && (
          <p className="px-3 text-xs text-muted">
            +{criticalTasks.length - 5} more
          </p>
        )}
      </div>
    </motion.div>
  );
}
