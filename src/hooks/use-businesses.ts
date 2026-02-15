'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BusinessUnit } from '@/types/database';

const supabase = createClient();

export function useBusinesses() {
  const { data, error, isLoading, mutate } = useSWR<BusinessUnit[]>(
    'businesses',
    async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as BusinessUnit[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('businesses-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_units' },
        () => { mutate(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mutate]);

  async function createBusiness(fields: { name: string; company_id: string }) {
    const { data, error } = await supabase
      .from('business_units')
      .insert(fields)
      .select()
      .single();

    if (error) throw error;
    mutate();
    return data as BusinessUnit;
  }

  return {
    businesses: data ?? [],
    isLoading,
    error,
    mutate,
    createBusiness,
  };
}
