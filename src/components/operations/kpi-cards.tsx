'use client';

import { clsx } from 'clsx';
import type { OperationsKPI } from '@/types/database';

interface KPICardsProps {
  kpi: OperationsKPI;
  onTogglePeriod: () => void;
}

interface CardDef {
  label: string;
  value: number;
  format: 'number' | 'percent';
  color: string;
  bgColor: string;
}

export function KPICards({ kpi, onTogglePeriod }: KPICardsProps) {
  const cards: CardDef[] = [
    {
      label: 'Due Today',
      value: kpi.dueToday,
      format: 'number',
      color: 'text-yellow',
      bgColor: 'bg-yellow-bg',
    },
    {
      label: 'Overdue',
      value: kpi.overdue,
      format: 'number',
      color: kpi.overdue > 0 ? 'text-red' : 'text-green',
      bgColor: kpi.overdue > 0 ? 'bg-red-bg' : 'bg-green-bg',
    },
    {
      label: 'In Progress',
      value: kpi.inProgress,
      format: 'number',
      color: 'text-blue',
      bgColor: 'bg-blue-bg',
    },
    {
      label: `Completion (${kpi.completionPeriodDays}d)`,
      value: kpi.completionRate,
      format: 'percent',
      color: kpi.completionRate >= 70 ? 'text-green' : kpi.completionRate >= 40 ? 'text-yellow' : 'text-red',
      bgColor: kpi.completionRate >= 70 ? 'bg-green-bg' : kpi.completionRate >= 40 ? 'bg-yellow-bg' : 'bg-red-bg',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            {card.label}
            {card.label.startsWith('Completion') && (
              <button
                onClick={onTogglePeriod}
                className="ml-1.5 rounded px-1 py-0.5 text-[10px] text-accent hover:bg-accent-muted"
              >
                toggle
              </button>
            )}
          </p>
          <p className={clsx('text-2xl font-bold tabular-nums', card.color)}>
            {card.format === 'percent' ? `${card.value}%` : card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
