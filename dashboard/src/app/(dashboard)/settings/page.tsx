'use client';

import { Shell } from '@/components/layout/shell';

export default function SettingsPage() {
  return (
    <Shell title="Settings" subtitle="System configuration">
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted">
          Settings — coming soon
        </p>
      </div>
    </Shell>
  );
}
