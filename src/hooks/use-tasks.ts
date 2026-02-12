'use client';

import useSWR from 'swr';
import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Task } from '@/types/database';

interface UseTasksOptions {
  projectId?: string;
  assigneeId?: string;
}

export function useTasks(options?: UseTasksOptions) {
  const supabase = createClient();
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
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
  }, [supabase, mutate]);

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      mutate();
    },
    [supabase, mutate]
  );

  const createTask = useCallback(
    async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'assignee'>) => {
      const { error } = await supabase.from('tasks').insert(task);
      if (error) throw error;
      mutate();
    },
    [supabase, mutate]
  );

  return {
    tasks: data ?? [],
    isLoading,
    error,
    mutate,
    updateTask,
    createTask,
  };
}
