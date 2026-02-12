'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Shell } from '@/components/layout/shell';
import { TaskTable } from '@/components/tasks/task-table';
import { TeamWorkload } from '@/components/tasks/team-workload';
import { useUser } from '@/hooks/use-user';
import { useTasks } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useTeam } from '@/hooks/use-team';
import { canManage } from '@/lib/roles';

export default function TasksPage() {
  const { user } = useUser();
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const { team } = useTeam();
  const [view, setView] = useState<'tasks' | 'team'>('tasks');

  const role = user?.role ?? 'staff';
  const showTeamView = canManage(role);

  if (!user) {
    return (
      <Shell title="Tasks" subtitle="Loading...">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Tasks" subtitle="Manage and track work">
      <div className="space-y-4">
        {/* View toggle (tasks vs team) */}
        {showTeamView && (
          <div className="flex rounded-lg border border-border bg-card p-0.5 w-fit">
            <button
              onClick={() => setView('tasks')}
              className={clsx(
                'rounded-md px-4 py-1.5 text-[12px] font-semibold transition-colors',
                view === 'tasks' ? 'bg-accent text-white' : 'text-muted hover:text-text'
              )}
            >
              Task List
            </button>
            <button
              onClick={() => setView('team')}
              className={clsx(
                'rounded-md px-4 py-1.5 text-[12px] font-semibold transition-colors',
                view === 'team' ? 'bg-accent text-white' : 'text-muted hover:text-text'
              )}
            >
              Team View
            </button>
          </div>
        )}

        {view === 'tasks' ? (
          <TaskTable
            tasks={tasks}
            currentUser={user}
            team={team}
            projects={projects}
            onUpdateTask={updateTask}
          />
        ) : (
          <TeamWorkload tasks={tasks} team={team} projects={projects} />
        )}
      </div>
    </Shell>
  );
}
