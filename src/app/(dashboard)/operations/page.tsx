'use client';

import { useMemo } from 'react';
import { Shell } from '@/components/layout/shell';
import { CEODashboard } from '@/components/dashboard/ceo-dashboard';
import { StaffDashboard } from '@/components/dashboard/staff-dashboard';
import { PageSkeleton } from '@/components/ui/skeleton-loader';
import { useUser } from '@/hooks/use-user';
import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useTeam } from '@/hooks/use-team';
import { isCEOView, canManage } from '@/lib/roles';
import { isOverdue, isDueToday } from '@/lib/dates';
import type { ProjectHealth } from '@/types/database';

export default function OperationsPage() {
  const { user } = useUser();
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const { team } = useTeam();

  const role = user?.role ?? 'staff';

  const projectHealth: ProjectHealth[] = useMemo(() => {
    return projects
      .filter((p) => p.status === 'active')
      .map((project) => {
        const projectTasks = tasks.filter((t) => t.project_id === project.id);
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter((t) => t.status === 'done').length;
        const overdueTasks = projectTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
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
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.healthStatus] - order[b.healthStatus];
      });
  }, [projects, tasks]);

  if (!user) {
    return (
      <Shell title="Overview" subtitle="Loading...">
        <PageSkeleton />
      </Shell>
    );
  }

  const ceoMode = isCEOView(role) || canManage(role);

  return (
    <Shell
      title={ceoMode ? 'Command Center' : 'My Overview'}
      subtitle={ceoMode ? 'Outcomes, risks, and team performance' : 'Your tasks and progress'}
    >
      {ceoMode ? (
        <CEODashboard
          tasks={tasks}
          projects={projects}
          team={team}
          projectHealth={projectHealth}
        />
      ) : (
        <StaffDashboard
          tasks={tasks}
          currentUser={user}
          projects={projects}
          onUpdateTask={updateTask}
        />
      )}
    </Shell>
  );
}
