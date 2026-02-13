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
        .select('*, project:projects(*), assignee:users!tasks_assignee_id_fkey(*)')
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
    async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'assignee'>) => {
      const { error } = await supabase.from('tasks').insert(task);
      if (error) throw error;
      mutate();
    },
    [mutate]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      // Relies on ON DELETE CASCADE for task_comments and task_activity.
      // See supabase/migration-cascade.sql
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
    deleteTask,
    completeTask,
  };
}
