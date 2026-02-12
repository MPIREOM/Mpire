'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { UploadDialog } from './upload-dialog';
import { useFinanceRecords, useFinanceUploads } from '@/hooks/use-finance';
import { format } from 'date-fns';

interface ProjectFinanceTabProps {
  projectId: string;
}

export function ProjectFinanceTab({ projectId }: ProjectFinanceTabProps) {
  const { records, mutate: mutateRecords } = useFinanceRecords(projectId);
  const { uploads, mutate: mutateUploads } = useFinanceUploads(projectId);
  const [showUpload, setShowUpload] = useState(false);

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const burnThisMonth = records
      .filter((r) => r.month === currentMonth)
      .reduce((sum, r) => sum + r.amount, 0);

    const totalSpend = records.reduce((sum, r) => sum + r.amount, 0);

    // By category
    const catMap = new Map<string, number>();
    for (const r of records) {
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly trend
    const monthMap = new Map<string, number>();
    for (const r of records) {
      monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.amount);
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Net (income - expenses based on sign)
    const income = records.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const expenses = records.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

    return { burnThisMonth, totalSpend, byCategory, monthlyTrend, income, expenses };
  }, [records]);

  if (records.length === 0 && uploads.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-12">
          <p className="text-[13px] font-medium text-muted">No finance data yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
          >
            <ArrowUpTrayIcon className="h-4 w-4" />
            Upload Excel/CSV
          </button>
        </div>
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          projectId={projectId}
          onUploaded={() => { mutateRecords(); mutateUploads(); }}
        />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Burn This Month', value: summary.burnThisMonth, color: 'text-red' },
    { label: 'Total Spend', value: summary.totalSpend, color: 'text-text' },
    { label: 'Records', value: records.length, color: 'text-blue', isCount: true },
  ];

  return (
    <div className="space-y-6">
      {/* Upload button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
        >
          <ArrowUpTrayIcon className="h-4 w-4" />
          Upload New Data
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
            <p className={clsx('text-xl font-bold tabular-nums', c.color)}>
              {c.isCount
                ? c.value
                : c.value.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
              }
            </p>
          </div>
        ))}
      </div>

      {/* Monthly trend chart */}
      {summary.monthlyTrend.length > 1 && (
        <div>
          <h4 className="mb-3 text-[13px] font-bold text-text">Monthly Trend</h4>
          <div className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={200}>
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

      {/* Category breakdown */}
      {summary.byCategory.length > 0 && (
        <div>
          <h4 className="mb-3 text-[13px] font-bold text-text">By Category</h4>
          <div className="rounded-xl border border-border bg-card">
            {summary.byCategory.map((c, idx) => (
              <div
                key={c.category}
                className={clsx(
                  'flex items-center justify-between px-4 py-2.5',
                  idx !== summary.byCategory.length - 1 && 'border-b border-border'
                )}
              >
                <span className="text-[12px] font-medium text-text">{c.category}</span>
                <span className="text-[12px] font-semibold tabular-nums text-text">
                  {c.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload history */}
      {uploads.length > 0 && (
        <div>
          <h4 className="mb-3 text-[13px] font-bold text-text">Upload History</h4>
          <div className="rounded-xl border border-border bg-card">
            {uploads.map((u, idx) => (
              <div
                key={u.id}
                className={clsx(
                  'flex items-center justify-between px-4 py-2.5',
                  idx !== uploads.length - 1 && 'border-b border-border'
                )}
              >
                <div>
                  <p className="text-[12px] font-medium text-text">{u.file_name}</p>
                  <p className="text-[10px] text-muted">
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

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        projectId={projectId}
        onUploaded={() => { mutateRecords(); mutateUploads(); }}
      />
    </div>
  );
}
