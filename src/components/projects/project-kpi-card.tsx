'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { ProjectMetrics } from '@/lib/project-utils';
import {
  getStatusBadgeVariant,
  getPriorityColor,
  getProgressColor,
  getProgressRawColor,
} from '@/lib/project-utils';
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  NoSymbolIcon,
  CalendarIcon,
  ArrowRightIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface ProjectKPICardProps {
  metrics: ProjectMetrics;
  onDelete?: () => void;
}

/* ── Animated count-up ── */
function AnimatedNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const dur = 750;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (end - start) * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    prev.current = value;
  }, [value]);
  return (
    <span className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

/* ── SVG Completion ring (compact) ── */
function CompletionRing({
  percent,
  color,
  delay = 0,
}: {
  percent: number;
  color: string;
  delay?: number;
}) {
  const r = 14;
  const stroke = 2.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={34} height={34} viewBox="0 0 34 34" className="-rotate-90">
        <circle
          cx={17} cy={17} r={r}
          fill="none" stroke="currentColor" strokeWidth={stroke}
          className="text-border/50"
        />
        <motion.circle
          cx={17} cy={17} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ delay, duration: 1.25, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums text-text">{percent}%</span>
    </div>
  );
}

/* ── Mini SVG sparkline ── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.every((v) => v === 0)) return null;
  const max = Math.max(...data, 1);
  const h = 20;
  const w = 56;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Avatar stack ── */
function TeamAvatars({ metrics }: { metrics: ProjectMetrics }) {
  const shown = metrics.assignees.slice(0, 4);
  const extra = metrics.assignees.length - shown.length;
  if (shown.length === 0) return <span className="text-[11px] text-muted">No assignees</span>;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {shown.map((u) => (
          <div key={u.id} className="relative" title={u.full_name}>
            <Avatar name={u.full_name} src={u.avatar_url} size="sm" className="ring-2 ring-card" />
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-1.5 text-[10px] font-semibold text-muted">+{extra}</span>
      )}
    </div>
  );
}

