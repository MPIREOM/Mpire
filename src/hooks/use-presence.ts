'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types/database';

const supabase = createClient();

export interface PresenceUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  page: string;
  online_at: string;
}

/**
 * Tracks the current user's presence and returns a live list of online users.
 * Uses Supabase Realtime Presence (no database table needed for online status).
 * Also records sessions to user_sessions for visit frequency tracking.
 */
export function usePresence(currentUser: User | null) {
  const [channelUsers, setChannelUsers] = useState<PresenceUser[]>([]);
  const pathname = usePathname();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Always include current user as online — merge with channel presence
  const onlineUsers = useMemo(() => {
    if (!currentUser) return channelUsers;

    const selfEntry: PresenceUser = {
      user_id: currentUser.id,
      full_name: currentUser.full_name,
      avatar_url: currentUser.avatar_url,
      role: currentUser.role,
      page: pathname,
      online_at: new Date().toISOString(),
    };

    // If channel already has us, use the channel list as-is
    if (channelUsers.some((u) => u.user_id === currentUser.id)) {
      return channelUsers;
    }

    // Otherwise prepend ourselves so we always show as online
    return [selfEntry, ...channelUsers];
  }, [currentUser, channelUsers, pathname]);

  // Record session start + heartbeat to user_sessions table
  useEffect(() => {
    if (!currentUser) return;

    // Create a session row (non-fatal if table doesn't exist)
    (async () => {
      const { data } = await supabase
        .from('user_sessions')
        .insert({ user_id: currentUser.id, page: pathname })
        .select('id')
        .single();

      if (data) sessionIdRef.current = data.id;

      // Update last_seen_at on users table (non-fatal)
      await supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', currentUser.id);
    })();

    // Heartbeat: update last_seen every 30s
    heartbeatRef.current = setInterval(async () => {
      if (sessionIdRef.current) {
        await supabase
          .from('user_sessions')
          .update({ last_seen_at: new Date().toISOString(), page: pathname })
          .eq('id', sessionIdRef.current);
      }
      await supabase
        .from('users')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', currentUser.id);
    }, 30000);

    return () => {
      clearInterval(heartbeatRef.current);
      // Clean up session on unmount
      if (sessionIdRef.current) {
        supabase
          .from('user_sessions')
          .delete()
          .eq('id', sessionIdRef.current)
          .then();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Update page in session when pathname changes
  useEffect(() => {
    if (!sessionIdRef.current) return;
    supabase
      .from('user_sessions')
      .update({ page: pathname })
      .eq('id', sessionIdRef.current)
      .then();
  }, [pathname]);

  // Supabase Realtime Presence channel
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const [, entries] of Object.entries(state)) {
          const first = (entries as PresenceUser[])[0];
          if (first) users.push(first);
        }
        setChannelUsers(users);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            full_name: currentUser.full_name,
            avatar_url: currentUser.avatar_url,
            role: currentUser.role,
            page: pathname,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Update presence tracking when pathname changes
  useEffect(() => {
    if (!currentUser || !channelRef.current) return;
    channelRef.current.track({
      user_id: currentUser.id,
      full_name: currentUser.full_name,
      avatar_url: currentUser.avatar_url,
      role: currentUser.role,
      page: pathname,
      online_at: new Date().toISOString(),
    }).catch(() => {
      // Channel may not be subscribed yet
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return { onlineUsers };
}
