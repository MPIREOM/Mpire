'use client';

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import type { Task, User, Project, TaskStatus, TaskPriority } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek, formatDate } from '@/lib/dates';
import { canViewAllTasks, canAssignTasks, canCreateTasks } from '@/lib/roles';
import { TaskDetailDrawer } from '@/components/operations/task-detail-drawer';
import { TimeReviewDialog, type TimeEntry } from '@/components/tasks/time-review-dialog';

type TabKey = 'today' | 'week' | 'overdue' | 'all';
type GroupBy = 'none' | 'project' | 'status' | 'priority';
type SortBy = 'due_date' | 'priority' | 'updated_at';

interface TaskTableProps {
  tasks: Task[];
  currentUser: User;
  team: User[];
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onCreateTask?: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'assignee'>) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, userId: string, timeEntries: TimeEntry[]) => Promise<void>;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

// Stable color from user name for avatar differentiation
const USER_COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];
function userColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

export function TaskTable({
  tasks,
  currentUser,
  team,
  projects,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  onCompleteTask,
}: TaskTableProps) {
  const [tab, setTab] = useState<TabKey>('today');
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [sortBy, setSortBy] = useState<SortBy>('due_date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    project_id: '',
    priority: 'medium' as TaskPriority,
    due_date: '',
    assignee_id: '',
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [timeReviewTaskId, setTimeReviewTaskId] = useState<string | null>(null);

  const canSeeAll = canViewAllTasks(currentUser.role);
  const canCreate = canCreateTasks(currentUser.role);

  // Resolve selectedTask from live tasks array (fixes stale data bug)
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // Resolve time review task from live tasks array
  const timeReviewTask = useMemo(
    () => tasks.find((t) => t.id === timeReviewTaskId) ?? null,
    [tasks, timeReviewTaskId]
  );

  // Intercept status changes — show time review dialog when marking as "done"
  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    if (newStatus === 'done' && onCompleteTask) {
      setTimeReviewTaskId(taskId);
    } else {
      onUpdateTask(taskId, { status: newStatus });
    }
  }

  async function handleTimeReviewConfirm(taskId: string, entries: TimeEntry[]) {
    if (onCompleteTask) {
      await onCompleteTask(taskId, currentUser.id, entries);
    }
    setTimeReviewTaskId(null);
  }

  // Filter pipeline
  const filtered = useMemo(() => {
    let result = tasks.filter((t) => t.status !== 'done');

    if (viewMode === 'my') {
      result = result.filter((t) => t.assignee_id === currentUser.id);
    }

    switch (tab) {
      case 'today':
        result = result.filter((t) => isDueToday(t.due_date));
        break;
      case 'week':
        result = result.filter((t) => isDueThisWeek(t.due_date));
        break;
      case 'overdue':
        result = result.filter((t) => isOverdue(t.due_date, t.status));
        break;
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project?.name.toLowerCase().includes(q) ||
          t.assignee?.full_name.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'updated_at') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    return result;
  }, [tasks, viewMode, tab, search, sortBy, currentUser.id]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', tasks: filtered }];
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      let key = '';
      if (groupBy === 'project') key = t.project?.name ?? 'No Project';
      else if (groupBy === 'status') key = t.status;
      else if (groupBy === 'priority') key = t.priority;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).map(([label, tasks]) => ({ label, tasks }));
  }, [filtered, groupBy]);

  const tabs: { key: TabKey; label: string; count: number }[] = useMemo(() => {
    const base = tasks.filter(
      (t) => t.status !== 'done' && (viewMode === 'all' || t.assignee_id === currentUser.id)
    );
    return [
      { key: 'today', label: 'Today', count: base.filter((t) => isDueToday(t.due_date)).length },
      { key: 'week', label: 'This Week', count: base.filter((t) => isDueThisWeek(t.due_date)).length },
      { key: 'overdue', label: 'Overdue', count: base.filter((t) => isOverdue(t.due_date, t.status)).length },
      { key: 'all', label: 'All', count: base.length },
    ];
  }, [tasks, viewMode, currentUser.id]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t) => t.id)));
  }

  async function bulkUpdateStatus(status: TaskStatus) {
    await Promise.all(Array.from(selectedIds).map((id) => onUpdateTask(id, { status })));
    setSelectedIds(new Set());
  }

  async function bulkUpdateAssignee(assigneeId: string | null) {
    await Promise.all(Array.from(selectedIds).map((id) => onUpdateTask(id, { assignee_id: assigneeId })));
    setSelectedIds(new Set());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!onCreateTask || !createForm.title.trim() || !createForm.project_id) return;
    setCreateSaving(true);
    try {
      await onCreateTask({
        title: createForm.title.trim(),
        project_id: createForm.project_id,
        priority: createForm.priority,
        due_date: createForm.due_date || null,
        assignee_id: createForm.assignee_id || null,
        description: null,
        status: 'todo',
        created_by: currentUser.id,
        recurring_rule: null,
        tags: [],
      });
      setShowCreate(false);
      setCreateForm({ title: '', project_id: '', priority: 'medium', due_date: '', assignee_id: '' });
    } finally {
      setCreateSaving(false);
    }
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          <button
            onClick={() => setViewMode('my')}
            className={clsx(
              'rounded-md px-3 py-1 text-[12px] font-semibold transition-colors',
              viewMode === 'my' ? 'bg-accent text-white' : 'text-muted hover:text-text'
            )}
          >
            My Tasks
          </button>
          {canSeeAll && (
            <button
              onClick={() => setViewMode('all')}
              className={clsx(
                'rounded-md px-3 py-1 text-[12px] font-semibold transition-colors',
                viewMode === 'all' ? 'bg-accent text-white' : 'text-muted hover:text-text'
              )}
            >
              All Tasks
            </button>
          )}
        </div>

        <div className="relative min-w-[160px] flex-1">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-[12px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
          />
        </div>

        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-muted focus:outline-none focus:ring-1 focus:ring-accent-muted"
        >
          <option value="none">No grouping</option>
          <option value="project">By Project</option>
          <option value="status">By Status</option>
          <option value="priority">By Priority</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-muted focus:outline-none focus:ring-1 focus:ring-accent-muted"
        >
          <option value="due_date">Sort: Due date</option>
          <option value="priority">Sort: Priority</option>
          <option value="updated_at">Sort: Last updated</option>
        </select>

        {/* Create task button */}
        {canCreate && onCreateTask && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-light"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Task
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedIds(new Set()); }}
            className={clsx(
              'relative px-3 py-2 text-[12px] font-semibold transition-colors',
              tab === t.key ? 'text-accent' : 'text-muted hover:text-text'
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={clsx(
                'ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                tab === t.key ? 'bg-accent-muted text-accent' : 'bg-bg text-muted'
              )}>
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-accent bg-accent-muted px-3 py-2">
          <span className="text-[12px] font-semibold text-accent">{selectedIds.size} selected</span>
          <select
            onChange={(e) => { if (e.target.value) bulkUpdateStatus(e.target.value as TaskStatus); e.target.value = ''; }}
            className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-text focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>Set status...</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {canAssignTasks(currentUser.role) && (
            <select
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__unassign') bulkUpdateAssignee(null);
                else if (v) bulkUpdateAssignee(v);
                e.target.value = '';
              }}
              className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-text focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>Assign to...</option>
              <option value="__unassign">Unassigned</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-[11px] font-semibold text-muted hover:text-text">Clear</button>
        </div>
      )}

      {/* Task rows */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] text-muted">No tasks match your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label || 'default'}>
              {group.label && (
                <div className="mb-1.5 flex items-center gap-2">
                  {groupBy === 'project' && group.tasks[0]?.project?.color && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.tasks[0].project.color }} />
                  )}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                  <span className="rounded-full bg-bg px-1.5 py-0.5 text-[9px] font-bold text-muted">{group.tasks.length}</span>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border px-4 py-1.5">
                  <button
                    onClick={toggleSelectAll}
                    className={clsx(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      allSelected ? 'border-accent bg-accent text-white' : 'border-border hover:border-accent'
                    )}
                  >
                    {allSelected && <CheckIcon className="h-3 w-3" />}
                  </button>
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Task</span>
                  <span className="w-24 text-[10px] font-semibold uppercase tracking-wide text-muted">Assignee</span>
                  <span className="w-16 text-right text-[10px] font-semibold uppercase tracking-wide text-muted">Due</span>
                </div>

                {group.tasks.map((task, idx) => {
                  const overdue = isOverdue(task.due_date, task.status);
                  const selected = selectedIds.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-2 transition-colors hover:bg-bg',
                        idx !== group.tasks.length - 1 && 'border-b border-border',
                        selected && 'bg-accent-muted'
                      )}
                    >
                      <button
                        onClick={() => toggleSelect(task.id)}
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          selected ? 'border-accent bg-accent text-white' : 'border-border hover:border-accent'
                        )}
                      >
                        {selected && <CheckIcon className="h-3 w-3" />}
                      </button>
                      <div className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: task.project?.color ?? '#6b7280' }} />
                      <select
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        className={clsx(
                          'h-6 shrink-0 cursor-pointer rounded-md border-0 px-1 text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-accent-muted',
                          task.status === 'in_progress' ? 'bg-blue-bg text-blue' :
                          task.status === 'blocked' ? 'bg-red-bg text-red' :
                          task.status === 'done' ? 'bg-green-bg text-green' : 'bg-bg text-muted'
                        )}
                      >
                        {statusOptions.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button onClick={() => setSelectedTaskId(task.id)} className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-text hover:text-accent">
                        {task.title}
                      </button>
                      <span
                        className={clsx('h-2 w-2 shrink-0 rounded-full', task.priority === 'high' ? 'bg-red' : task.priority === 'medium' ? 'bg-yellow' : 'bg-blue')}
                        title={task.priority}
                      />
                      <span className="w-24 truncate text-[11px] text-muted">
                        {task.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                              style={{ backgroundColor: userColor(task.assignee.full_name) }}
                              title={task.assignee.full_name}
                            >
                              {task.assignee.full_name.charAt(0)}
                            </span>
                            <span className="hidden truncate sm:inline">{task.assignee.full_name.split(' ')[0]}</span>
                          </span>
                        ) : (
                          <span className="text-muted/50">—</span>
                        )}
                      </span>
                      <span className={clsx('w-16 shrink-0 text-right text-[11px] tabular-nums', overdue ? 'font-semibold text-red' : 'text-muted')}>
                        {task.due_date ? formatDate(task.due_date) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        currentUser={currentUser}
        team={team}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onCompleteTask={onCompleteTask}
      />

      {/* Time Review Dialog — shown when marking a task as done */}
      <TimeReviewDialog
        task={timeReviewTask}
        open={!!timeReviewTaskId}
        onConfirm={handleTimeReviewConfirm}
        onCancel={() => setTimeReviewTaskId(null)}
      />

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[15px] font-bold text-text">New Task</DialogTitle>
              <button onClick={() => setShowCreate(false)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Title</label>
                <input type="text" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="What needs to be done?" className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Project</label>
                <select required value={createForm.project_id} onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted">
                  <option value="">Select project...</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Priority</label>
                  <select value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Due Date</label>
                  <input type="date" value={createForm.due_date} onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted" />
                </div>
              </div>
              {canAssignTasks(currentUser.role) && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Assignee</label>
                  <select value={createForm.assignee_id} onChange={(e) => setCreateForm({ ...createForm, assignee_id: e.target.value })} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted">
                    <option value="">Unassigned</option>
                    {team.map((u) => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text">Cancel</button>
                <button type="submit" disabled={createSaving} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-light disabled:opacity-50">
                  {createSaving ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
