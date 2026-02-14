'use client';

import { useEffect } from 'react';
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

  // Listen for auth state changes (token refresh, sign-out from another tab, session expiry)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') {
        // Clear cached user and redirect to login
        mutate(null, false);
        window.location.href = '/login';
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Re-fetch profile with the new token
        mutate();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [mutate]);

  return {
    user: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
