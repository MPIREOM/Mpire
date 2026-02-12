'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import type { Task, User, Project, TaskStatus } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';
import { subDays, isAfter, parseISO } from 'date-fns';
import { TaskDetailDrawer } from '@/components/operations/task-detail-drawer';
import { useTeam } from '@/hooks/use-team';

type TabKey = 'today' | 'week' | 'overdue' | 'all';

interface StaffDashboardProps {
  tasks: Task[];
  currentUser: User;
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

export function StaffDashboard({
  tasks,
  currentUser,
  projects,
  onUpdateTask,
}: StaffDashboardProps) {
  const [tab, setTab] = useState<TabKey>('today');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { team } = useTeam();

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentUser.id && t.status !== 'done'),
    [tasks, currentUser.id]
  );

  // KPIs for me
  const kpis = useMemo(() => {
    const dueToday = myTasks.filter((t) => isDueToday(t.due_date)).length;
    const overdue = myTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const inProgress = myTasks.filter((t) => t.status === 'in_progress').length;
    const cutoff = subDays(new Date(), 7);
    const myAllTasks = tasks.filter((t) => t.assignee_id === currentUser.id);
    const windowTasks = myAllTasks.filter(
      (t) => t.due_date && isAfter(parseISO(t.due_date), cutoff)
    );
    const windowDone = windowTasks.filter((t) => t.status === 'done').length;
    const completionRate =
      windowTasks.length > 0 ? Math.round((windowDone / windowTasks.length) * 100) : 0;
    return { dueToday, overdue, inProgress, completionRate };
  }, [myTasks, tasks, currentUser.id]);

  // Tab filtering
  const filtered = useMemo(() => {
    switch (tab) {
      case 'today':
        return myTasks.filter((t) => isDueToday(t.due_date));
      case 'week':
        return myTasks.filter((t) => isDueThisWeek(t.due_date));
      case 'overdue':
        return myTasks.filter((t) => isOverdue(t.due_date, t.status));
      case 'all':
        return myTasks;
    }
  }, [myTasks, tab]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: kpis.dueToday },
    { key: 'week', label: 'This Week', count: myTasks.filter((t) => isDueThisWeek(t.due_date)).length },
    { key: 'overdue', label: 'Overdue', count: kpis.overdue },
    { key: 'all', label: 'All', count: myTasks.length },
  ];

  const kpiCards = [
    { label: 'Due Today', value: kpis.dueToday, color: kpis.dueToday > 0 ? 'text-yellow' : 'text-green' },
    { label: 'Overdue', value: kpis.overdue, color: kpis.overdue > 0 ? 'text-red' : 'text-green' },
    { label: 'In Progress', value: kpis.inProgress, color: 'text-blue' },
    { label: 'Done (7d)', value: `${kpis.completionRate}%`, color: kpis.completionRate >= 70 ? 'text-green' : kpis.completionRate >= 40 ? 'text-yellow' : 'text-red' },
  ];

  return (
    <div className="space-y-6">
      {/* My KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
            <p className={clsx('text-2xl font-bold tabular-nums', c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* My Work */}
      <div>
        <h3 className="mb-3 text-[13px] font-bold text-text">My Work</h3>

        {/* Tabs */}
        <div className="mb-3 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'relative px-3 py-2 text-[12px] font-semibold transition-colors',
                tab === t.key ? 'text-accent' : 'text-muted hover:text-text'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={clsx(
                    'ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                    tab === t.key ? 'bg-accent-muted text-accent' : 'bg-bg text-muted'
                  )}
                >
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Compact task rows */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-muted">No tasks here — nice work!</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            {filtered.map((task, idx) => {
              const overdue = isOverdue(task.due_date, task.status);
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg',
                    idx !== filtered.length - 1 && 'border-b border-border'
                  )}
                >
                  {/* Project color stripe */}
                  <div
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: task.project?.color ?? '#6b7280' }}
                  />

                  {/* Status select */}
                  <select
                    value={task.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateTask(task.id, { status: e.target.value as TaskStatus });
                    }}
                    className={clsx(
                      'h-6 shrink-0 cursor-pointer rounded-md border-0 px-1 text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-accent-muted',
                      task.status === 'in_progress' ? 'bg-blue-bg text-blue' :
                      task.status === 'blocked' ? 'bg-red-bg text-red' : 'bg-bg text-muted'
                    )}
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>

                  {/* Title */}
                  <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-text">
                    {task.title}
                  </p>

                  {/* Priority dot */}
                  <span
                    className={clsx(
                      'h-2 w-2 shrink-0 rounded-full',
                      task.priority === 'high' ? 'bg-red' : task.priority === 'medium' ? 'bg-yellow' : 'bg-blue'
                    )}
                  />

                  {/* Due date */}
                  {task.due_date && (
                    <span
                      className={clsx(
                        'shrink-0 text-[11px] tabular-nums',
                        overdue ? 'font-semibold text-red' : 'text-muted'
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
      </div>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUser={currentUser}
        team={team}
        onUpdateTask={onUpdateTask}
      />
    </div>
  );
}
