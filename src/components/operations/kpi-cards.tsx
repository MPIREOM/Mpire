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

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return (
    <>
      {displayed}
      {suffix}
    </>
  );
}

interface CardDef {
  label: string;
  value: number;
  format: 'number' | 'percent';
  color: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
}

export function KPICards({ kpi, onTogglePeriod }: KPICardsProps) {
  const cards: CardDef[] = [
    {
      label: 'Due Today',
      value: kpi.dueToday,
      format: 'number',
      color: 'text-yellow',
      icon: CalendarIcon,
      iconBg: 'bg-yellow-bg',
    },
    {
      label: 'Overdue',
      value: kpi.overdue,
      format: 'number',
      color: kpi.overdue > 0 ? 'text-red' : 'text-green',
      icon: ExclamationTriangleIcon,
      iconBg: kpi.overdue > 0 ? 'bg-red-bg' : 'bg-green-bg',
    },
    {
      label: 'In Progress',
      value: kpi.inProgress,
      format: 'number',
      color: 'text-blue',
      icon: ArrowPathIcon,
      iconBg: 'bg-blue-bg',
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
      icon: ChartBarIcon,
      iconBg:
        kpi.completionRate >= 70
          ? 'bg-green-bg'
          : kpi.completionRate >= 40
          ? 'bg-yellow-bg'
          : 'bg-red-bg',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="group rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className={cn('rounded-lg p-2', card.iconBg)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
            {card.label.startsWith('Done') && (
              <button
                onClick={onTogglePeriod}
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent-muted"
              >
                toggle
              </button>
            )}
          </div>
          <p className={cn('text-2xl font-bold tabular-nums tracking-tight', card.color)}>
            <AnimatedNumber
              value={card.value}
              suffix={card.format === 'percent' ? '%' : ''}
            />
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted">{card.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
