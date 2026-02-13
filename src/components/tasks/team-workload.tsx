'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import type { Task, User, Project } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek } from '@/lib/dates';
import { isAssignedTo } from '@/lib/task-helpers';

interface TeamWorkloadProps {
  tasks: Task[];
  team: User[];
  projects: Project[];
}

export function TeamWorkload({ tasks, team, projects }: TeamWorkloadProps) {
  const [filterProject, setFilterProject] = useState('');

  const workload = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.status !== 'done');
    const filtered = filterProject
      ? activeTasks.filter((t) => t.project_id === filterProject)
      : activeTasks;

    return team
      .filter((u) => u.role === 'staff' || u.role === 'manager')
      .map((member) => {
        const memberTasks = filtered.filter((t) => isAssignedTo(t, member.id));
        const wip = memberTasks.filter((t) => t.status === 'in_progress').length;
        const overdue = memberTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
        const dueSoon = memberTasks.filter(
          (t) => isDueThisWeek(t.due_date) && !isOverdue(t.due_date, t.status)
        ).length;
        const total = memberTasks.length;

        let load: 'low' | 'normal' | 'high' = 'normal';
        if (total > 8 || overdue > 2) load = 'high';
        else if (total <= 2) load = 'low';

        return { member, wip, overdue, dueSoon, total, load };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [tasks, team, filterProject]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-text">Team Workload</h3>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-border bg-card px-2 py-1 text-[13px] font-medium text-muted focus:outline-none focus:ring-1 focus:ring-accent-muted"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="flex-1">Member</span>
          <span className="w-12 text-center">WIP</span>
          <span className="w-14 text-center">Overdue</span>
          <span className="w-14 text-center">Due Soon</span>
          <span className="w-12 text-center">Total</span>
          <span className="w-14 text-center">Load</span>
        </div>

        {workload.map((w, idx) => (
          <div
            key={w.member.id}
            className={clsx(
              'flex items-center gap-3 px-4 py-3',
              idx !== workload.length - 1 && 'border-b border-border'
            )}
          >
            {/* Avatar + name */}
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
                {w.member.full_name.charAt(0)}
              </div>
              <span className="truncate text-sm font-medium text-text">
                {w.member.full_name}
              </span>
            </div>

            <span className="w-12 text-center text-[13px] font-semibold tabular-nums text-blue">
              {w.wip}
            </span>
            <span className={clsx(
              'w-14 text-center text-[13px] font-semibold tabular-nums',
              w.overdue > 0 ? 'text-red' : 'text-muted'
            )}>
              {w.overdue}
            </span>
            <span className={clsx(
              'w-14 text-center text-[13px] font-semibold tabular-nums',
              w.dueSoon > 0 ? 'text-yellow' : 'text-muted'
            )}>
              {w.dueSoon}
            </span>
            <span className="w-12 text-center text-[13px] font-semibold tabular-nums text-text">
              {w.total}
            </span>
            <span className={clsx(
              'w-14 text-center rounded-md px-1.5 py-0.5 text-xs font-semibold',
              w.load === 'high' ? 'bg-red-bg text-red' :
              w.load === 'low' ? 'bg-green-bg text-green' : 'bg-blue-bg text-blue'
            )}>
              {w.load === 'high' ? 'Heavy' : w.load === 'low' ? 'Light' : 'Normal'}
            </span>
          </div>
        ))}

        {workload.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">No team members found</div>
        )}
      </div>
    </div>
  );
}
