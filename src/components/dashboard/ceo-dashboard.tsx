'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { RiskAlerts } from './risk-alerts';
import { WeekFocus } from './week-focus';
import type { Task, User, Project, OperationsKPI, ProjectHealth } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek } from '@/lib/dates';

interface CEODashboardProps {
  tasks: Task[];
  projects: Project[];
  team: User[];
  projectHealth: ProjectHealth[];
}

export function CEODashboard({ tasks, projects, team, projectHealth }: CEODashboardProps) {
  const [completionDays, setCompletionDays] = useState(7);

  // CEO-level KPIs
  const kpis = useMemo(() => {
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status));
    // Weighted: high=3, medium=2, low=1
    const overdueWeighted = overdue.reduce((sum, t) => {
      const w = t.priority === 'high' ? 3 : t.priority === 'medium' ? 2 : 1;
      return sum + w;
    }, 0);

    const dueToday = tasks.filter(
      (t) => isDueToday(t.due_date) && t.status !== 'done'
    ).length;

    // Team capacity: average WIP per person
    const activeMembers = team.filter((u) => u.role === 'staff' || u.role === 'manager');
    const inProgressTotal = tasks.filter((t) => t.status === 'in_progress').length;
    const avgWIP = activeMembers.length > 0
      ? Math.round((inProgressTotal / activeMembers.length) * 10) / 10
      : 0;

    // Project risk index: % of active projects at risk
    const activeProjects = projectHealth.filter((p) => p.project.status === 'active');
    const atRisk = activeProjects.filter((p) => p.healthStatus === 'red').length;
    const riskIndex = activeProjects.length > 0
      ? Math.round((atRisk / activeProjects.length) * 100)
      : 0;

    return { overdueWeighted, overdue: overdue.length, dueToday, avgWIP, riskIndex, teamSize: activeMembers.length };
  }, [tasks, team, projectHealth]);

  const cards = [
    {
      label: 'Overdue (weighted)',
      value: kpis.overdueWeighted,
      sub: `${kpis.overdue} tasks`,
      color: kpis.overdue > 0 ? 'text-red' : 'text-green',
    },
    {
      label: 'Due Today',
      value: kpis.dueToday,
      sub: 'active tasks',
      color: kpis.dueToday > 0 ? 'text-yellow' : 'text-green',
    },
    {
      label: 'Team Capacity',
      value: kpis.avgWIP,
      sub: `WIP/person (${kpis.teamSize})`,
      color: kpis.avgWIP > 5 ? 'text-red' : kpis.avgWIP > 3 ? 'text-yellow' : 'text-green',
    },
    {
      label: 'Project Risk',
      value: `${kpis.riskIndex}%`,
      sub: 'projects at risk',
      color: kpis.riskIndex > 30 ? 'text-red' : kpis.riskIndex > 10 ? 'text-yellow' : 'text-green',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <p className={clsx('text-2xl font-bold tabular-nums', card.color)}>
              {card.value}
            </p>
            <p className="text-[10px] text-muted">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Risk & Alerts */}
      <RiskAlerts tasks={tasks} projectHealth={projectHealth} />

      {/* Project Health Grid */}
      {projectHealth.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-text">Project Health</h3>
            <Link href="/projects" className="text-[11px] font-semibold text-accent hover:text-accent-light">
              View all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectHealth.slice(0, 6).map((ph) => (
              <Link
                key={ph.project.id}
                href={`/projects/${ph.project.id}`}
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-border-hover hover:shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ph.project.color }}
                  />
                  <h4 className="flex-1 truncate text-[13px] font-semibold text-text">
                    {ph.project.name}
                  </h4>
                  <span
                    className={clsx(
                      'h-2 w-2 rounded-full',
                      ph.healthStatus === 'green' ? 'bg-green' : ph.healthStatus === 'yellow' ? 'bg-yellow' : 'bg-red'
                    )}
                  />
                </div>

                {/* Progress bar */}
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      ph.healthStatus === 'green' ? 'bg-green' : ph.healthStatus === 'yellow' ? 'bg-yellow' : 'bg-red'
                    )}
                    style={{ width: `${ph.progressPercent}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
                  <span className="text-muted">
                    <strong className="font-semibold text-text">{ph.progressPercent}%</strong> done
                  </span>
                  {ph.overdueTasks > 0 && (
                    <span className="font-semibold text-red">{ph.overdueTasks} overdue</span>
                  )}
                  {ph.dueTodayTasks > 0 && (
                    <span className="font-semibold text-yellow">{ph.dueTodayTasks} today</span>
                  )}
                  <span className="text-muted">{ph.totalTasks} tasks</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* This Week Focus */}
      <WeekFocus tasks={tasks} />
    </div>
  );
}
