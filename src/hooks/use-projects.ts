'use client';

import useSWR from 'swr';
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

  return {
    projects: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
