'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Shell } from '@/components/layout/shell';
import { useUser } from '@/hooks/use-user';
import { useProjects } from '@/hooks/use-projects';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from 'date-fns';

interface TimesheetEntry {
  id: string;
  user_id: string;
  project_id: string;
  date: string;
  hours: number;
  description: string | null;
  created_at: string;
}

export default function TimesheetPage() {
  const { user } = useUser();
  const { projects } = useProjects();
  const supabase = createClient();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [editingEntry, setEditingEntry] = useState<{
    projectId: string;
    date: string;
    hours: string;
    description: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const swrKey = user ? `timesheet-${user.id}-${format(weekStart, 'yyyy-MM-dd')}` : null;

  const { data: entries = [], mutate } = useSWR<TimesheetEntry[]>(
    swrKey,
    async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });
      if (error) {
        // Table may not exist yet — return empty
        console.warn('Timesheet fetch:', error.message);
        return [];
      }
      return data as TimesheetEntry[];
    },
    { revalidateOnFocus: false }
  );

  // Group entries by project
  const projectRows = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    for (const e of entries) {
      if (!map.has(e.project_id)) map.set(e.project_id, []);
      map.get(e.project_id)!.push(e);
    }
    return Array.from(map.entries()).map(([projectId, entries]) => ({
      projectId,
      project: projects.find((p) => p.id === projectId),
      entries,
    }));
  }, [entries, projects]);

  // Calculate totals per day
  const dailyTotals = useMemo(() => {
    return weekDays.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return entries
        .filter((e) => e.date === dayStr)
        .reduce((sum, e) => sum + e.hours, 0);
    });
  }, [entries, weekDays]);

  const weekTotal = dailyTotals.reduce((sum, h) => sum + h, 0);

  const getHoursForCell = useCallback(
    (projectId: string, day: Date) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return entries
        .filter((e) => e.project_id === projectId && e.date === dayStr)
        .reduce((sum, e) => sum + e.hours, 0);
    },
    [entries]
  );

  async function handleSaveEntry() {
    if (!editingEntry || !user) return;
    const hours = parseFloat(editingEntry.hours);
    if (isNaN(hours) || hours <= 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('timesheet_entries').insert({
        user_id: user.id,
        project_id: editingEntry.projectId,
        date: editingEntry.date,
        hours,
        description: editingEntry.description || null,
      });
      if (error) throw error;
      setEditingEntry(null);
      mutate();
    } catch (err) {
      console.error('Failed to save timesheet entry:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    const { error } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('id', entryId);
    if (error) console.error('Delete error:', error.message);
    mutate();
  }

  if (!user) {
    return (
      <Shell title="Timesheet" subtitle="Track your hours">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  const isToday = (day: Date) => isSameDay(day, new Date());

  return (
    <Shell title="Timesheet" subtitle="Track your hours">
      <div className="space-y-4">
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
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </h2>
          </div>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
          >
            This Week
          </button>
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
                <th className="w-40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
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
                    <div className={clsx(
                      'mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px]',
                      isToday(day) ? 'bg-accent text-white' : ''
                    )}>
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
                  <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-muted">
                    No time entries this week. Click the + button to add your first entry.
                  </td>
                </tr>
              )}
              {projectRows.map(({ projectId, project, entries: rowEntries }) => {
                const rowTotal = rowEntries.reduce((sum, e) => sum + e.hours, 0);
                return (
                  <tr key={projectId} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project?.color ?? '#6b7280' }}
                        />
                        <span className="truncate text-[12px] font-medium text-text">
                          {project?.name ?? 'Unknown'}
                        </span>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const hours = getHoursForCell(projectId, day);
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayEntries = rowEntries.filter((e) => e.date === dayStr);
                      return (
                        <td key={day.toISOString()} className="px-2 py-2.5 text-center">
                          {hours > 0 ? (
                            <div className="group relative">
                              <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-accent-muted text-[12px] font-semibold text-accent">
                                {hours}h
                              </span>
                              <button
                                onClick={() => {
                                  if (dayEntries[0]) handleDeleteEntry(dayEntries[0].id);
                                }}
                                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red text-white group-hover:flex"
                              >
                                <TrashIcon className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setEditingEntry({
                                  projectId,
                                  date: dayStr,
                                  hours: '',
                                  description: '',
                                })
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted/30 transition-colors hover:bg-bg hover:text-muted"
                            >
                              +
                            </button>
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
                  <td key={i} className="px-2 py-2.5 text-center text-[12px] font-bold text-text">
                    {total > 0 ? `${total}h` : '—'}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-lg bg-accent px-2 py-0.5 text-[12px] font-bold text-white">
                    {weekTotal}h
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </motion.div>

        {/* Quick-add row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-dashed border-border bg-card p-4"
        >
          <p className="mb-3 text-[12px] font-semibold text-muted">Quick Add Entry</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Project</label>
              <select
                value={editingEntry?.projectId ?? ''}
                onChange={(e) =>
                  setEditingEntry((prev) => ({
                    projectId: e.target.value,
                    date: prev?.date ?? format(new Date(), 'yyyy-MM-dd'),
                    hours: prev?.hours ?? '',
                    description: prev?.description ?? '',
                  }))
                }
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Date</label>
              <input
                type="date"
                value={editingEntry?.date ?? format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) =>
                  setEditingEntry((prev) => ({
                    projectId: prev?.projectId ?? '',
                    date: e.target.value,
                    hours: prev?.hours ?? '',
                    description: prev?.description ?? '',
                  }))
                }
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
              />
            </div>
            <div className="w-20">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={editingEntry?.hours ?? ''}
                onChange={(e) =>
                  setEditingEntry((prev) => ({
                    projectId: prev?.projectId ?? '',
                    date: prev?.date ?? format(new Date(), 'yyyy-MM-dd'),
                    hours: e.target.value,
                    description: prev?.description ?? '',
                  }))
                }
                placeholder="0"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
              />
            </div>
            <div className="min-w-[120px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Note</label>
              <input
                type="text"
                value={editingEntry?.description ?? ''}
                onChange={(e) =>
                  setEditingEntry((prev) => ({
                    projectId: prev?.projectId ?? '',
                    date: prev?.date ?? format(new Date(), 'yyyy-MM-dd'),
                    hours: prev?.hours ?? '',
                    description: e.target.value,
                  }))
                }
                placeholder="What did you work on?"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
              />
            </div>
            <Button
              onClick={handleSaveEntry}
              loading={saving}
              disabled={!editingEntry?.projectId || !editingEntry?.hours}
              size="sm"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </motion.div>

        {/* Weekly summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total Hours</p>
            <p className="mt-1 text-2xl font-bold text-text">{weekTotal}h</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Projects</p>
            <p className="mt-1 text-2xl font-bold text-text">{projectRows.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Avg / Day</p>
            <p className="mt-1 text-2xl font-bold text-text">
              {weekTotal > 0 ? (weekTotal / 5).toFixed(1) : '0'}h
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Entries</p>
            <p className="mt-1 text-2xl font-bold text-text">{entries.length}</p>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
