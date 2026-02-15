'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Shell } from '@/components/layout/shell';
import { TaskTable } from '@/components/tasks/task-table';
import { ProjectFinanceTab } from '@/components/finance/project-finance-tab';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { useUser } from '@/hooks/use-user';
import { useTeam } from '@/hooks/use-team';
import { isOverdue, isDueToday, isDueThisWeek } from '@/lib/dates';
import { canAccessFinance } from '@/lib/roles';

type Tab = 'overview' | 'tasks' | 'finance';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { tasks, updateTask, createTaskWithAssignees, setTaskAssignees, deleteTask, completeTask } = useTasks({ projectId: id });
  const { user } = useUser();
  const { team } = useTeam();
  const [tab, setTab] = useState<Tab>('overview');

  const project = projects.find((p) => p.id === id);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const dueToday = tasks.filter((t) => isDueToday(t.due_date) && t.status !== 'done').length;
    const dueWeek = tasks.filter((t) => isDueThisWeek(t.due_date) && t.status !== 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, overdue, dueToday, dueWeek, inProgress, blocked, progress };
  }, [tasks]);

  if (!project || !user) {
    return (
      <Shell title="Project" subtitle="Loading...">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  const showFinance = canAccessFinance(user.role);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: `Tasks (${stats.total})` },
    ...(showFinance ? [{ key: 'finance' as Tab, label: 'Finance' }] : []),
  ];

  return (
    <Shell title={project.name} subtitle={`Project · ${project.status}`}>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-text"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          All Projects
        </Link>

        {/* Header card */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h2 className="text-lg font-bold text-text">{project.name}</h2>
            <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
              {project.status}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-bg">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                stats.overdue > 0 ? 'bg-red' : stats.progress < 30 ? 'bg-yellow' : 'bg-green'
              )}
              style={{ width: `${stats.progress}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-[11px]">
            <span className="text-muted"><strong className="text-text font-semibold">{stats.progress}%</strong> complete</span>
            <span className="text-muted"><strong className="text-text font-semibold">{stats.total}</strong> total tasks</span>
            <span className="text-muted"><strong className="text-blue font-semibold">{stats.inProgress}</strong> in progress</span>
            {stats.overdue > 0 && <span className="font-semibold text-red">{stats.overdue} overdue</span>}
            {stats.dueToday > 0 && <span className="font-semibold text-yellow">{stats.dueToday} due today</span>}
            {stats.blocked > 0 && <span className="font-semibold text-red">{stats.blocked} blocked</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'relative px-4 py-2 text-[12px] font-semibold transition-colors',
                tab === t.key ? 'text-accent' : 'text-muted hover:text-text'
              )}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Done', value: stats.done, color: 'text-green' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-blue' },
              { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red' : 'text-muted' },
              { label: 'Due This Week', value: stats.dueWeek, color: stats.dueWeek > 0 ? 'text-yellow' : 'text-muted' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={clsx('text-2xl font-bold tabular-nums', c.color)}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <TaskTable
            tasks={tasks}
            currentUser={user}
            team={team}
            projects={projects}
            onUpdateTask={updateTask}
            onCreateTaskWithAssignees={createTaskWithAssignees}
            onSetAssignees={setTaskAssignees}
            onDeleteTask={deleteTask}
            onCompleteTask={completeTask}
          />
        )}

        {tab === 'finance' && showFinance && (
          <ProjectFinanceTab />
        )}
      </div>
    </Shell>
  );
}
