'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { FinanceRecord, FinanceUpload } from '@/types/database';

const supabase = createClient();

export function useFinanceRecords(projectId?: string) {
  const key = projectId ? `finance-records-${projectId}` : 'finance-records-all';

  const { data, error, isLoading, mutate } = useSWR<FinanceRecord[]>(
    key,
    async () => {
      let query = supabase
        .from('finance_records')
        .select('*')
        .order('month', { ascending: true });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinanceRecord[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    records: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useFinanceUploads(projectId?: string) {
  const key = projectId ? `finance-uploads-${projectId}` : 'finance-uploads-all';

  const { data, error, isLoading, mutate } = useSWR<FinanceUpload[]>(
    key,
    async () => {
      let query = supabase
        .from('finance_uploads')
        .select('*, uploader:users!finance_uploads_uploaded_by_fkey(*)')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinanceUpload[];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    uploads: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