/* ── Main KPI Card ── */
export function ProjectKPICard({ metrics, onDelete }: ProjectKPICardProps) {
  const m = metrics;
  const priorityColor = getPriorityColor(m.dominantPriority);
  const progressColor = getProgressColor(m.progressPercent, m.overdueTasks);
  const progressRaw = getProgressRawColor(m.progressPercent, m.overdueTasks);

  return (
    <Link href={`/projects/${m.project.id}`} className="block outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
      <motion.div
        whileHover={{
          y: -4,
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.12)',
          transition: { duration: 0.25 },
        }}
        whileTap={{ scale: 0.99 }}
        className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors"
        style={{ borderLeftWidth: 4, borderLeftColor: priorityColor }}
      >
        {/* Shine sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

        <div className="relative p-2.5 sm:p-4 md:p-5">
          {/* ── 1. Header: name, status ── */}
          <div className="mb-1.5 sm:mb-3 flex items-start justify-between gap-1.5 sm:gap-3">
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1.5 sm:gap-2">
                <div
                  className="h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.project.color }}
                />
                <h3 className="truncate text-[11px] sm:text-[15px] font-bold leading-tight text-text">
                  {m.project.name}
                </h3>
              </div>
              <p className="hidden sm:block text-[11px] text-muted">
                {m.totalTasks} tasks
                {m.lastActivityAt && (
                  <> · Updated {m.lastActivityRelative}</>
                )}
              </p>
            </div>
            <div className="hidden sm:flex shrink-0 items-center gap-1.5">
              <Badge variant={getStatusBadgeVariant(m.project.status)}>
                {m.project.status}
              </Badge>
              {m.health === 'red' && (
                <Badge variant="danger">At Risk</Badge>
              )}
            </div>
            {/* Mobile: just health dot */}
            {m.health === 'red' && (
              <div className="sm:hidden h-2 w-2 shrink-0 rounded-full bg-red" title="At Risk" />
            )}
          </div>

          {/* ── 2. KPI Metrics — horizontal row ── */}
          {/* Mobile: compact 2-col with just numbers */}
          <div className="mb-1.5 sm:mb-3 grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-x-4 sm:gap-y-2 border-b border-border pb-1.5 sm:pb-3 sm:grid-cols-4 sm:flex sm:items-center sm:justify-between sm:gap-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-1 text-muted">
                <ClipboardDocumentListIcon className="hidden sm:block h-3 w-3" />
                <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide">Total</span>
              </div>
              <p className="text-[15px] sm:text-[20px] font-bold leading-tight tabular-nums text-text">
                <AnimatedNum value={m.totalTasks} />
              </p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <ExclamationTriangleIcon className={cn('hidden sm:block h-3 w-3', m.overdueTasks > 0 ? 'text-red' : 'text-muted')} />
                <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-muted">Overdue</span>
              </div>
              <p className={cn('text-[15px] sm:text-[20px] font-bold leading-tight tabular-nums', m.overdueTasks > 0 ? 'text-red' : 'text-muted/40')}>
                <AnimatedNum value={m.overdueTasks} />
              </p>
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1 text-blue">
                <ArrowPathIcon className="h-3 w-3" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">In Prog</span>
              </div>
              <p className="text-[20px] font-bold leading-tight tabular-nums text-blue">
                <AnimatedNum value={m.inProgressTasks} />
              </p>
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1">
                <NoSymbolIcon className={cn('h-3 w-3', m.blockedTasks > 0 ? 'text-yellow' : 'text-muted')} />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">Blocked</span>
              </div>
              <p className={cn('text-[20px] font-bold leading-tight tabular-nums', m.blockedTasks > 0 ? 'text-yellow' : 'text-muted/40')}>
                <AnimatedNum value={m.blockedTasks} />
              </p>
            </div>
          </div>

          {/* ── 3. Progress bar ── */}
          <div className="mb-1.5 sm:mb-3">
            <div className="mb-1 sm:mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] sm:text-[11px] font-semibold text-muted">{m.progressPercent}%</span>
                <span className="hidden sm:inline"><Sparkline data={m.weeklyCompletions} color={progressRaw} /></span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[11px] text-muted">
                  <CheckCircleIcon className="mr-0.5 inline h-3 w-3 text-green" />
                  {m.doneTasks}/{m.totalTasks}
                </span>
                <CompletionRing percent={m.progressPercent} color={progressRaw} delay={0.2} />
              </div>
            </div>
            <div className="h-1 sm:h-1.5 w-full overflow-hidden rounded-full bg-border/40">
              <motion.div
                className={cn('h-full rounded-full', progressColor)}
                initial={{ width: 0 }}
                animate={{ width: `${m.progressPercent}%` }}
                transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
              />
            </div>
          </div>

          {/* ── 4. Quick stats badges (desktop only) ── */}
          {(m.dueToday > 0 || m.dueThisWeek > 0 || m.highPriorityCount > 0) && (
            <div className="hidden sm:flex mb-3 flex-wrap items-center gap-1.5">
              {m.dueToday > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-yellow-bg px-1.5 py-0.5 text-[9px] font-bold text-yellow">
                  <CalendarIcon className="h-2.5 w-2.5" />
                  {m.dueToday} today
                </span>
              )}
              {m.dueThisWeek > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-bg px-1.5 py-0.5 text-[9px] font-bold text-blue">
                  <ClockIcon className="h-2.5 w-2.5" />
                  {m.dueThisWeek} this week
                </span>
              )}
              {m.highPriorityCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-bg px-1.5 py-0.5 text-[9px] font-bold text-red">
                  <ExclamationTriangleIcon className="h-2.5 w-2.5" />
                  {m.highPriorityCount} high
                </span>
              )}
            </div>
          )}

          {/* ── 5. Footer: team + action ── */}
          <div className="flex items-center justify-between border-t border-border pt-1.5 sm:pt-3">
            <div className="hidden sm:block">
              <TeamAvatars metrics={m} />
            </div>
            {/* Mobile: minimal footer */}
            <span className="sm:hidden text-[9px] font-medium text-muted">{m.totalTasks} tasks</span>
            <div className="flex items-center gap-1">
              {onDelete && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                  className="rounded-lg p-1.5 text-muted transition-all hover:bg-red-bg hover:text-red active:scale-90"
                  title="Delete project"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-accent !p-0 sm:!p-2" tabIndex={-1}>
                <span className="hidden sm:inline">View Details</span>
                <ArrowRightIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ── Compact list row variant ── */
export function ProjectListRow({ metrics, onDelete }: ProjectKPICardProps) {
  const m = metrics;
  const priorityColor = getPriorityColor(m.dominantPriority);
  const progressColor = getProgressColor(m.progressPercent, m.overdueTasks);

  return (
    <Link href={`/projects/${m.project.id}`} className="block outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
      <motion.div
        whileHover={{ backgroundColor: 'var(--color-bg)', transition: { duration: 0.15 } }}
        className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors sm:px-5"
        style={{ borderLeftWidth: 4, borderLeftColor: priorityColor }}
      >
        {/* Project name + health */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.project.color }} />
            <h3 className="truncate text-[13px] font-bold text-text">{m.project.name}</h3>
            <Badge variant={getStatusBadgeVariant(m.project.status)} className="hidden sm:inline-flex">
              {m.project.status}
            </Badge>
            {m.health === 'red' && <Badge variant="danger" className="hidden sm:inline-flex">At Risk</Badge>}
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            {m.totalTasks} tasks · Updated {m.lastActivityRelative}
          </p>
        </div>

        {/* Progress */}
        <div className="hidden w-28 flex-col items-center sm:flex">
          <div className="mb-0.5 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
            <motion.div
              className={cn('h-full rounded-full', progressColor)}
              initial={{ width: 0 }}
              animate={{ width: `${m.progressPercent}%` }}
              transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-muted">{m.progressPercent}%</span>
        </div>

        {/* Overdue */}
        <span className={cn('hidden w-12 text-center text-[12px] font-bold tabular-nums sm:block', m.overdueTasks > 0 ? 'text-red' : 'text-muted')}>
          {m.overdueTasks}
        </span>

        {/* This week */}
        <span className={cn('hidden w-12 text-center text-[12px] font-bold tabular-nums md:block', m.dueThisWeek > 0 ? 'text-yellow' : 'text-muted')}>
          {m.dueThisWeek}
        </span>

        {/* Team */}
        <div className="hidden lg:block">
          <TeamAvatars metrics={m} />
        </div>

        {onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="rounded-lg p-1.5 text-muted transition-all hover:bg-red-bg hover:text-red active:scale-90"
            title="Delete project"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}

        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-text" />
      </motion.div>
    </Link>
  );
}
