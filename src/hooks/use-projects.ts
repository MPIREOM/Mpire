'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types/database';

export function useProjects() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR<Project[]>(
    'projects',
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Project[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const createProject = useCallback(
    async (project: { name: string; status: string; color: string; company_id: string }) => {
      const { error } = await supabase.from('projects').insert(project);
      if (error) throw error;
      mutate();
    },
    [supabase, mutate]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      // Clean up task comments and activity before deleting (FK constraints)
      const { data: projectTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId);

      if (projectTasks && projectTasks.length > 0) {
        const taskIds = projectTasks.map((t: { id: string }) => t.id);
        await supabase.from('task_comments').delete().in('task_id', taskIds);
        await supabase.from('task_activity').delete().in('task_id', taskIds);
      }

      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      mutate();
    },
    [supabase, mutate]
  );

  return {
    projects: data ?? [],
    isLoading,
    error,
    mutate,
    createProject,
    deleteProject,
  };
}
