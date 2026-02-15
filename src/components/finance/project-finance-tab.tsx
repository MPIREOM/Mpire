'use client';

import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

export function ProjectFinanceTab() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-12">
      <p className="text-sm font-medium text-text">
        Finance data is now tracked per business
      </p>
      <p className="text-[13px] text-muted">
        View and manage financial data from the Finance page, where you can add businesses and upload data.
      </p>
      <Link
        href="/finance"
        className="mt-2 flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
      >
        Go to Finance
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
