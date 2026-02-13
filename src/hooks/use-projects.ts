'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types/database';

const supabase = createClient();

export function useProjects() {
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
    [mutate]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      // Relies on ON DELETE CASCADE for tasks → task_comments/task_activity.
      // See supabase/migration-cascade.sql
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      mutate();
    },
    [mutate]
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
