'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Task, User, Project, TaskStatus } from '@/types/database';
import { isOverdue, isDueToday } from '@/lib/dates';
import { canViewAllTasks, canAssignTasks } from '@/lib/roles';
import { isAssignedTo, getTaskAssignees } from '@/lib/task-helpers';
import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskItem } from './task-item';
import { FilterDrawer, type FilterState } from './filter-drawer';
import { TaskDetailDrawer } from './task-detail-drawer';

type TabKey = 'all' | 'today' | 'overdue' | 'completed' | 'backlog';

interface TaskListProps {
  tasks: Task[];
  currentUser: User;
  team: User[];
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onSetAssignees?: (taskId: string, userIds: string[]) => Promise<void>;
}

export function TaskList({
  tasks,
  currentUser,
  team,
  projects,
  onUpdateTask,
  onSetAssignees,
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

    if (viewMode === 'my') {
      result = result.filter((t) => isAssignedTo(t, currentUser.id));
    }

    switch (tab) {
      case 'today':
        result = result.filter((t) => isDueToday(t.due_date) && t.status !== 'done' && t.status !== 'backlog');
        break;
      case 'overdue':
        result = result.filter((t) => isOverdue(t.due_date, t.status));
        break;
      case 'completed':
        result = result.filter((t) => t.status === 'done');
        break;
      case 'backlog':
        result = result.filter((t) => t.status === 'backlog');
        break;
      case 'all':
        result = result.filter((t) => t.status !== 'done' && t.status !== 'backlog');
        break;
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project?.name.toLowerCase().includes(q) ||
          getTaskAssignees(t).some((u) => u.full_name.toLowerCase().includes(q))
      );
    }

    if (filters.status) result = result.filter((t) => t.status === filters.status);
    if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
    if (filters.projectId) result = result.filter((t) => t.project_id === filters.projectId);
    if (filters.assigneeId && canAssign) result = result.filter((t) => isAssignedTo(t, filters.assigneeId!));

    return result;
  }, [tasks, viewMode, tab, search, filters, currentUser.id, canAssign]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    {
      key: 'all',
      label: 'All',
      count: tasks.filter((t) => t.status !== 'done' && t.status !== 'backlog' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
    {
      key: 'today',
      label: 'Due Today',
      count: tasks.filter((t) => isDueToday(t.due_date) && t.status !== 'done' && t.status !== 'backlog' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
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
    {
      key: 'backlog',
      label: 'Backlog',
      count: tasks.filter((t) => t.status === 'backlog' && (viewMode === 'all' || t.assignee_id === currentUser.id)).length,
    },
  ];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      {/* Sticky search/filter bar */}
      <div className="sticky top-14 z-10 -mx-4 mb-6 border-b border-border bg-card/80 px-4 pb-4 pt-4 backdrop-blur-xl lg:-mx-6 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-bg p-0.5">
            <button
              onClick={() => setViewMode('my')}
              className={cn(
                'rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-200',
                viewMode === 'my'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-text'
              )}
            >
              My Tasks
            </button>
            {canSeeAll && (
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all duration-200',
                  viewMode === 'all'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-muted hover:text-text'
                )}
              >
                All Tasks
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted/50 transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-text"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter button */}
          <Button
            variant={activeFilterCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterOpen(true)}
            className="gap-1.5"
          >
            <FunnelIcon className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Active filter tags */}
        <AnimatePresence>
          {activeFilterCount > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden"
            >
              {filters.status && (
                <Badge variant="accent" className="cursor-pointer gap-1" onClick={() => setFilters((f) => ({ ...f, status: undefined }))}>
                  {filters.status.replace('_', ' ')}
                  <XMarkIcon className="h-3 w-3" />
                </Badge>
              )}
              {filters.priority && (
                <Badge variant="accent" className="cursor-pointer gap-1" onClick={() => setFilters((f) => ({ ...f, priority: undefined }))}>
                  {filters.priority}
                  <XMarkIcon className="h-3 w-3" />
                </Badge>
              )}
              {filters.projectId && (
                <Badge variant="accent" className="cursor-pointer gap-1" onClick={() => setFilters((f) => ({ ...f, projectId: undefined }))}>
                  {projects.find((p) => p.id === filters.projectId)?.name ?? 'Project'}
                  <XMarkIcon className="h-3 w-3" />
                </Badge>
              )}
              {filters.assigneeId && (
                <Badge variant="accent" className="cursor-pointer gap-1" onClick={() => setFilters((f) => ({ ...f, assigneeId: undefined }))}>
                  {team.find((u) => u.id === filters.assigneeId)?.full_name ?? 'Assignee'}
                  <XMarkIcon className="h-3 w-3" />
                </Badge>
              )}
              <button
                onClick={() => setFilters({})}
                className="text-xs font-medium text-muted hover:text-text"
              >
                Clear all
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === t.key ? 'text-accent' : 'text-muted hover:text-text'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  'ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                  tab === t.key ? 'bg-accent-muted text-accent' : 'bg-bg text-muted'
                )}
              >
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <motion.span
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent"
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Task items */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <EmptyState
            title="No tasks found"
            description={search ? 'Try a different search term or clear your filters.' : 'All caught up! No tasks match this view.'}
          />
        ) : (
          <motion.div layout className="space-y-2">
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
          </motion.div>
        )}
      </AnimatePresence>

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
        onSetAssignees={onSetAssignees}
      />
    </div>
  );
}
