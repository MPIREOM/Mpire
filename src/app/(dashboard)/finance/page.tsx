'use client';

import { useMemo, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  PlusIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Shell } from '@/components/layout/shell';
import { UploadDialog } from '@/components/finance/upload-dialog';
import { useFinanceRecords, useFinanceUploads } from '@/hooks/use-finance';
import { useBusinesses } from '@/hooks/use-businesses';
import { useUser } from '@/hooks/use-user';
import { canAccessFinance } from '@/lib/roles';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

export default function FinancePage() {
  const { user } = useUser();
  const { records, isLoading, mutate: mutateRecords } = useFinanceRecords();
  const { uploads, mutate: mutateUploads } = useFinanceUploads();
  const { businesses, createBusiness } = useBusinesses();

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewBusiness, setShowNewBusiness] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);

  if (!user || !canAccessFinance(user.role)) {
    return (
      <Shell title="Finance" subtitle="Access denied">
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-muted">You don&apos;t have access to finance data.</p>
        </div>
      </Shell>
    );
  }

  // Filter records/uploads for the selected business
  const businessRecords = selectedBusinessId
    ? records.filter((r) => r.business_id === selectedBusinessId)
    : records;

  const businessUploads = selectedBusinessId
    ? uploads.filter((u) => u.business_id === selectedBusinessId)
    : uploads;

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId);

  // Summary computed from current view (filtered or all)
  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalBurn = businessRecords
      .filter((r) => r.month === currentMonth)
      .reduce((sum, r) => sum + r.amount, 0);

    const totalAllTime = businessRecords.reduce((sum, r) => sum + r.amount, 0);

    // Monthly trend
    const monthMap = new Map<string, number>();
    for (const r of businessRecords) {
      monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.amount);
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // By category
    const catMap = new Map<string, number>();
    for (const r of businessRecords) {
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Per business breakdown (for all-businesses view)
    const bizMap = new Map<string, number>();
    for (const r of businessRecords) {
      bizMap.set(r.business_id, (bizMap.get(r.business_id) ?? 0) + r.amount);
    }
    const byBusiness = Array.from(bizMap.entries())
      .map(([businessId, amount]) => ({
        business: businesses.find((b) => b.id === businessId),
        amount,
        lastUpload: uploads.find((u) => u.business_id === businessId),
      }))
      .filter((b) => b.business)
      .sort((a, b) => b.amount - a.amount);

    // Stale data alerts
    const staleBusinesses = byBusiness.filter((b) => {
      if (!b.lastUpload) return true;
      return differenceInDays(now, new Date(b.lastUpload.created_at)) > 30;
    });

    return { totalBurn, totalAllTime, monthlyTrend, byCategory, byBusiness, staleBusinesses };
  }, [businessRecords, businesses, uploads]);

  const handleCreateBusiness = useCallback(async () => {
    if (!newBusinessName.trim() || !user) return;
    setCreatingBusiness(true);
    try {
      await createBusiness({
        name: newBusinessName.trim(),
        company_id: user.company_id,
      });
      toast.success(`Business "${newBusinessName.trim()}" created`);
      setNewBusinessName('');
      setShowNewBusiness(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create business');
    } finally {
      setCreatingBusiness(false);
    }
  }, [newBusinessName, user, createBusiness]);

  const kpiCards = [
    {
      label: 'Burn This Month',
      value: summary.totalBurn,
      color: 'text-red',
    },
    {
      label: 'Total All-Time',
      value: summary.totalAllTime,
      color: 'text-text',
    },
    {
      label: selectedBusinessId ? 'Records' : 'Businesses with Data',
      value: selectedBusinessId ? businessRecords.length : summary.byBusiness.length,
      color: 'text-blue',
      isCount: true,
    },
    ...(selectedBusinessId
      ? []
      : [
          {
            label: 'Stale Data',
            value: summary.staleBusinesses.length,
            color: summary.staleBusinesses.length > 0 ? 'text-yellow' : 'text-green',
            isCount: true,
          },
        ]),
  ];

  return (
    <Shell title="Finance" subtitle="Business financial overview & data uploads">
      {/* Toolbar: business selector + actions */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Business selector */}
        <div className="relative">
          <select
            value={selectedBusinessId ?? ''}
            onChange={(e) => setSelectedBusinessId(e.target.value || null)}
            className="appearance-none rounded-xl border border-border bg-card py-2 pl-4 pr-10 text-sm font-semibold text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
          >
            <option value="">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>

        {/* Create business button */}
        <button
          onClick={() => setShowNewBusiness(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
        >
          <PlusIcon className="h-4 w-4" />
          New Business
        </button>

        {/* Upload button (only when a business is selected) */}
        {selectedBusinessId && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Upload Excel/CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : businessRecords.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border">
          <p className="text-sm font-medium text-muted">
            {selectedBusinessId
              ? `No finance data for "${selectedBusiness?.name}"`
              : 'No finance data uploaded yet'}
          </p>
          <p className="text-[13px] text-muted">
            {selectedBusinessId
              ? 'Upload an Excel or CSV file to get started'
              : 'Select a business and upload Excel/CSV finance data'}
          </p>
          {selectedBusinessId && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload Excel/CSV
            </button>
          )}
          {!selectedBusinessId && businesses.length === 0 && (
            <button
              onClick={() => setShowNewBusiness(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
            >
              <PlusIcon className="h-4 w-4" />
              Add Your First Business
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className={clsx('grid gap-4', selectedBusinessId ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4')}>
            {kpiCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={clsx('text-2xl font-bold tabular-nums', c.color)}>
                  {c.isCount
                    ? c.value
                    : (c.value as number).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>

          {/* Stale data alert (all businesses view only) */}
          {!selectedBusinessId && summary.staleBusinesses.length > 0 && (
            <div className="rounded-xl border border-yellow/20 bg-yellow-bg p-4">
              <p className="mb-2 text-sm font-semibold text-yellow">Data Freshness Alert</p>
              <p className="text-[13px] text-muted">
                {summary.staleBusinesses.length} business{summary.staleBusinesses.length !== 1 ? 'es have' : ' has'} finance data older than 30 days:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.staleBusinesses.map((b) => (
                  <button
                    key={b.business!.id}
                    onClick={() => setSelectedBusinessId(b.business!.id)}
                    className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold text-text hover:bg-bg"
                  >
                    {b.business!.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly trend chart */}
          {summary.monthlyTrend.length > 1 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">
                Monthly Trend{selectedBusinessId ? '' : ' (All Businesses)'}
              </h3>
              <div className="rounded-xl border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={summary.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(value) =>
                        Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
                      }
                    />
                    <Bar dataKey="amount" fill="#b08a3e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Category breakdown (when a business is selected) */}
          {selectedBusinessId && summary.byCategory.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">By Category</h3>
              <div className="rounded-xl border border-border bg-card">
                {summary.byCategory.map((c, idx) => (
                  <div
                    key={c.category}
                    className={clsx(
                      'flex items-center justify-between px-4 py-2.5',
                      idx !== summary.byCategory.length - 1 && 'border-b border-border'
                    )}
                  >
                    <span className="text-[13px] font-medium text-text">{c.category}</span>
                    <span className="text-[13px] font-semibold tabular-nums text-text">
                      {c.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-business breakdown (all businesses view) */}
          {!selectedBusinessId && summary.byBusiness.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">By Business</h3>
              <div className="rounded-xl border border-border bg-card">
                {summary.byBusiness.map((b, idx) => (
                  <button
                    key={b.business!.id}
                    onClick={() => setSelectedBusinessId(b.business!.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg',
                      idx !== summary.byBusiness.length - 1 && 'border-b border-border'
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
                      {b.business!.name.charAt(0)}
                    </div>
                    <span className="flex-1 truncate text-sm font-semibold text-text">
                      {b.business!.name}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-text">
                      {b.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload history (when a business is selected) */}
          {selectedBusinessId && businessUploads.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">Upload History</h3>
              <div className="rounded-xl border border-border bg-card">
                {businessUploads.map((u, idx) => (
                  <div
                    key={u.id}
                    className={clsx(
                      'flex items-center justify-between px-4 py-2.5',
                      idx !== businessUploads.length - 1 && 'border-b border-border'
                    )}
                  >
                    <div>
                      <p className="text-[13px] font-medium text-text">{u.file_name}</p>
                      <p className="text-[11px] text-muted">
                        v{u.version} · {u.row_count} rows · {u.uploader?.full_name ?? 'Unknown'}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted">
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload dialog */}
      {selectedBusinessId && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          businessId={selectedBusinessId}
          onUploaded={() => { mutateRecords(); mutateUploads(); }}
        />
      )}

      {/* New business dialog */}
      <Dialog open={showNewBusiness} onClose={() => setShowNewBusiness(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-text">
                Add Business
              </DialogTitle>
              <button
                onClick={() => setShowNewBusiness(false)}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Create a business to track its financial performance.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateBusiness(); }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="e.g. Coffee Shop Downtown"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewBusiness(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBusiness || !newBusinessName.trim()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95 disabled:opacity-50"
                >
                  {creatingBusiness ? 'Creating...' : 'Add Business'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </Shell>
  );
}
