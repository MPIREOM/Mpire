'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';

const supabase = createClient();

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    'current-user',
    async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      return profile as User | null;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    user: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
