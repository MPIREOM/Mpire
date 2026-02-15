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
import { useProjects } from '@/hooks/use-projects';
import { useUser } from '@/hooks/use-user';
import { canAccessFinance } from '@/lib/roles';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316',
];

export default function FinancePage() {
  const { user } = useUser();
  const { records, isLoading, mutate: mutateRecords } = useFinanceRecords();
  const { uploads, mutate: mutateUploads } = useFinanceUploads();
  const { projects, createProject } = useProjects();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  if (!user || !canAccessFinance(user.role)) {
    return (
      <Shell title="Finance" subtitle="Access denied">
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-muted">You don&apos;t have access to finance data.</p>
        </div>
      </Shell>
    );
  }

  // Filter records/uploads for the selected project
  const projectRecords = selectedProjectId
    ? records.filter((r) => r.project_id === selectedProjectId)
    : records;

  const projectUploads = selectedProjectId
    ? uploads.filter((u) => u.project_id === selectedProjectId)
    : uploads;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Summary computed from current view (filtered or all)
  const summary = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalBurn = projectRecords
      .filter((r) => r.month === currentMonth)
      .reduce((sum, r) => sum + r.amount, 0);

    const totalAllTime = projectRecords.reduce((sum, r) => sum + r.amount, 0);

    // Monthly trend
    const monthMap = new Map<string, number>();
    for (const r of projectRecords) {
      monthMap.set(r.month, (monthMap.get(r.month) ?? 0) + r.amount);
    }
    const monthlyTrend = Array.from(monthMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // By category
    const catMap = new Map<string, number>();
    for (const r of projectRecords) {
      catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Per project breakdown (for all-projects view)
    const projectMap = new Map<string, number>();
    for (const r of projectRecords) {
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

    // Stale data alerts
    const staleProjects = byProject.filter((p) => {
      if (!p.lastUpload) return true;
      return differenceInDays(now, new Date(p.lastUpload.created_at)) > 30;
    });

    return { totalBurn, totalAllTime, monthlyTrend, byCategory, byProject, staleProjects };
  }, [projectRecords, projects, uploads]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !user) return;
    setCreatingProject(true);
    try {
      const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
      await createProject({
        name: newProjectName.trim(),
        status: 'active',
        color,
        company_id: user.company_id,
      });
      toast.success(`Project "${newProjectName.trim()}" created`);
      setNewProjectName('');
      setShowNewProject(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, user, projects.length, createProject]);

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
      label: selectedProjectId ? 'Records' : 'Projects with Data',
      value: selectedProjectId ? projectRecords.length : summary.byProject.length,
      color: 'text-blue',
      isCount: true,
    },
    ...(selectedProjectId
      ? []
      : [
          {
            label: 'Stale Data',
            value: summary.staleProjects.length,
            color: summary.staleProjects.length > 0 ? 'text-yellow' : 'text-green',
            isCount: true,
          },
        ]),
  ];

  return (
    <Shell title="Finance" subtitle="Financial overview & data uploads">
      {/* Toolbar: project selector + actions */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Project selector */}
        <div className="relative">
          <select
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="appearance-none rounded-xl border border-border bg-card py-2 pl-4 pr-10 text-sm font-semibold text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>

        {/* Create project button */}
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
        >
          <PlusIcon className="h-4 w-4" />
          New Project
        </button>

        {/* Upload button (only when a project is selected) */}
        {selectedProjectId && (
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
      ) : projectRecords.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border">
          <p className="text-sm font-medium text-muted">
            {selectedProjectId
              ? `No finance data for "${selectedProject?.name}"`
              : 'No finance data uploaded yet'}
          </p>
          <p className="text-[13px] text-muted">
            {selectedProjectId
              ? 'Upload an Excel or CSV file to get started'
              : 'Select a project and upload Excel/CSV finance data'}
          </p>
          {selectedProjectId && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Upload Excel/CSV
            </button>
          )}
          {!selectedProjectId && projects.length === 0 && (
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-light"
            >
              <PlusIcon className="h-4 w-4" />
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className={clsx('grid gap-4', selectedProjectId ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4')}>
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

          {/* Stale data alert (all projects view only) */}
          {!selectedProjectId && summary.staleProjects.length > 0 && (
            <div className="rounded-xl border border-yellow/20 bg-yellow-bg p-4">
              <p className="mb-2 text-sm font-semibold text-yellow">Data Freshness Alert</p>
              <p className="text-[13px] text-muted">
                {summary.staleProjects.length} project{summary.staleProjects.length !== 1 ? 's have' : ' has'} finance data older than 30 days:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.staleProjects.map((p) => (
                  <button
                    key={p.project!.id}
                    onClick={() => setSelectedProjectId(p.project!.id)}
                    className="rounded-md bg-card px-2 py-0.5 text-xs font-semibold text-text hover:bg-bg"
                  >
                    {p.project!.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly trend chart */}
          {summary.monthlyTrend.length > 1 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">
                Monthly Trend{selectedProjectId ? '' : ' (All Projects)'}
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

          {/* Category breakdown (when a project is selected) */}
          {selectedProjectId && summary.byCategory.length > 0 && (
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

          {/* Per-project breakdown (all projects view) */}
          {!selectedProjectId && summary.byProject.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">By Project</h3>
              <div className="rounded-xl border border-border bg-card">
                {summary.byProject.map((p, idx) => (
                  <button
                    key={p.project!.id}
                    onClick={() => setSelectedProjectId(p.project!.id)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg',
                      idx !== summary.byProject.length - 1 && 'border-b border-border'
                    )}
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.project!.color }}
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-text">
                      {p.project!.name}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-text">
                      {p.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload history (when a project is selected) */}
          {selectedProjectId && projectUploads.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-text">Upload History</h3>
              <div className="rounded-xl border border-border bg-card">
                {projectUploads.map((u, idx) => (
                  <div
                    key={u.id}
                    className={clsx(
                      'flex items-center justify-between px-4 py-2.5',
                      idx !== projectUploads.length - 1 && 'border-b border-border'
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
      {selectedProjectId && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          projectId={selectedProjectId}
          onUploaded={() => { mutateRecords(); mutateUploads(); }}
        />
      )}

      {/* New project dialog */}
      <Dialog open={showNewProject} onClose={() => setShowNewProject(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-text">
                New Finance Project
              </DialogTitle>
              <button
                onClick={() => setShowNewProject(false)}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Create a project to upload finance data for.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreateProject(); }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Q1 2026 Budget"
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition-all hover:bg-bg hover:text-text active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-light active:scale-95 disabled:opacity-50"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </Shell>
  );
}
