'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';

const supabase = createClient();

export function useTeam() {
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

  // Realtime subscription — live updates when users are added/edited/removed
  useEffect(() => {
    const channel = supabase
      .channel('team-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        () => { mutate(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mutate]);

  return {
    team: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
