'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  NoSymbolIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import type { Task, ProjectHealth } from '@/types/database';
import { isOverdue, isDueToday, formatDate } from '@/lib/dates';

interface RiskAlertsProps {
  tasks: Task[];
  projectHealth: ProjectHealth[];
}

interface AlertGroup {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  items: { id: string; text: string; meta: string }[];
}

export function RiskAlerts({ tasks, projectHealth }: RiskAlertsProps) {
  const alerts = useMemo<AlertGroup[]>(() => {
    const overdueHigh = tasks.filter(
      (t) => isOverdue(t.due_date, t.status) && t.priority === 'high'
    );
    const blocked = tasks.filter((t) => t.status === 'blocked');
    const riskyProjects = projectHealth.filter((p) => p.healthStatus === 'red');

    return [
      {
        label: 'Overdue High Priority',
        icon: ExclamationCircleIcon,
        color: 'text-red',
        bgColor: 'bg-red-bg',
        items: overdueHigh.map((t) => ({
          id: t.id,
          text: t.title,
          meta: `${t.project?.name ?? 'No project'} · ${formatDate(t.due_date)}`,
        })),
      },
      {
        label: 'Blocked',
        icon: NoSymbolIcon,
        color: 'text-yellow',
        bgColor: 'bg-yellow-bg',
        items: blocked.map((t) => ({
          id: t.id,
          text: t.title,
          meta: t.project?.name ?? 'No project',
        })),
      },
      {
        label: 'Projects at Risk',
        icon: FolderIcon,
        color: 'text-red',
        bgColor: 'bg-red-bg',
        items: riskyProjects.map((p) => ({
          id: p.project.id,
          text: p.project.name,
          meta: `${p.overdueTasks} overdue · ${p.progressPercent}% done`,
        })),
      },
    ].filter((g) => g.items.length > 0);
  }, [tasks, projectHealth]);

  if (alerts.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-[13px] font-bold text-text">Risk & Alerts</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((group) => (
          <div
            key={group.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={clsx('rounded-lg p-1.5', group.bgColor)}>
                <group.icon className={clsx('h-4 w-4', group.color)} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-text">{group.label}</p>
                <p className={clsx('text-[18px] font-bold tabular-nums', group.color)}>
                  {group.items.length}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {group.items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', group.color.replace('text-', 'bg-'))} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-text">{item.text}</p>
                    <p className="text-[10px] text-muted">{item.meta}</p>
                  </div>
                </div>
              ))}
              {group.items.length > 4 && (
                <p className="text-[10px] text-muted">+{group.items.length - 4} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
