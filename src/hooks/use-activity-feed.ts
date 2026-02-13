'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

type Payload = { new: Record<string, unknown>; old: Record<string, unknown> };

export interface FeedEvent {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_deleted' | 'project_created' | 'project_updated' | 'project_deleted';
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Subscribes to realtime changes on tasks and projects tables.
 * Returns a rolling list of recent live events (max 50).
 */
export function useActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const counterRef = useRef(0);

  const pushEvent = useCallback((event: Omit<FeedEvent, 'id' | 'timestamp'>) => {
    counterRef.current += 1;
    const newEvent: FeedEvent = {
      ...event,
      id: `${Date.now()}-${counterRef.current}`,
      timestamp: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('live-activity-feed')
      // Tasks
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload: Payload) => {
          pushEvent({ type: 'task_created', table: 'tasks', record: payload.new });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload: Payload) => {
          pushEvent({
            type: 'task_updated',
            table: 'tasks',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload: Payload) => {
          pushEvent({ type: 'task_deleted', table: 'tasks', record: payload.old });
        }
      )
      // Projects
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        (payload: Payload) => {
          pushEvent({ type: 'project_created', table: 'projects', record: payload.new });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects' },
        (payload: Payload) => {
          pushEvent({
            type: 'project_updated',
            table: 'projects',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'projects' },
        (payload: Payload) => {
          pushEvent({ type: 'project_deleted', table: 'projects', record: payload.old });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pushEvent]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, clearEvents };
}
