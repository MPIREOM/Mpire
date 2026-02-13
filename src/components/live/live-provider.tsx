'use client';

import { createContext, useContext } from 'react';
import { useUser } from '@/hooks/use-user';
import { usePresence, type PresenceUser } from '@/hooks/use-presence';
import { useActivityFeed, type FeedEvent } from '@/hooks/use-activity-feed';
import { useVisitStats, type UserVisitStats } from '@/hooks/use-visit-stats';

interface LiveContextValue {
  onlineUsers: PresenceUser[];
  events: FeedEvent[];
  clearEvents: () => void;
  visitStats: UserVisitStats[];
  currentUserId: string | undefined;
}

const LiveContext = createContext<LiveContextValue>({
  onlineUsers: [],
  events: [],
  clearEvents: () => {},
  visitStats: [],
  currentUserId: undefined,
});

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { onlineUsers } = usePresence(user);
  const { events, clearEvents } = useActivityFeed();
  const { visitStats } = useVisitStats();

  return (
    <LiveContext.Provider
      value={{
        onlineUsers,
        events,
        clearEvents,
        visitStats,
        currentUserId: user?.id,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  return useContext(LiveContext);
}
