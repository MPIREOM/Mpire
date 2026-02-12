'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { RiskAlerts } from './risk-alerts';
import { WeekFocus } from './week-focus';
import type { Task, User, Project, ProjectHealth } from '@/types/database';
import { isOverdue, isDueToday } from '@/lib/dates';
import {
  ExclamationTriangleIcon,
  CalendarIcon,
  UsersIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

interface CEODashboardProps {
  tasks: Task[];
  projects: Project[];
  team: User[];
  projectHealth: ProjectHealth[];
}

/* ── Animated count-up ── */
function AnimatedValue({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const [displayed, setDisplayed] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    if (isNaN(numValue)) return;
    const start = prevValue.current;
    const end = numValue;
    const duration = 700;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round((start + (end - start) * eased) * 10) / 10);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prevValue.current = numValue;
  }, [numValue]);

  if (typeof value === 'string' && isNaN(parseFloat(value))) {
    return <span className="tabular-nums">{value}</span>;
  }

  return (
    <span className="tabular-nums">
      {Number.isInteger(numValue) ? Math.round(displayed) : displayed.toFixed(1)}
      {suffix}
    </span>
  );
}

/* ── Mini progress ring for risk index ── */
function MiniRing({ percent, color, delay = 0 }: { percent: number; color: string; delay?: number }) {
  const r = 16;
  const stroke = 2.5;
  const c = 2 * Math.PI * r;

  return (
    <svg width={38} height={38} viewBox="0 0 38 38" className="shrink-0 -rotate-90">
      <circle cx={19} cy={19} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
      <motion.circle
        cx={19}
        cy={19}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * Math.min(percent, 100)) / 100 }}
        transition={{ delay, duration: 1, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  );
}

export function CEODashboard({ tasks, projects, team, projectHealth }: CEODashboardProps) {
  const [completionDays, setCompletionDays] = useState(7);

  const kpis = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status));
    const overdueWeighted = overdue.reduce((sum, t) => {
      const w = t.priority === 'high' ? 3 : t.priority === 'medium' ? 2 : 1;
      return sum + w;
    }, 0);
    const dueToday = tasks.filter((t) => isDueToday(t.due_date) && t.status !== 'done').length;
    const activeMembers = team.filter((u) => u.role === 'staff' || u.role === 'manager');
    const inProgressTotal = tasks.filter((t) => t.status === 'in_progress').length;
    const avgWIP = activeMembers.length > 0 ? Math.round((inProgressTotal / activeMembers.length) * 10) / 10 : 0;
    const activeProjects = projectHealth.filter((p) => p.project.status === 'active');
    const atRisk = activeProjects.filter((p) => p.healthStatus === 'red').length;
    const riskIndex = activeProjects.length > 0 ? Math.round((atRisk / activeProjects.length) * 100) : 0;
    return { overdueWeighted, overdue: overdue.length, dueToday, avgWIP, riskIndex, teamSize: activeMembers.length };
  }, [tasks, team, projectHealth]);

  const cards = [
    {
      label: 'Overdue (weighted)',
      value: kpis.overdueWeighted,
      sub: `${kpis.overdue} tasks`,
      color: kpis.overdue > 0 ? 'text-red' : 'text-green',
      icon: ExclamationTriangleIcon,
      iconBg: kpis.overdue > 0 ? 'bg-red-bg' : 'bg-green-bg',
      hasRing: false,
    },
    {
      label: 'Due Today',
      value: kpis.dueToday,
      sub: 'active tasks',
      color: kpis.dueToday > 0 ? 'text-yellow' : 'text-green',
      icon: CalendarIcon,
      iconBg: kpis.dueToday > 0 ? 'bg-yellow-bg' : 'bg-green-bg',
      hasRing: false,
    },
    {
      label: 'Team Capacity',
      value: kpis.avgWIP,
      sub: `WIP/person (${kpis.teamSize})`,
      color: kpis.avgWIP > 5 ? 'text-red' : kpis.avgWIP > 3 ? 'text-yellow' : 'text-green',
      icon: UsersIcon,
      iconBg: kpis.avgWIP > 5 ? 'bg-red-bg' : kpis.avgWIP > 3 ? 'bg-yellow-bg' : 'bg-green-bg',
      hasRing: false,
    },
    {
      label: 'Project Risk',
      value: kpis.riskIndex,
      sub: 'projects at risk',
      color: kpis.riskIndex > 30 ? 'text-red' : kpis.riskIndex > 10 ? 'text-yellow' : 'text-green',
      icon: ShieldExclamationIcon,
      iconBg: kpis.riskIndex > 30 ? 'bg-red-bg' : kpis.riskIndex > 10 ? 'bg-yellow-bg' : 'bg-green-bg',
      hasRing: true,
      ringColor: kpis.riskIndex > 30 ? 'var(--color-red)' : kpis.riskIndex > 10 ? 'var(--color-yellow)' : 'var(--color-green)',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card, i) => {
          const delay = i * 0.1;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay, duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{
                y: -3,
                boxShadow: '0 8px 30px -12px rgba(0,0,0,0.12)',
                transition: { duration: 0.25 },
              }}
              whileTap={{ scale: 0.985 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5"
            >
              {/* Shine sweep */}
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: delay + 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                    className={cn('rounded-lg p-2', card.iconBg)}
                  >
                    <card.icon className={cn('h-4 w-4', card.color)} />
                  </motion.div>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-2xl font-bold tabular-nums tracking-tight', card.color)}>
                      <AnimatedValue value={card.value} suffix={card.hasRing ? '%' : ''} />
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted">{card.label}</p>
                    <p className="text-[10px] text-muted/70">{card.sub}</p>
                  </div>
                  {card.hasRing && (
                    <MiniRing percent={card.value} color={card.ringColor!} delay={delay + 0.3} />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <RiskAlerts tasks={tasks} projectHealth={projectHealth} />
      {projectHealth.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-text">Project Health</h3>
            <Link href="/projects" className="text-[11px] font-semibold text-accent transition-colors hover:text-accent-light">View all</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectHealth.slice(0, 6).map((ph, i) => (
              <motion.div key={ph.project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                <Link href={`/projects/${ph.project.id}`} className="group block rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ph.project.color }} />
                    <h4 className="flex-1 truncate text-[13px] font-semibold text-text">{ph.project.name}</h4>
                    <span className={cn('h-2 w-2 rounded-full', ph.healthStatus === 'green' ? 'bg-green' : ph.healthStatus === 'yellow' ? 'bg-yellow' : 'bg-red')} />
                  </div>
                  <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${ph.progressPercent}%` }} transition={{ delay: 0.5 + i * 0.05, duration: 0.6, ease: [0.4, 0, 0.2, 1] }} className={cn('h-full rounded-full', ph.healthStatus === 'green' ? 'bg-green' : ph.healthStatus === 'yellow' ? 'bg-yellow' : 'bg-red')} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                    <span className="text-muted"><strong className="font-semibold text-text">{ph.progressPercent}%</strong> done</span>
                    {ph.overdueTasks > 0 && <span className="font-semibold text-red">{ph.overdueTasks} overdue</span>}
                    {ph.dueTodayTasks > 0 && <span className="font-semibold text-yellow">{ph.dueTodayTasks} today</span>}
                    <span className="text-muted">{ph.totalTasks} tasks</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      <WeekFocus tasks={tasks} />
    </div>
  );
}
