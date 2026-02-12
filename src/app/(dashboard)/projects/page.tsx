'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Shell } from '@/components/layout/shell';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { isOverdue, isDueThisWeek } from '@/lib/dates';
import { format } from 'date-fns';

export default function ProjectsPage() {
  const { projects, isLoading } = useProjects();
  const { tasks } = useTasks();

  const projectRows = useMemo(() => {
    return projects.map((p) => {
      const pTasks = tasks.filter((t) => t.project_id === p.id);
      const total = pTasks.length;
      const done = pTasks.filter((t) => t.status === 'done').length;
      const overdue = pTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
      const dueWeek = pTasks.filter(
        (t) => isDueThisWeek(t.due_date) && t.status !== 'done'
      ).length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      // Last update: most recent task updated_at
      const lastUpdate = pTasks.length > 0
        ? pTasks.reduce((latest, t) =>
            new Date(t.updated_at) > new Date(latest) ? t.updated_at : latest,
          pTasks[0].updated_at)
        : null;

      let health: 'green' | 'yellow' | 'red' = 'green';
      if (overdue > 0) health = 'red';
      else if (progress < 30 && total > 0) health = 'yellow';

      return { project: p, total, done, overdue, dueWeek, progress, lastUpdate, health };
    });
  }, [projects, tasks]);

  return (
    <Shell title="Projects" subtitle="All projects">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {/* Header */}
          <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:flex">
            <span className="flex-1">Project</span>
            <span className="w-20 text-center">Progress</span>
            <span className="w-14 text-center">Overdue</span>
            <span className="w-16 text-center">Due Week</span>
            <span className="w-16 text-center">Status</span>
            <span className="w-20 text-right">Updated</span>
          </div>

          {projectRows.map((row, idx) => (
            <Link
              key={row.project.id}
              href={`/projects/${row.project.id}`}
              className={clsx(
                'flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-bg sm:flex-row sm:items-center sm:gap-3',
                idx !== projectRows.length - 1 && 'border-b border-border'
              )}
            >
              {/* Project name + color */}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.project.color }}
                />
                <span className="truncate text-[13px] font-semibold text-text">
                  {row.project.name}
                </span>
                <span
                  className={clsx(
                    'h-2 w-2 shrink-0 rounded-full',
                    row.health === 'green' ? 'bg-green' : row.health === 'yellow' ? 'bg-yellow' : 'bg-red'
                  )}
                />
              </div>

              {/* Mobile stats row */}
              <div className="flex flex-wrap gap-3 text-[11px] sm:hidden">
                <span className="text-muted">{row.progress}% done</span>
                {row.overdue > 0 && <span className="font-semibold text-red">{row.overdue} overdue</span>}
                {row.dueWeek > 0 && <span className="font-semibold text-yellow">{row.dueWeek} this week</span>}
              </div>

              {/* Desktop columns */}
              <div className="hidden w-20 sm:flex sm:flex-col sm:items-center">
                <div className="mb-0.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      row.health === 'green' ? 'bg-green' : row.health === 'yellow' ? 'bg-yellow' : 'bg-red'
                    )}
                    style={{ width: `${row.progress}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted">{row.progress}%</span>
              </div>
              <span className={clsx(
                'hidden w-14 text-center text-[12px] font-semibold tabular-nums sm:block',
                row.overdue > 0 ? 'text-red' : 'text-muted'
              )}>
                {row.overdue}
              </span>
              <span className={clsx(
                'hidden w-16 text-center text-[12px] font-semibold tabular-nums sm:block',
                row.dueWeek > 0 ? 'text-yellow' : 'text-muted'
              )}>
                {row.dueWeek}
              </span>
              <span className="hidden w-16 text-center sm:block">
                <span className="rounded-md bg-bg px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted">
                  {row.project.status}
                </span>
              </span>
              <span className="hidden w-20 text-right text-[11px] text-muted sm:block">
                {row.lastUpdate ? format(new Date(row.lastUpdate), 'MMM d') : '—'}
              </span>
            </Link>
          ))}

          {projectRows.length === 0 && (
            <div className="py-12 text-center text-[13px] text-muted">No projects yet</div>
          )}
        </div>
      )}
    </Shell>
  );
}
