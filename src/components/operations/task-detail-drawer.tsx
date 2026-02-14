'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { canAssignTasks, canDeleteTasks } from '@/lib/roles';
import { formatDate, isOverdue } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { AssigneePicker } from '@/components/ui/assignee-picker';
import { getTaskAssigneeIds } from '@/lib/task-helpers';
import type { Task, User, TaskComment, TaskActivity, TaskStatus, TaskPriority } from '@/types/database';
import { TimeReviewDialog, type TimeEntry } from '@/components/tasks/time-review-dialog';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  currentUser: User;
  team: User[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onSetAssignees?: (taskId: string, userIds: string[]) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, userId: string, timeEntries: TimeEntry[]) => Promise<void>;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const priorityOptions: { value: TaskPriority; label: string; variant: 'danger' | 'warning' | 'info' }[] = [
  { value: 'high', label: 'High', variant: 'danger' },
  { value: 'medium', label: 'Medium', variant: 'warning' },
  { value: 'low', label: 'Low', variant: 'info' },
];

const supabase = createClient();

export function TaskDetailDrawer({
  task,
  onClose,
  currentUser,
  team,
  onUpdateTask,
  onSetAssignees,
  onDeleteTask,
  onCompleteTask,
}: TaskDetailDrawerProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTimeReview, setShowTimeReview] = useState(false);

  const canAssign = canAssignTasks(currentUser.role);
  const canDelete = canDeleteTasks(currentUser.role);

  const loadDetails = useCallback(async () => {
    if (!task) return;

    const [commentsRes, activityRes] = await Promise.all([
      supabase
        .from('task_comments')
        .select('*, user:users(*)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('task_activity')
        .select('*, user:users(*)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setComments((commentsRes.data as TaskComment[]) ?? []);
    setActivity((activityRes.data as TaskActivity[]) ?? []);
  }, [task]);

  useEffect(() => {
    if (task) {
      loadDetails();
      setNewComment('');
      setActiveTab('comments');
    }
  }, [task, loadDetails]);

  // Realtime subscription for live comments and activity updates
  useEffect(() => {
    if (!task) return;

    const channel = supabase
      .channel(`task-detail-${task.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${task.id}` },
        () => { loadDetails(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_activity', filter: `task_id=eq.${task.id}` },
        () => { loadDetails(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [task?.id, loadDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddComment() {
    if (!task || !newComment.trim()) return;
    setSending(true);

    await supabase.from('task_comments').insert({
      task_id: task.id,
      user_id: currentUser.id,
      body: newComment.trim(),
    });

    await supabase.from('task_activity').insert({
      task_id: task.id,
      user_id: currentUser.id,
      action: 'commented',
      meta: { body: newComment.trim().substring(0, 100) },
    });

    setNewComment('');
    setSending(false);
    loadDetails();
  }

  async function handleFieldChange(field: string, value: string) {
    if (!task) return;

    // Intercept status->done: show time review dialog instead
    if (field === 'status' && value === 'done' && onCompleteTask) {
      setShowTimeReview(true);
      return;
    }

    // Normalize assignee_id: empty string / "unassigned" -> null, else UUID
    const normalizedValue = field === 'assignee_id'
      ? (!value || value === 'unassigned' ? null : value)
      : (value || null);

    try {
      await onUpdateTask(task.id, { [field]: normalizedValue });
      toast.success('Task updated');

      await supabase.from('task_activity').insert({
        task_id: task.id,
        user_id: currentUser.id,
        action: `${field}_changed`,
        meta: { from: (task as unknown as Record<string, unknown>)[field], to: value },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  }

  async function handleTimeReviewConfirm(taskId: string, entries: TimeEntry[]) {
    if (onCompleteTask) {
      try {
        await onCompleteTask(taskId, currentUser.id, entries);
        toast.success('Task completed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to complete task');
      }
    }
    setShowTimeReview(false);
  }

  async function handleDelete() {
    if (!task || !onDeleteTask) return;
    setDeleting(true);
    try {
      await onDeleteTask(task.id);
      toast.success('Task deleted');
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  }

  const overdue = task ? isOverdue(task.due_date, task.status) : false;

  return (
  <>
    <Dialog open={!!task} onClose={onClose} className="relative z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel className="w-screen max-w-md">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex h-full flex-col border-l border-border bg-card shadow-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-bold leading-tight text-text">
                  {task?.title}
                </DialogTitle>
                {task?.project && (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: task.project.color }}
                    />
                    <p className="text-[13px] font-medium text-muted">
                      {task.project.name}
                    </p>
                  </div>
                )}
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                {canDelete && onDeleteTask && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-bg hover:text-red"
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close task detail"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Fields */}
            {task && (
              <div className="space-y-5 border-b border-border px-6 py-5">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Status
                  </span>
                  <select
                    value={task.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                  >
                    {statusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Priority
                  </span>
                  <select
                    value={task.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={task.due_date ?? ''}
                      onChange={(e) => handleFieldChange('due_date', e.target.value)}
                      className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                    />
                    {overdue && (
                      <Badge variant="danger">OVERDUE</Badge>
                    )}
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Assignees */}
                <div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Assignees
                  </span>
                  <AssigneePicker
                    team={team}
                    selected={getTaskAssigneeIds(task)}
                    onChange={async (ids) => {
                      if (!onSetAssignees) return;
                      try {
                        await onSetAssignees(task.id, ids);
                        toast.success('Assignees updated');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to update assignees');
                      }
                    }}
                    disabled={!canAssign}
                  />
                </div>

                {/* Description */}
                {task.description && (
                  <div>
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Description
                    </span>
                    <p className="rounded-lg bg-bg p-3 text-sm leading-relaxed text-text">
                      {task.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tabs: Comments / Activity */}
            <div className="flex border-b border-border px-6">
              {(['comments', 'activity'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    'relative px-4 py-2.5 text-[13px] font-semibold capitalize transition-colors',
                    activeTab === t ? 'text-accent' : 'text-muted hover:text-text'
                  )}
                >
                  {t}
                  {activeTab === t && (
                    <motion.span
                      layoutId="drawerTab"
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'comments' ? (
                <div className="space-y-4">
                  {comments.length === 0 && (
                    <p className="py-8 text-center text-[13px] text-muted">
                      No comments yet. Start the conversation.
                    </p>
                  )}
                  {comments.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-3"
                    >
                      <Avatar
                        name={c.user?.full_name ?? '?'}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-text">
                            {c.user?.full_name ?? 'Unknown'}
                          </span>
                          <span className="text-xs text-muted">
                            {format(new Date(c.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-text">
                          {c.body}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.length === 0 && (
                    <p className="py-8 text-center text-[13px] text-muted">
                      No activity yet
                    </p>
                  )}
                  {activity.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 text-[13px]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <div>
                        <span className="font-semibold text-accent">
                          {a.user?.full_name ?? 'Unknown'}
                        </span>{' '}
                        <span className="text-muted">
                          {a.action.replace(/_/g, ' ')}
                        </span>
                        <p className="mt-0.5 text-xs text-muted">
                          {format(new Date(a.created_at), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment input */}
            {activeTab === 'comments' && (
              <div className="flex gap-2 border-t border-border px-5 py-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-muted/50 transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  loading={sending}
                  size="icon"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>

    {/* Time Review Dialog — shown when marking task as done */}
    <TimeReviewDialog
      task={task}
      open={showTimeReview}
      onConfirm={handleTimeReviewConfirm}
      onCancel={() => setShowTimeReview(false)}
    />

    {/* Delete confirmation dialog */}
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
          <DialogTitle className="text-base font-bold text-text">Delete Task</DialogTitle>
          <p className="mt-2 text-sm text-muted">
            Are you sure you want to delete &ldquo;{task?.title}&rdquo;? This will also remove all comments and activity. This action cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red/90 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </>
  );
}
