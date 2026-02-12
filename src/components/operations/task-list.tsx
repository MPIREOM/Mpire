'use client';

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import type { Task, User, Project, TaskStatus, TaskPriority } from '@/types/database';
import { isOverdue, isDueToday, formatDate } from '@/lib/dates';
import { canViewAllTasks, canAssignTasks } from '@/lib/roles';
import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { TaskItem } from './task-item';
import { FilterDrawer, type FilterState } from './filter-drawer';
import { TaskDetailDrawer } from './task-detail-drawer';

type TabKey = 'all' | 'today' | 'overdue' | 'completed';

interface TaskListProps {
  tasks: Task[];
  currentUser: User;
  team: User[];
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

export function TaskList({
  tasks,
  currentUser,
  team,
  projects,
  onUpdateTask,
}: TaskListProps) {
  const [tab, setTab] = useState<TabKey>('all');
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<FilterState>({});

  const canSeeAll = canViewAllTasks(currentUser.role);
  const canAssign = canAssignTasks(currentUser.role);

  // Filtering pipeline
  const filtered = useMemo(() => {
    let result = tasks;

    // View mode filter
    if (viewMode === 'my') {
      result = result.filter((t) => t.assignee_id === currentUser.id);
    }

    // Tab filter
    switch (tab) {
      case 'today':
        result = result.filter((t) => isDueToday(t.due_date) && t.status !== 'done');
        break;
      case 'overdue':
        result = result.filter((t) => isOverdue(t.due_date, t.status));
        break;
      case 'completed':
        result = result.filter((t) => t.status === 'done');
        break;
      case 'all':
        result = result.filter((t) => t.status !== 'done');
        break;
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project?.name.toLowerCase().includes(q) ||
          t.assignee?.full_name.toLowerCase().includes(q)
      );
    }

    // Drawer filters
    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters.priority) {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters.projectId) {
      result = result.filter((t) => t.project_id === filters.projectId);
    }
    if (filters.assigneeId && canAssign) {
      result = result.filter((t) => t.assignee_id === filters.assigneeId);
    }

    return result;
  }, [tasks, viewMode, tab, search, filters, currentUser.id, canAssign]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    {
      key: 'all',
      label: 'All',
      count: tasks.filter((t) => t.status !== 'done' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
    {
      key: 'today',
      label: 'Due Today',
      count: tasks.filter((t) => isDueToday(t.due_date) && t.status !== 'done' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      count: tasks.filter((t) => isOverdue(t.due_date, t.status) && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
    {
      key: 'completed',
      label: 'Completed',
      count: tasks.filter((t) => t.status === 'done' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
  ];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      {/* Header row: toggle + search + filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          <button
            onClick={() => setViewMode('my')}
            className={clsx(
              'rounded-md px-3 py-1 text-[12px] font-semibold transition-colors',
              viewMode === 'my'
                ? 'bg-accent text-white'
                : 'text-muted hover:text-text'
            )}
          >
            My Tasks
          </button>
          {canSeeAll && (
            <button
              onClick={() => setViewMode('all')}
              className={clsx(
                'rounded-md px-3 py-1 text-[12px] font-semibold transition-colors',
                viewMode === 'all'
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-text'
              )}
            >
              All Tasks
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-[12px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
          />
        </div>

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors',
            activeFilterCount > 0
              ? 'border-accent bg-accent-muted text-accent'
              : 'border-border bg-card text-muted hover:text-text'
          )}
        >
          <FunnelIcon className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'relative px-3 py-2 text-[12px] font-semibold transition-colors',
              tab === t.key
                ? 'text-accent'
                : 'text-muted hover:text-text'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={clsx(
                  'ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                  tab === t.key
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg text-muted'
                )}
              >
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Task items */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">No tasks match your filters</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              currentUser={currentUser}
              onClick={() => setSelectedTask(task)}
              onStatusChange={(status) =>
                onUpdateTask(task.id, { status: status as TaskStatus })
              }
            />
          ))}
        </div>
      )}

      {/* Filter Drawer */}
      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setFilterOpen(false);
        }}
        onClear={() => {
          setFilters({});
          setFilterOpen(false);
        }}
        projects={projects}
        team={canAssign ? team : []}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUser={currentUser}
        team={team}
        onUpdateTask={onUpdateTask}
      />
    </div>
  );
}
