'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ExclamationCircleIcon,
  NoSymbolIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import type { Task, ProjectHealth } from '@/types/database';
import { isOverdue, formatDate } from '@/lib/dates';

interface RiskAlertsProps {
  tasks: Task[];
  projectHealth: ProjectHealth[];
}

interface AlertGroup {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  bgColor: string;
  badgeVariant: 'danger' | 'warning' | 'info';
  type: 'task' | 'project';
  items: { id: string; projectId?: string; text: string; meta: string }[];
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
        badgeVariant: 'danger' as const,
        type: 'task' as const,
        items: overdueHigh.map((t) => ({
          id: t.id,
          projectId: t.project_id,
          text: t.title,
          meta: `${t.project?.name ?? 'No project'} · ${formatDate(t.due_date)}`,
        })),
      },
      {
        label: 'Blocked',
        icon: NoSymbolIcon,
        color: 'text-yellow',
        bgColor: 'bg-yellow-bg',
        badgeVariant: 'warning' as const,
        type: 'task' as const,
        items: blocked.map((t) => ({
          id: t.id,
          projectId: t.project_id,
          text: t.title,
          meta: t.project?.name ?? 'No project',
        })),
      },
      {
        label: 'Projects at Risk',
        icon: FolderIcon,
        color: 'text-red',
        bgColor: 'bg-red-bg',
        badgeVariant: 'danger' as const,
        type: 'project' as const,
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      <h3 className="mb-4 text-[14px] font-bold text-text">Risk & Alerts</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((group, i) => (
          <motion.div
            key={group.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className={cn('rounded-lg p-1.5', group.bgColor)}>
                <group.icon className={cn('h-4 w-4', group.color)} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-text">{group.label}</p>
                <p className={cn('text-[18px] font-bold tabular-nums', group.color)}>
                  {group.items.length}
                </p>
              </div>
              <Badge variant={group.badgeVariant}>{group.items.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {group.items.slice(0, 4).map((item, idx) => {
                const href = group.type === 'project'
                  ? `/projects/${item.id}`
                  : `/projects/${item.projectId}`;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.03 }}
                  >
                    <Link
                      href={href}
                      className="flex items-start gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-bg"
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', group.color.replace('text-', 'bg-'))} />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-text">{item.text}</p>
                        <p className="text-[10px] text-muted">{item.meta}</p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              {group.items.length > 4 && (
                <p className="text-[10px] text-muted">+{group.items.length - 4} more</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
