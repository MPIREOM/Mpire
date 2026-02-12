'use client';

import { Shell } from '@/components/layout/shell';
import { useTeam } from '@/hooks/use-team';

export default function PeoplePage() {
  const { team, isLoading } = useTeam();

  return (
    <Shell title="People" subtitle="Team directory">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
                  {u.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-text">
                    {u.full_name}
                  </h3>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {u.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
