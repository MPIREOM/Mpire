'use client';

import { clsx } from 'clsx';
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
  if (projects.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-bold text-text">Project Health</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((ph) => (
          <div
            key={ph.project.id}
            className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-border-hover hover:shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'h-2 w-2 rounded-full',
                    statusColor(ph.healthStatus)
                  )}
                />
                <h4 className="text-[13px] font-semibold text-text">
                  {ph.project.name}
                </h4>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-muted">
                {ph.progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  barColor(ph.healthStatus)
                )}
                style={{ width: `${ph.progressPercent}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-[11px]">
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
          </div>
        ))}
      </div>
    </div>
  );
}
