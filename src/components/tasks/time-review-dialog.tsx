'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  eachDayOfInterval,
  format,
  differenceInCalendarDays,
  startOfDay,
  subDays,
} from 'date-fns';
import type { Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ClockIcon, CalendarDaysIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface TimeEntry {
  date: string; // YYYY-MM-DD
  hours: number;
}

interface TimeReviewDialogProps {
  task: Task | null;
  open: boolean;
  onConfirm: (taskId: string, entries: TimeEntry[]) => void;
  onCancel: () => void;
}

interface DayRow {
  date: Date;
  dateStr: string;
  dayLabel: string;
  enabled: boolean;
  hours: number;
}

export function TimeReviewDialog({ task, open, onConfirm, onCancel }: TimeReviewDialogProps) {
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultHours, setDefaultHours] = useState(8);
  const [startDate, setStartDate] = useState<Date | null>(null);

  // Build day list from task creation date to today
  useEffect(() => {
    if (!open || !task) return;
    setLoading(true);
    setSaving(false);

    const start = startOfDay(new Date(task.created_at));
    setStartDate(start);

    const end = startOfDay(new Date());
    const totalDays = differenceInCalendarDays(end, start);

    // Cap at 30 days to keep dialog manageable
    const effectiveStart = totalDays > 30 ? subDays(end, 30) : start;

    const interval = eachDayOfInterval({ start: effectiveStart, end });
    const rows: DayRow[] = interval.map((date) => ({
      date,
      dateStr: format(date, 'yyyy-MM-dd'),
      dayLabel: format(date, 'EEE, MMM d'),
      enabled: true,
      hours: defaultHours,
    }));

    setDays(rows);
    setLoading(false);
  }, [open, task]);

  const totalHours = useMemo(
    () => days.filter((d) => d.enabled).reduce((sum, d) => sum + d.hours, 0),
    [days]
  );
  const workingDays = days.filter((d) => d.enabled).length;

  function toggleDay(index: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === index ? { ...d, enabled: !d.enabled, hours: d.enabled ? 0 : defaultHours } : d
      )
    );
  }

  function updateHours(index: number, hours: number) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === index ? { ...d, hours: Math.max(0, Math.min(24, hours)) } : d
      )
    );
  }

  function applyDefaultHours(hours: number) {
    setDefaultHours(hours);
    setDays((prev) => prev.map((d) => (d.enabled ? { ...d, hours } : d)));
  }

  function handleConfirm() {
    if (!task) return;
    setSaving(true);
    const entries = days
      .filter((d) => d.enabled && d.hours > 0)
      .map((d) => ({ date: d.dateStr, hours: d.hours }));
    onConfirm(task.id, entries);
  }

  return (
    <Dialog open={open} onClose={onCancel} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-[15px] font-bold text-text">
              <ClockIcon className="h-5 w-5 text-accent" />
              Review Time Before Completing
            </DialogTitle>
            <p className="mt-1.5 text-[12px] text-muted">
              Adjust the hours you spent on{' '}
              <span className="font-semibold text-text">&ldquo;{task?.title}&rdquo;</span>{' '}
              before marking it as done.
            </p>
            {startDate && !loading && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-[11px] text-muted">
                <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
                Created {format(startDate, 'MMM d, yyyy')} &rarr; Today ({days.length} days)
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Default hours control */}
              <div className="flex items-center gap-3 border-t border-border px-6 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Default hrs/day
                </span>
                <div className="flex gap-1">
                  {[2, 4, 6, 8].map((h) => (
                    <button
                      key={h}
                      onClick={() => applyDefaultHours(h)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        defaultHours === h
                          ? 'bg-accent text-white'
                          : 'bg-bg text-muted hover:text-text'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setDays((prev) =>
                      prev.map((d) => ({
                        ...d,
                        enabled: true,
                        hours: defaultHours,
                      }))
                    );
                  }}
                  className="ml-auto text-[11px] font-medium text-accent hover:text-accent-light"
                >
                  Reset
                </button>
              </div>

              {/* Day rows */}
              <div className="max-h-64 overflow-y-auto border-t border-border">
                {days.map((day, i) => (
                  <div
                    key={day.dateStr}
                    className={`flex items-center gap-3 border-b border-border px-6 py-2 last:border-b-0 transition-opacity ${
                      !day.enabled ? 'opacity-40' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleDay(i)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        day.enabled
                          ? 'border-accent bg-accent text-white'
                          : 'border-border hover:border-accent'
                      }`}
                    >
                      {day.enabled && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <span className="flex-1 text-[12px] font-medium text-text">
                      {day.dayLabel}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={day.hours || ''}
                      onChange={(e) => updateHours(i, parseFloat(e.target.value) || 0)}
                      disabled={!day.enabled}
                      className="w-16 rounded-lg border border-border bg-bg px-2 py-1 text-center text-[12px] font-medium text-text focus:border-accent focus:outline-none disabled:opacity-50"
                    />
                    <span className="w-5 text-[11px] text-muted">hrs</span>
                  </div>
                ))}
              </div>

              {/* Summary footer */}
              <div className="flex items-center justify-between border-t border-border p-6">
                <div className="space-y-0.5">
                  <p className="text-[14px] font-bold text-text">{totalHours}h total</p>
                  <p className="text-[11px] text-muted">{workingDays} days</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
                  >
                    Cancel
                  </button>
                  <Button onClick={handleConfirm} loading={saving} size="sm">
                    Complete &amp; Log {totalHours}h
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
