'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import type { UserSession } from '@/types/database';

const supabase = createClient();

export interface UserVisitStats {
  user_id: string;
  total_sessions: number;
  sessions_today: number;
  sessions_this_week: number;
  last_seen_at: string | null;
}

/**
 * Fetches visit/session frequency stats for all company users.
 * Falls back gracefully if user_sessions table doesn't exist yet.
 */
export function useVisitStats() {
  const { data, error, isLoading, mutate } = useSWR<UserVisitStats[]>(
    'visit-stats',
    async () => {
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('id, user_id, started_at')
        .order('started_at', { ascending: false });

      // Table may not exist yet
      if (error) return [];

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();

      const byUser = new Map<string, { total: number; today: number; week: number; lastSeen: string | null }>();

      for (const s of sessions ?? []) {
        const existing = byUser.get(s.user_id) ?? { total: 0, today: 0, week: 0, lastSeen: null };
        existing.total += 1;
        if (s.started_at >= todayStart) existing.today += 1;
        if (s.started_at >= weekStart) existing.week += 1;
        if (!existing.lastSeen || s.started_at > existing.lastSeen) existing.lastSeen = s.started_at;
        byUser.set(s.user_id, existing);
      }

      return Array.from(byUser.entries()).map(([user_id, stats]) => ({
        user_id,
        total_sessions: stats.total,
        sessions_today: stats.today,
        sessions_this_week: stats.week,
        last_seen_at: stats.lastSeen,
      }));
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return { visitStats: data ?? [], isLoading, error, mutate };
}
