'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';

export function useTeam() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR<User[]>(
    'team',
    async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as User[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  return {
    team: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
