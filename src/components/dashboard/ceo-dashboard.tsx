'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { RiskAlerts } from './risk-alerts';
import { WeekFocus } from './week-focus';
import type { Task, User, Project, ProjectHealth } from '@/types/database';
import { isOverdue, isDueToday } from '@/lib/dates';

interface CEODashboardProps {
  tasks: Task[];
  projects: Project[];
  team: User[];
  projectHealth: ProjectHealth[];
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
    { label: 'Overdue (weighted)', value: kpis.overdueWeighted, sub: `${kpis.overdue} tasks`, color: kpis.overdue > 0 ? 'text-red' : 'text-green' },
    { label: 'Due Today', value: kpis.dueToday, sub: 'active tasks', color: kpis.dueToday > 0 ? 'text-yellow' : 'text-green' },
    { label: 'Team Capacity', value: kpis.avgWIP, sub: `WIP/person (${kpis.teamSize})`, color: kpis.avgWIP > 5 ? 'text-red' : kpis.avgWIP > 3 ? 'text-yellow' : 'text-green' },
    { label: 'Project Risk', value: `${kpis.riskIndex}%`, sub: 'projects at risk', color: kpis.riskIndex > 30 ? 'text-red' : kpis.riskIndex > 10 ? 'text-yellow' : 'text-green' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4, ease: [0.4, 0, 0.2, 1] }} whileHover={{ y: -2, transition: { duration: 0.2 } }} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{card.label}</p>
            <p className={cn('text-2xl font-bold tabular-nums tracking-tight', card.color)}>{card.value}</p>
            <p className="mt-0.5 text-[10px] text-muted">{card.sub}</p>
          </motion.div>
        ))}
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
