'use client';

import { useState, useMemo } from 'react';
import { Shell } from '@/components/layout/shell';
import { KPICards } from '@/components/operations/kpi-cards';
import { CriticalFocus } from '@/components/operations/critical-focus';
import { ProjectHealthGrid } from '@/components/operations/project-health';
import { TaskList } from '@/components/operations/task-list';
import { useUser } from '@/hooks/use-user';
import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useTeam } from '@/hooks/use-team';
import { canManage } from '@/lib/roles';
import { isOverdue, isDueToday, todayISO } from '@/lib/dates';
import { subDays, isAfter, parseISO } from 'date-fns';
import type { OperationsKPI, ProjectHealth } from '@/types/database';

export default function OperationsPage() {
  const { user } = useUser();
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const { team } = useTeam();
  const [completionDays, setCompletionDays] = useState(7);

  const role = user?.role ?? 'staff';

  // Compute KPIs
  const kpi: OperationsKPI = useMemo(() => {
    const visibleTasks =
      canManage(role)
        ? tasks
        : tasks.filter((t) => t.assignee_id === user?.id);

    const dueToday = visibleTasks.filter(
      (t) => isDueToday(t.due_date) && t.status !== 'done'
    ).length;

    const overdue = visibleTasks.filter((t) =>
      isOverdue(t.due_date, t.status)
    ).length;

    const inProgress = visibleTasks.filter(
      (t) => t.status === 'in_progress'
    ).length;

    // Completion rate: tasks completed in the last N days / all tasks with due dates in that window
    const cutoff = subDays(new Date(), completionDays);
    const windowTasks = visibleTasks.filter(
      (t) => t.due_date && isAfter(parseISO(t.due_date), cutoff)
    );
    const windowDone = windowTasks.filter((t) => t.status === 'done').length;
    const completionRate =
      windowTasks.length > 0
        ? Math.round((windowDone / windowTasks.length) * 100)
        : 0;

    return {
      dueToday,
      overdue,
      inProgress,
      completionRate,
      completionPeriodDays: completionDays,
    };
  }, [tasks, user?.id, role, completionDays]);

  // Compute project health
  const projectHealth: ProjectHealth[] = useMemo(() => {
    return projects
      .filter((p) => p.status === 'active')
      .map((project) => {
        const projectTasks = tasks.filter((t) => t.project_id === project.id);
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(
          (t) => t.status === 'done'
        ).length;
        const overdueTasks = projectTasks.filter((t) =>
          isOverdue(t.due_date, t.status)
        ).length;
        const dueTodayTasks = projectTasks.filter(
          (t) => isDueToday(t.due_date) && t.status !== 'done'
        ).length;
        const progressPercent =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let healthStatus: 'green' | 'yellow' | 'red' = 'green';
        if (overdueTasks > 0) healthStatus = 'red';
        else if (progressPercent < 30 && totalTasks > 0) healthStatus = 'yellow';

        return {
          project,
          totalTasks,
          completedTasks,
          overdueTasks,
          dueTodayTasks,
          progressPercent,
          healthStatus,
        };
      })
      .sort((a, b) => {
        // Red first, then yellow, then green
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.healthStatus] - order[b.healthStatus];
      });
  }, [projects, tasks]);

  if (!user) {
    return (
      <Shell title="Operations" subtitle="Loading...">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Operations" subtitle="Command center overview">
      <div className="space-y-6">
        {/* KPI Cards */}
        <KPICards
          kpi={kpi}
          onTogglePeriod={() =>
            setCompletionDays((d) => (d === 7 ? 30 : 7))
          }
        />

        {/* Critical Focus (manager/owner only, if there are issues) */}
        {canManage(role) && <CriticalFocus tasks={tasks} />}

        {/* Project Health */}
        {canManage(role) && <ProjectHealthGrid projects={projectHealth} />}

        {/* Task List */}
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-text">Tasks</h3>
          <TaskList
            tasks={tasks}
            currentUser={user}
            team={team}
            projects={projects}
            onUpdateTask={updateTask}
          />
        </div>
      </div>
    </Shell>
  );
}
