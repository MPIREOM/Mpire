'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { FolderIcon } from '@heroicons/react/24/outline';
import type { ProjectHealth } from '@/types/database';

interface ProjectHealthGridProps {
  projects: ProjectHealth[];
}

function statusColor(health: 'green' | 'yellow' | 'red') {
  return {
    green: 'bg-green',
    yellow: 'bg-yellow',
    red: 'bg-red',
  }[health];
}

function barColor(health: 'green' | 'yellow' | 'red') {
  return {
    green: 'bg-green',
    yellow: 'bg-yellow',
    red: 'bg-red',
  }[health];
}

export function ProjectHealthGrid({ projects }: ProjectHealthGridProps) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderIcon}
        title="No projects yet"
        description="Create your first project to see health metrics here."
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <h3 className="mb-4 text-base font-bold text-text">Project Health</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((ph, i) => (
          <motion.div
            key={ph.project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    statusColor(ph.healthStatus)
                  )}
                />
                <h4 className="text-sm font-semibold text-text">
                  {ph.project.name}
                </h4>
              </div>
              <span className="text-[13px] font-semibold tabular-nums text-muted">
                {ph.progressPercent}%
              </span>
            </div>

            {/* Animated progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ph.progressPercent}%` }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                className={cn(
                  'h-full rounded-full',
                  barColor(ph.healthStatus)
                )}
              />
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-xs">
              <span className="text-muted">
                <strong className="font-semibold text-text">
                  {ph.totalTasks}
                </strong>{' '}
                tasks
              </span>
              {ph.overdueTasks > 0 && (
                <span className="font-semibold text-red">
                  {ph.overdueTasks} overdue
                </span>
              )}
              {ph.dueTodayTasks > 0 && (
                <span className="font-semibold text-yellow">
                  {ph.dueTodayTasks} today
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
