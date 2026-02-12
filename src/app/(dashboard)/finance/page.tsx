'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
import { Shell } from '@/components/layout/shell';
import { useFinanceRecords, useFinanceUploads } from '@/hooks/use-finance';
import { useProjects } from '@/hooks/use-projects';
import { differenceInDays } from 'date-fns';

export default function FinancePage() {
  const { records, isLoading } = useFinanceRecords();
  const { uploads } = useFinanceUploads();
  const { projects } = useProjects();

  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalBurn = records
      .filter((r) => r.month === currentMonth)
      .reduce((sum, r) => sum + r.amount, 0);

    const totalAllTime = records.reduce((sum, r) => sum + r.amount, 0);

    // Monthly trend across all projects
    const monthMap = new Map<string, number>();
    for (const r of records) {
      monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.amount);
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Per project breakdown
    const projectMap = new Map<string, number>();
    for (const r of records) {
      projectMap.set(r.project_id, (projectMap.get(r.project_id) ?? 0) + r.amount);
    }
    const byProject = Array.from(projectMap.entries())
      .map(([projectId, amount]) => ({
        project: projects.find((p) => p.id === projectId),
        amount,
        lastUpload: uploads.find((u) => u.project_id === projectId),
      }))
      .filter((p) => p.project)
      .sort((a, b) => b.amount - a.amount);

    // Stale data alerts: projects with uploads older than 30 days
    const staleProjects = byProject.filter((p) => {
      if (!p.lastUpload) return true;
      return differenceInDays(now, new Date(p.lastUpload.created_at)) > 30;
    });

    return { totalBurn, totalAllTime, monthlyTrend, byProject, staleProjects };
  }, [records, projects, uploads]);

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
      label: 'Projects with Data',
      value: summary.byProject.length,
      color: 'text-blue',
      isCount: true,
    },
    {
      label: 'Stale Data',
      value: summary.staleProjects.length,
      color: summary.staleProjects.length > 0 ? 'text-yellow' : 'text-green',
      isCount: true,
    },
  ];

  return (
    <Shell title="Finance" subtitle="Cross-project financial overview">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border">
          <p className="text-[13px] text-muted">No finance data uploaded yet</p>
          <p className="text-[11px] text-muted">Go to a project and upload Excel/CSV finance data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpiCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.label}</p>
                <p className={clsx('text-xl font-bold tabular-nums', c.color)}>
                  {c.isCount
                    ? c.value
                    : c.value.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>

          {/* Stale data alert */}
          {summary.staleProjects.length > 0 && (
            <div className="rounded-xl border border-yellow/20 bg-yellow-bg p-4">
              <p className="mb-2 text-[12px] font-semibold text-yellow">Data Freshness Alert</p>
              <p className="text-[11px] text-muted">
                {summary.staleProjects.length} project{summary.staleProjects.length !== 1 ? 's have' : ' has'} finance data older than 30 days:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.staleProjects.map((p) => (
                  <Link
                    key={p.project!.id}
                    href={`/projects/${p.project!.id}`}
                    className="rounded-md bg-card px-2 py-0.5 text-[11px] font-semibold text-text hover:bg-bg"
                  >
                    {p.project!.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Monthly trend chart */}
          {summary.monthlyTrend.length > 1 && (
            <div>
              <h3 className="mb-3 text-[13px] font-bold text-text">Monthly Trend (All Projects)</h3>
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

          {/* Per-project breakdown */}
          <div>
            <h3 className="mb-3 text-[13px] font-bold text-text">By Project</h3>
            <div className="rounded-xl border border-border bg-card">
              {summary.byProject.map((p, idx) => (
                <Link
                  key={p.project!.id}
                  href={`/projects/${p.project!.id}`}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg',
                    idx !== summary.byProject.length - 1 && 'border-b border-border'
                  )}
                >
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.project!.color }}
                  />
                  <span className="flex-1 truncate text-[13px] font-semibold text-text">
                    {p.project!.name}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums text-text">
                    {p.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
