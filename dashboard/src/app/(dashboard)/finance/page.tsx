'use client';

import { Shell } from '@/components/layout/shell';

export default function FinancePage() {
  return (
    <Shell title="Finance" subtitle="Financial overview">
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted">
          Financial dashboard — coming soon
        </p>
      </div>
    </Shell>
  );
}
