'use client';

import useSWR from 'swr';
import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/types/database';

const supabase = createClient();

interface UseTasksOptions {
  projectId?: string;
  assigneeId?: string;
}

export function useTasks(options?: UseTasksOptions) {
  const key = `tasks-${options?.projectId ?? 'all'}-${options?.assigneeId ?? 'all'}`;

  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    key,
    async () => {
      let query = supabase
        .from('tasks')
        .select('*, project:projects(*), assignee:users!tasks_assignee_id_fkey(*), task_assignees(task_id, user_id, user:users(*))')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: true });

      if (options?.projectId) {
        query = query.eq('project_id', options.projectId);
      }
      if (options?.assigneeId) {
        query = query.eq('assignee_id', options.assigneeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Realtime subscription — dynamic channel name avoids collision across hook instances
  useEffect(() => {
    const channelName = `tasks-realtime-${key}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          mutate();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        () => {
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, mutate]);

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      mutate();
    },
    [mutate]
  );

  const createTask = useCallback(
    async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'assignee' | 'task_assignees'>) => {
      const { error } = await supabase.from('tasks').insert({
        title: task.title,
        project_id: task.project_id,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assignee_id: task.assignee_id,
        created_by: task.created_by,
        recurring_rule: task.recurring_rule,
      });
      if (error) throw error;
      mutate();
    },
    [mutate]
  );

  /** Create a task and assign multiple users to it */
  const createTaskWithAssignees = useCallback(
    async (
      task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'assignee' | 'task_assignees'>,
      assigneeIds: string[]
    ) => {
      // Pick only real DB columns (tags is on the TS type but not in the table)
      const row = {
        title: task.title,
        project_id: task.project_id,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        assignee_id: assigneeIds[0] ?? null,
        created_by: task.created_by,
        recurring_rule: task.recurring_rule,
      };

      if (assigneeIds.length > 0) {
        // Need the ID back for junction table
        const { data: created, error } = await supabase
          .from('tasks')
          .insert(row)
          .select('id')
          .single();
        if (error) throw error;

        // Insert junction table entries (non-fatal if table doesn't exist yet)
        if (created) {
          await supabase
            .from('task_assignees')
            .insert(assigneeIds.map((uid) => ({ task_id: created.id, user_id: uid })));
        }
      } else {
        const { error } = await supabase.from('tasks').insert(row);
        if (error) throw error;
      }

      mutate();
    },
    [mutate]
  );

  /** Set all assignees for a task (replaces existing) */
  const setTaskAssignees = useCallback(
    async (taskId: string, userIds: string[]) => {
      // Try junction table operations (non-fatal if table doesn't exist yet)
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (userIds.length > 0) {
        await supabase
          .from('task_assignees')
          .insert(userIds.map((uid) => ({ task_id: taskId, user_id: uid })));
      }

      // Keep legacy assignee_id in sync (first assignee or null)
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assignee_id: userIds[0] ?? null })
        .eq('id', taskId);
      if (updateError) throw updateError;

      mutate();
    },
    [mutate]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      // Relies on ON DELETE CASCADE for task_comments, task_activity, and task_assignees.
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      mutate();
    },
    [mutate]
  );

  const completeTask = useCallback(
    async (
      taskId: string,
      userId: string,
      timeEntries: { date: string; hours: number }[]
    ) => {
      if (timeEntries.length > 0) {
        const rows = timeEntries.map((entry) => ({
          task_id: taskId,
          user_id: userId,
          action: 'time_logged',
          meta: { date: entry.date, hours: entry.hours },
        }));
        await supabase.from('task_activity').insert(rows);
      }

      await supabase.from('task_activity').insert({
        task_id: taskId,
        user_id: userId,
        action: 'status_changed',
        meta: { from: 'in_progress', to: 'done' },
      });

      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);
      if (error) throw error;
      mutate();
    },
    [mutate]
  );

  return {
    tasks: data ?? [],
    isLoading,
    error,
    mutate,
    updateTask,
    createTask,
    createTaskWithAssignees,
    setTaskAssignees,
    deleteTask,
    completeTask,
  };
}
