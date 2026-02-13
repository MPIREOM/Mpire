'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { Task, User, Project } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';
import { isAssignedTo } from '@/lib/task-helpers';
import { Badge } from '@/components/ui/badge';

interface TeamWorkloadProps {
  tasks: Task[];
  team: User[];
  projects: Project[];
}

const COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function TeamWorkload({ tasks, team, projects }: TeamWorkloadProps) {
  const [filterProject, setFilterProject] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

        return { member, wip, overdue, dueSoon, total, load, tasks: memberTasks };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);
  }, [tasks, team, filterProject]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
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

      <div className="space-y-3">
        {workload.map((w, idx) => {
          const expanded = expandedIds.has(w.member.id);
          return (
            <motion.div
              key={w.member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="rounded-xl border border-border bg-card"
            >
              {/* Member header row */}
              <button
                onClick={() => toggleExpand(w.member.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg/50"
              >
                {/* Avatar */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: avatarColor(w.member.full_name) }}
                >
                  {w.member.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>

                {/* Name + role */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{w.member.full_name}</p>
                  <p className="text-xs capitalize text-muted">{w.member.role}</p>
                </div>

                {/* Stats chips */}
                <div className="flex items-center gap-2">
                  {w.overdue > 0 && (
                    <span className="rounded-md bg-red-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-red">
                      {w.overdue} overdue
                    </span>
                  )}
                  <span className="rounded-md bg-blue-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-blue">
                    {w.wip} WIP
                  </span>
                  {w.dueSoon > 0 && (
                    <span className="hidden rounded-md bg-yellow-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-yellow sm:inline-flex">
                      {w.dueSoon} due soon
                    </span>
                  )}
                  <span className="rounded-md bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">
                    {w.total} total
                  </span>

                  {/* Load badge */}
                  <Badge
                    variant={
                      w.load === 'high' ? 'danger' :
                      w.load === 'low' ? 'success' : 'info'
                    }
                  >
                    {w.load === 'high' ? 'Heavy' : w.load === 'low' ? 'Light' : 'Normal'}
                  </Badge>

                  {/* Expand chevron */}
                  {w.total > 0 && (
                    expanded
                      ? <ChevronUpIcon className="h-4 w-4 shrink-0 text-muted" />
                      : <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
                  )}
                </div>
              </button>

              {/* Expanded task list */}
              {expanded && w.tasks.length > 0 && (
                <div className="border-t border-border">
                  {w.tasks.map((task, tIdx) => {
                    const taskOverdue = isOverdue(task.due_date, task.status);
                    return (
                      <div
                        key={task.id}
                        className={clsx(
                          'flex items-center gap-3 px-4 py-2.5 pl-16',
                          tIdx !== w.tasks.length - 1 && 'border-b border-border/50'
                        )}
                      >
                        {/* Project color */}
                        <div
                          className="h-5 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: task.project?.color ?? '#6b7280' }}
                        />

                        {/* Status */}
                        <span
                          className={clsx(
                            'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                            task.status === 'in_progress' ? 'bg-blue-bg text-blue' :
                            task.status === 'blocked' ? 'bg-red-bg text-red' : 'bg-bg text-muted'
                          )}
                        >
                          {task.status === 'in_progress' ? 'WIP' :
                           task.status === 'blocked' ? 'Blocked' : 'To Do'}
                        </span>

                        {/* Title */}
                        <span className="min-w-0 flex-1 truncate text-sm text-text">
                          {task.title}
                        </span>

                        {/* Priority */}
                        <span
                          className={clsx(
                            'h-2 w-2 shrink-0 rounded-full',
                            task.priority === 'high' ? 'bg-red' :
                            task.priority === 'medium' ? 'bg-yellow' : 'bg-blue'
                          )}
                          title={task.priority}
                        />

                        {/* Project name */}
                        <span className="hidden shrink-0 text-xs text-muted sm:block">
                          {task.project?.name}
                        </span>

                        {/* Due date */}
                        {task.due_date && (
                          <span
                            className={clsx(
                              'shrink-0 text-xs tabular-nums',
                              taskOverdue ? 'font-semibold text-red' : 'text-muted'
                            )}
                          >
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {expanded && w.tasks.length === 0 && (
                <div className="border-t border-border px-4 py-4 text-center text-xs text-muted">
                  No tasks assigned
                </div>
              )}
            </motion.div>
          );
        })}

        {workload.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted">
            No team members found
          </div>
        )}
      </div>
    </div>
  );
}
