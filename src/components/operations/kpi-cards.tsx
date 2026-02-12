'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { OperationsKPI } from '@/types/database';
import {
  CalendarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface KPICardsProps {
  kpi: OperationsKPI;
  onTogglePeriod: () => void;
}

/* ── Animated count-up number ── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 700;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prevValue.current = value;
  }, [value]);

  return (
    <span className="tabular-nums">
      {displayed}
      {suffix}
    </span>
  );
}

/* ── SVG circular progress ring for completion % ── */
function ProgressRing({
  percent,
  color,
  delay = 0,
}: {
  percent: number;
  color: string;
  delay?: number;
}) {
  const radius = 18;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={44} height={44} viewBox="0 0 44 44" className="shrink-0 -rotate-90">
      {/* Track */}
      <circle
        cx={22}
        cy={22}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-border"
      />
      {/* Value arc */}
      <motion.circle
        cx={22}
        cy={22}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (circumference * percent) / 100 }}
        transition={{ delay, duration: 1, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  );
}

/* ── Mini horizontal progress bar ── */
function MiniBar({
  value,
  max,
  colorClass,
  delay = 0,
}: {
  value: number;
  max: number;
  colorClass: string;
  delay?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-border/50">
      <motion.div
        className={cn('h-full rounded-full', colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}

interface CardDef {
  label: string;
  value: number;
  format: 'number' | 'percent';
  color: string;
  rawColor: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  barColor: string;
  maxForBar: number;
}

export function KPICards({ kpi, onTogglePeriod }: KPICardsProps) {
  const totalTasks = kpi.dueToday + kpi.overdue + kpi.inProgress;
  const barMax = Math.max(totalTasks, 10);

  const cards: CardDef[] = [
    {
      label: 'Due Today',
      value: kpi.dueToday,
      format: 'number',
      color: 'text-yellow',
      rawColor: 'var(--color-yellow)',
      icon: CalendarIcon,
      iconBg: 'bg-yellow-bg',
      barColor: 'bg-yellow',
      maxForBar: barMax,
    },
    {
      label: 'Overdue',
      value: kpi.overdue,
      format: 'number',
      color: kpi.overdue > 0 ? 'text-red' : 'text-green',
      rawColor: kpi.overdue > 0 ? 'var(--color-red)' : 'var(--color-green)',
      icon: ExclamationTriangleIcon,
      iconBg: kpi.overdue > 0 ? 'bg-red-bg' : 'bg-green-bg',
      barColor: kpi.overdue > 0 ? 'bg-red' : 'bg-green',
      maxForBar: barMax,
    },
    {
      label: 'In Progress',
      value: kpi.inProgress,
      format: 'number',
      color: 'text-blue',
      rawColor: 'var(--color-blue)',
      icon: ArrowPathIcon,
      iconBg: 'bg-blue-bg',
      barColor: 'bg-blue',
      maxForBar: barMax,
    },
    {
      label: `Done (${kpi.completionPeriodDays}d)`,
      value: kpi.completionRate,
      format: 'percent',
      color:
        kpi.completionRate >= 70
          ? 'text-green'
          : kpi.completionRate >= 40
            ? 'text-yellow'
            : 'text-red',
      rawColor:
        kpi.completionRate >= 70
          ? 'var(--color-green)'
          : kpi.completionRate >= 40
            ? 'var(--color-yellow)'
            : 'var(--color-red)',
      icon: ChartBarIcon,
      iconBg:
        kpi.completionRate >= 70
          ? 'bg-green-bg'
          : kpi.completionRate >= 40
            ? 'bg-yellow-bg'
            : 'bg-red-bg',
      barColor:
        kpi.completionRate >= 70
          ? 'bg-green'
          : kpi.completionRate >= 40
            ? 'bg-yellow'
            : 'bg-red',
      maxForBar: 100,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, i) => {
        const isCompletion = card.format === 'percent';
        const delay = i * 0.1;

        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay,
              duration: 0.45,
              ease: [0.4, 0, 0.2, 1],
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 8px 30px -12px rgba(0,0,0,0.12)',
              transition: { duration: 0.25 },
            }}
            whileTap={{ scale: 0.985 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-5"
          >
            {/* Subtle shine sweep on hover */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

            <div className="relative">
              {/* Header: icon + toggle */}
              <div className="mb-3 flex items-center justify-between">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: delay + 0.15,
                    type: 'spring',
                    stiffness: 300,
                    damping: 20,
                  }}
                  className={cn('rounded-lg p-2', card.iconBg)}
                >
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </motion.div>
                {card.label.startsWith('Done') && (
                  <button
                    onClick={onTogglePeriod}
                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent-muted"
                  >
                    {kpi.completionPeriodDays}d
                  </button>
                )}
              </div>

              {/* Value + optional ring */}
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn('text-2xl font-bold tracking-tight', card.color)}>
                    <AnimatedNumber
                      value={card.value}
                      suffix={card.format === 'percent' ? '%' : ''}
                    />
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted">{card.label}</p>
                </div>

                {isCompletion && (
                  <ProgressRing
                    percent={card.value}
                    color={card.rawColor}
                    delay={delay + 0.3}
                  />
                )}
              </div>

              {/* Mini progress bar for non-completion cards */}
              {!isCompletion && (
                <MiniBar
                  value={card.value}
                  max={card.maxForBar}
                  colorClass={card.barColor}
                  delay={delay + 0.25}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
