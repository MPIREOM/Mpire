'use client';

import { Shell } from '@/components/layout/shell';
import { useProjects } from '@/hooks/use-projects';

export default function ProjectsPage() {
  const { projects, isLoading } = useProjects();

  return (
    <Shell title="Projects" subtitle="All projects">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color }}
                />
                <h3 className="text-[14px] font-semibold text-text">
                  {p.name}
                </h3>
              </div>
              <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
