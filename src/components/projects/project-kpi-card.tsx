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
} from '@heroicons/react/24/outline';

interface ProjectKPICardProps {
  metrics: ProjectMetrics;
}

/* ── Animated count-up ── */
function AnimatedNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    const dur = 600;
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

/* ── SVG Completion ring ── */
function CompletionRing({
  percent,
  color,
  delay = 0,
}: {
  percent: number;
  color: string;
  delay?: number;
}) {
  const r = 22;
  const stroke = 3.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={52} height={52} viewBox="0 0 52 52" className="-rotate-90">
        <circle
          cx={26} cy={26} r={r}
          fill="none" stroke="currentColor" strokeWidth={stroke}
          className="text-border/50"
        />
        <motion.circle
          cx={26} cy={26} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * percent) / 100 }}
          transition={{ delay, duration: 1, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums text-text">{percent}%</span>
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
export function ProjectKPICard({ metrics }: ProjectKPICardProps) {
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

        <div className="relative p-5 sm:p-6">
          {/* ── Header: name, status, priority ── */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: m.project.color }}
                />
                <h3 className="truncate text-[16px] font-bold leading-tight text-text">
                  {m.project.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">
                  {m.totalTasks} tasks
                </span>
                {m.lastActivityAt && (
                  <>
                    <span className="text-muted/40">·</span>
                    <span className="text-[11px] text-muted">
                      Updated {m.lastActivityRelative}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant={getStatusBadgeVariant(m.project.status)}>
                {m.project.status}
              </Badge>
              {m.health === 'red' && (
                <Badge variant="danger">At Risk</Badge>
              )}
            </div>
          </div>

          {/* ── KPI Metrics Grid ── */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total */}
            <div className="rounded-lg bg-bg/80 px-3 py-2.5">
              <div className="mb-0.5 flex items-center gap-1.5">
                <ClipboardDocumentListIcon className="h-3.5 w-3.5 text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total</span>
              </div>
              <p className="text-[18px] font-bold leading-tight text-text">
                <AnimatedNum value={m.totalTasks} />
              </p>
            </div>
            {/* In Progress */}
            <div className="rounded-lg bg-bg/80 px-3 py-2.5">
              <div className="mb-0.5 flex items-center gap-1.5">
                <ArrowPathIcon className="h-3.5 w-3.5 text-blue" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">In Prog</span>
              </div>
              <p className="text-[18px] font-bold leading-tight text-blue">
                <AnimatedNum value={m.inProgressTasks} />
              </p>
            </div>
            {/* Overdue */}
            <div className={cn('rounded-lg px-3 py-2.5', m.overdueTasks > 0 ? 'bg-red-bg' : 'bg-bg/80')}>
              <div className="mb-0.5 flex items-center gap-1.5">
                <ExclamationTriangleIcon className={cn('h-3.5 w-3.5', m.overdueTasks > 0 ? 'text-red' : 'text-muted')} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Overdue</span>
              </div>
              <p className={cn('text-[18px] font-bold leading-tight', m.overdueTasks > 0 ? 'text-red' : 'text-text')}>
                <AnimatedNum value={m.overdueTasks} />
              </p>
            </div>
            {/* Blocked */}
            <div className={cn('rounded-lg px-3 py-2.5', m.blockedTasks > 0 ? 'bg-yellow-bg' : 'bg-bg/80')}>
              <div className="mb-0.5 flex items-center gap-1.5">
                <NoSymbolIcon className={cn('h-3.5 w-3.5', m.blockedTasks > 0 ? 'text-yellow' : 'text-muted')} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Blocked</span>
              </div>
              <p className={cn('text-[18px] font-bold leading-tight', m.blockedTasks > 0 ? 'text-yellow' : 'text-text')}>
                <AnimatedNum value={m.blockedTasks} />
              </p>
            </div>
          </div>

          {/* ── Progress section ── */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-semibold text-muted">Progress</span>
                <Sparkline data={m.weeklyCompletions} color={progressRaw} />
              </div>
              <CompletionRing percent={m.progressPercent} color={progressRaw} delay={0.2} />
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
              <motion.div
                className={cn('h-full rounded-full', progressColor)}
                initial={{ width: 0 }}
                animate={{ width: `${m.progressPercent}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted">
              <span>
                <CheckCircleIcon className="mr-0.5 inline h-3 w-3 text-green" />
                {m.doneTasks} done
              </span>
              <span>{m.totalTasks - m.doneTasks} remaining</span>
            </div>
          </div>

          {/* ── Quick stats row ── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {m.dueToday > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-yellow-bg px-2 py-1 text-[10px] font-bold text-yellow">
                <CalendarIcon className="h-3 w-3" />
                {m.dueToday} due today
              </span>
            )}
            {m.dueThisWeek > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-bg px-2 py-1 text-[10px] font-bold text-blue">
                <ClockIcon className="h-3 w-3" />
                {m.dueThisWeek} this week
              </span>
            )}
            {m.highPriorityCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-bg px-2 py-1 text-[10px] font-bold text-red">
                <ExclamationTriangleIcon className="h-3 w-3" />
                {m.highPriorityCount} high priority
              </span>
            )}
          </div>

          {/* ── Footer: team + action ── */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <TeamAvatars metrics={m} />
            <Button variant="ghost" size="sm" className="gap-1 text-accent" tabIndex={-1}>
              View Details
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/* ── Compact list row variant ── */
export function ProjectListRow({ metrics }: ProjectKPICardProps) {
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
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
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

        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-text" />
      </motion.div>
    </Link>
  );
}
