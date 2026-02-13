'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import type { Task, User, Project, TaskStatus } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';
import { subDays, isAfter, parseISO } from 'date-fns';
import { TaskDetailDrawer } from '@/components/operations/task-detail-drawer';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { useTeam } from '@/hooks/use-team';
import type { TimeEntry } from '@/components/tasks/time-review-dialog';

type TabKey = 'today' | 'week' | 'overdue' | 'all';

interface StaffDashboardProps {
  tasks: Task[];
  currentUser: User;
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, userId: string, timeEntries: TimeEntry[]) => Promise<void>;
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
  onDeleteTask,
  onCompleteTask,
}: StaffDashboardProps) {
  const [tab, setTab] = useState<TabKey>('today');
  // Store ID instead of full task object to avoid stale references
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { team } = useTeam();

  // Derive selected task from latest tasks array
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignee_id === currentUser.id && t.status !== 'done'),
    [tasks, currentUser.id]
  );

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
    { label: 'Due Today', value: kpis.dueToday, color: kpis.dueToday > 0 ? 'text-yellow' : 'text-green', icon: CalendarIcon, iconBg: 'bg-yellow-bg', iconColor: 'text-yellow' },
    { label: 'Overdue', value: kpis.overdue, color: kpis.overdue > 0 ? 'text-red' : 'text-green', icon: ExclamationCircleIcon, iconBg: 'bg-red-bg', iconColor: 'text-red' },
    { label: 'In Progress', value: kpis.inProgress, color: 'text-blue', icon: ArrowPathIcon, iconBg: 'bg-blue-bg', iconColor: 'text-blue' },
    { label: 'Done (7d)', value: `${kpis.completionRate}%`, color: kpis.completionRate >= 70 ? 'text-green' : kpis.completionRate >= 40 ? 'text-yellow' : 'text-red', icon: CheckCircleIcon, iconBg: 'bg-green-bg', iconColor: 'text-green' },
  ];

  return (
    <div className="space-y-8">
      {/* My KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={cn('rounded-lg p-1.5', c.iconBg)}>
                <c.icon className={cn('h-4 w-4', c.iconColor)} />
              </div>
            </div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums tracking-tight', c.color)}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* My Work */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <h3 className="mb-4 text-base font-bold text-text">My Work</h3>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'relative px-3 py-2 text-[13px] font-semibold transition-colors',
                tab === t.key ? 'text-accent' : 'text-muted hover:text-text'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    'ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold',
                    tab === t.key ? 'bg-accent-muted text-accent' : 'bg-bg text-muted'
                  )}
                >
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <motion.span
                  layoutId="staff-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Compact task rows */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No tasks here"
            description="Nice work! Nothing to show in this view."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card">
            {filtered.map((task, idx) => {
              const overdue = isOverdue(task.due_date, task.status);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    'flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-bg sm:flex-nowrap',
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
                    className={cn(
                      'h-6 shrink-0 cursor-pointer rounded-md border-0 px-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-accent-muted',
                      task.status === 'in_progress' ? 'bg-blue-bg text-blue' :
                      task.status === 'blocked' ? 'bg-red-bg text-red' : 'bg-bg text-muted'
                    )}
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>

                  {/* Priority dot — inline on mobile before title wraps */}
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full sm:order-none',
                      task.priority === 'high' ? 'bg-red' : task.priority === 'medium' ? 'bg-yellow' : 'bg-blue'
                    )}
                  />

                  {/* Title + description: full width on mobile */}
                  <div className="order-last w-full min-w-0 pl-[calc(4px+0.75rem)] sm:order-none sm:w-auto sm:flex-1 sm:pl-0">
                    <p className="text-sm font-medium text-text sm:truncate">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs leading-relaxed text-muted line-clamp-2 sm:truncate sm:leading-normal">
                        {task.description}
                      </p>
                    )}
                    {/* Mobile-only: due date below title */}
                    {task.due_date && (
                      <span
                        className={cn(
                          'mt-0.5 block text-xs tabular-nums sm:hidden',
                          overdue ? 'font-semibold text-red' : 'text-muted'
                        )}
                      >
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Assignee avatar — desktop only */}
                  {task.assignee && (
                    <div className="hidden sm:block">
                      <Avatar name={task.assignee.full_name} src={task.assignee.avatar_url} size="sm" />
                    </div>
                  )}

                  {/* Due date — desktop only */}
                  {task.due_date && (
                    <span
                      className={cn(
                        'hidden shrink-0 text-[13px] tabular-nums sm:block',
                        overdue ? 'font-semibold text-red' : 'text-muted'
                      )}
                    >
                      {formatDate(task.due_date)}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        currentUser={currentUser}
        team={team}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onCompleteTask={onCompleteTask}
      />
    </div>
  );
}
