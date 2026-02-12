'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { canAssignTasks } from '@/lib/roles';
import { formatDate, isOverdue } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import type { Task, User, TaskComment, TaskActivity, TaskStatus, TaskPriority } from '@/types/database';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
  currentUser: User;
  team: User[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
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

export function TaskDetailDrawer({
  task,
  onClose,
  currentUser,
  team,
  onUpdateTask,
}: TaskDetailDrawerProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const [sending, setSending] = useState(false);

  const supabase = createClient();
  const canAssign = canAssignTasks(currentUser.role);

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
  }, [task, supabase]);

  useEffect(() => {
    if (task) {
      loadDetails();
      setNewComment('');
      setActiveTab('comments');
    }
  }, [task, loadDetails]);

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
    await onUpdateTask(task.id, { [field]: value || null });

    await supabase.from('task_activity').insert({
      task_id: task.id,
      user_id: currentUser.id,
      action: `${field}_changed`,
      meta: { from: (task as unknown as Record<string, unknown>)[field], to: value },
    });
  }

  const overdue = task ? isOverdue(task.due_date, task.status) : false;

  return (
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
                <DialogTitle className="text-[16px] font-bold leading-tight text-text">
                  {task?.title}
                </DialogTitle>
                {task?.project && (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: task.project.color }}
                    />
                    <p className="text-[12px] font-medium text-muted">
                      {task.project.name}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-3 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Fields */}
            {task && (
              <div className="space-y-4 border-b border-border p-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </span>
                  <select
                    value={task.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Priority
                  </span>
                  <select
                    value={task.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={task.due_date ?? ''}
                      onChange={(e) => handleFieldChange('due_date', e.target.value)}
                      className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
                    />
                    {overdue && (
                      <Badge variant="danger">OVERDUE</Badge>
                    )}
                  </div>
                </div>

                {/* Assignee */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Assignee
                  </span>
                  <select
                    value={task.assignee_id ?? ''}
                    onChange={(e) => handleFieldChange('assignee_id', e.target.value)}
                    disabled={!canAssign}
                    className="rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] font-medium text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {team.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                {task.description && (
                  <div>
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Description
                    </span>
                    <p className="rounded-lg bg-bg p-3 text-[13px] leading-relaxed text-text/80">
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
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    'relative px-4 py-2.5 text-[12px] font-semibold capitalize transition-colors',
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
                    <p className="py-8 text-center text-[12px] text-muted">
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
                          <span className="text-[12px] font-semibold text-text">
                            {c.user?.full_name ?? 'Unknown'}
                          </span>
                          <span className="text-[10px] text-muted">
                            {format(new Date(c.created_at), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-text/80">
                          {c.body}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.length === 0 && (
                    <p className="py-8 text-center text-[12px] text-muted">
                      No activity yet
                    </p>
                  )}
                  {activity.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-start gap-3 text-[12px]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <div>
                        <span className="font-semibold text-accent">
                          {a.user?.full_name ?? 'Unknown'}
                        </span>{' '}
                        <span className="text-muted">
                          {a.action.replace(/_/g, ' ')}
                        </span>
                        <p className="mt-0.5 text-[10px] text-muted">
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
              <div className="flex gap-2 border-t border-border p-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-[13px] text-text placeholder:text-muted/50 transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted"
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
  );
}
