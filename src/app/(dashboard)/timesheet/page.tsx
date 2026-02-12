'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Shell } from '@/components/layout/shell';
import { useUser } from '@/hooks/use-user';
import { useProjects } from '@/hooks/use-projects';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';

interface TimeLogEntry {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  meta: { date: string; hours: number };
  created_at: string;
  task?: {
    id: string;
    title: string;
    project_id: string;
    project?: { id: string; name: string; color: string };
  };
}

export default function TimesheetPage() {
  const { user } = useUser();
  const { projects } = useProjects();
  const supabase = createClient();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const swrKey = user
    ? `timesheet-auto-${user.id}-${format(weekStart, 'yyyy-MM-dd')}`
    : null;

  const { data: entries = [] } = useSWR<TimeLogEntry[]>(
    swrKey,
    async () => {
      if (!user) return [];

      // Fetch time_logged activity entries for the current user in this week
      const { data, error } = await supabase
        .from('task_activity')
        .select('id, task_id, user_id, action, meta, created_at, task:tasks(id, title, project_id, project:projects(id, name, color))')
        .eq('user_id', user.id)
        .eq('action', 'time_logged')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Timesheet fetch:', error.message);
        return [];
      }

      // Filter by date range client-side (meta.date is a JSONB field)
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      // Supabase returns joined rows as arrays; normalize to single objects
      const normalized = (data as unknown as TimeLogEntry[]).map((e) => ({
        ...e,
        task: Array.isArray(e.task) ? e.task[0] : e.task,
      }));

      return normalized.filter((e) => {
        const d = e.meta?.date;
        return d && d >= weekStartStr && d <= weekEndStr;
      });
    },
    { revalidateOnFocus: false }
  );

  // Group entries by project
  const projectRows = useMemo(() => {
    const map = new Map<
      string,
      { projectId: string; projectName: string; projectColor: string; entries: TimeLogEntry[] }
    >();

    for (const e of entries) {
      const task = e.task as TimeLogEntry['task'];
      const project = task?.project;
      const pid = project?.id ?? task?.project_id ?? 'unknown';
      if (!map.has(pid)) {
        map.set(pid, {
          projectId: pid,
          projectName: project?.name ?? projects.find((p) => p.id === pid)?.name ?? 'Unknown',
          projectColor: project?.color ?? projects.find((p) => p.id === pid)?.color ?? '#6b7280',
          entries: [],
        });
      }
      map.get(pid)!.entries.push(e);
    }

    return Array.from(map.values());
  }, [entries, projects]);

  // Daily and weekly totals
  const dailyTotals = useMemo(
    () =>
      weekDays.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return entries
          .filter((e) => e.meta?.date === dayStr)
          .reduce((sum, e) => sum + (e.meta?.hours ?? 0), 0);
      }),
    [entries, weekDays]
  );

  const weekTotal = dailyTotals.reduce((sum, h) => sum + h, 0);

  // Task breakdown for the current week
  const taskBreakdown = useMemo(() => {
    const map = new Map<string, { taskTitle: string; projectName: string; projectColor: string; totalHours: number }>();
    for (const e of entries) {
      const task = e.task as TimeLogEntry['task'];
      const tid = e.task_id;
      if (!map.has(tid)) {
        map.set(tid, {
          taskTitle: task?.title ?? 'Unknown',
          projectName: task?.project?.name ?? 'Unknown',
          projectColor: task?.project?.color ?? '#6b7280',
          totalHours: 0,
        });
      }
      map.get(tid)!.totalHours += e.meta?.hours ?? 0;
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries]);

  const isToday = (day: Date) => isSameDay(day, new Date());

  function getHoursForCell(projectId: string, day: Date) {
    const dayStr = format(day, 'yyyy-MM-dd');
    return entries
      .filter((e) => {
        const task = e.task as TimeLogEntry['task'];
        const pid = task?.project?.id ?? task?.project_id;
        return pid === projectId && e.meta?.date === dayStr;
      })
      .reduce((sum, e) => sum + (e.meta?.hours ?? 0), 0);
  }

  if (!user) {
    return (
      <Shell title="Timesheet" subtitle="Auto-tracked from tasks">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Timesheet" subtitle="Auto-tracked from tasks">
      <div className="space-y-6">
        {/* Week navigator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <h2 className="text-[14px] font-bold text-text">
              {format(weekStart, 'MMM d')} &ndash; {format(weekEnd, 'MMM d, yyyy')}
            </h2>
          </div>
          <button
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
          >
            This Week
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent-muted px-4 py-3 text-[12px] text-accent">
          <ClockIcon className="h-4 w-4 shrink-0" />
          <p>
            Time is automatically tracked when you mark tasks as <strong>Done</strong>.
            You review and adjust hours before each completion.
          </p>
        </div>

        {/* Timesheet Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-x-auto rounded-2xl border border-border bg-card"
        >
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                <th className="w-44 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Project
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={clsx(
                      'px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide',
                      isToday(day) ? 'text-accent' : 'text-muted'
                    )}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div
                      className={clsx(
                        'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
                        isToday(day) ? 'bg-accent text-white' : ''
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {projectRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[13px] text-muted"
                  >
                    No tracked time this week. Complete tasks to see your hours here.
                  </td>
                </tr>
              )}
              {projectRows.map(({ projectId, projectName, projectColor, entries: rowEntries }) => {
                const rowTotal = rowEntries.reduce(
                  (sum, e) => sum + (e.meta?.hours ?? 0),
                  0
                );
                return (
                  <tr
                    key={projectId}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: projectColor }}
                        />
                        <span className="truncate text-[12px] font-medium text-text">
                          {projectName}
                        </span>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const hours = getHoursForCell(projectId, day);
                      return (
                        <td
                          key={day.toISOString()}
                          className="px-2 py-2.5 text-center"
                        >
                          {hours > 0 ? (
                            <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-accent-muted text-[12px] font-semibold text-accent">
                              {hours}h
                            </span>
                          ) : (
                            <span className="text-muted/20">&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center text-[12px] font-bold text-text">
                      {rowTotal}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-bg/50">
                <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Daily Total
                </td>
                {dailyTotals.map((total, i) => (
                  <td
                    key={i}
                    className="px-2 py-2.5 text-center text-[12px] font-bold text-text"
                  >
                    {total > 0 ? `${total}h` : '\u2014'}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-lg bg-accent px-2.5 py-0.5 text-[12px] font-bold text-white">
                    {weekTotal}h
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </motion.div>

        {/* Task breakdown */}
        {taskBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="text-[14px] font-bold text-text">Task Breakdown</h3>
            <p className="mt-1 text-[12px] text-muted">
              Hours logged per completed task this week
            </p>
            <div className="mt-4 divide-y divide-border">
              {taskBreakdown.map((row, i) => {
                const pct = weekTotal > 0 ? (row.totalHours / weekTotal) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.projectColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-text">
                        {row.taskTitle}
                      </p>
                      <p className="text-[11px] text-muted">{row.projectName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden w-24 sm:block">
                        <div className="h-1.5 w-full rounded-full bg-bg">
                          <div
                            className="h-1.5 rounded-full bg-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 text-right text-[12px] font-bold text-text">
                        {row.totalHours}h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Weekly summary cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Total Hours
            </p>
            <p className="mt-1 text-2xl font-bold text-text">{weekTotal}h</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Projects
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {projectRows.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Avg / Day
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {weekTotal > 0 ? (weekTotal / 5).toFixed(1) : '0'}h
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Tasks Logged
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {taskBreakdown.length}
            </p>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
