'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  PlusIcon, XMarkIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon,
  ChevronUpDownIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { format, addMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, isFirstDayOfMonth, isLastDayOfMonth } from 'date-fns';
import { Shell } from '@/components/layout/shell';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { useTeam } from '@/hooks/use-team';
import { useUser } from '@/hooks/use-user';
import { useFinanceClients, useClientInvoices, useExpenses } from '@/hooks/use-finance-data';
import { canManage, canManageFinance } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { formatOMR } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AvatarStack } from '@/components/ui/assignee-picker';
import {
  computeProjectMetrics, sortProjects, filterProjects, getStatusBadgeVariant, getProgressRawColor,
  projectOverlapsMonth, formatProjectPeriod,
  type SortKey, type FilterKey, type ProjectMetrics,
} from '@/lib/project-utils';
import type { Project, ProjectStatus } from '@/types/database';

const PROJECT_COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'overdue', label: 'Most Overdue' },
  { value: 'progress', label: 'Progress' },
  { value: 'name', label: 'Name' },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'at-risk', label: 'At Risk' },
  { key: 'completed', label: 'Completed' },
  { key: 'paused', label: 'Paused' },
];

type ScheduleMode = 'none' | 'months' | 'custom';

const SCHEDULE_MODES: { value: ScheduleMode; label: string }[] = [
  { value: 'none', label: 'No schedule' },
  { value: 'months', label: 'Month(s)' },
  { value: 'custom', label: 'Custom dates' },
];

interface ProjectForm {
  name: string;
  status: ProjectStatus;
  color: string;
  client_id: string;
  scheduleMode: ScheduleMode;
  fromMonth: string; // yyyy-MM
  toMonth: string; // yyyy-MM — empty = single month
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd — empty = ongoing
}
const emptyForm: ProjectForm = {
  name: '', status: 'active', color: PROJECT_COLORS[0], client_id: '',
  scheduleMode: 'none', fromMonth: '', toMonth: '', startDate: '', endDate: '',
};

function deriveScheduleForm(p: Project): Pick<ProjectForm, 'scheduleMode' | 'fromMonth' | 'toMonth' | 'startDate' | 'endDate'> {
  if (!p.start_date) return { scheduleMode: 'none', fromMonth: '', toMonth: '', startDate: '', endDate: '' };
  const start = parseISO(p.start_date);
  const end = p.end_date ? parseISO(p.end_date) : null;
  if (isFirstDayOfMonth(start) && end && isLastDayOfMonth(end)) {
    return {
      scheduleMode: 'months',
      fromMonth: format(start, 'yyyy-MM'),
      toMonth: isSameMonth(start, end) ? '' : format(end, 'yyyy-MM'),
      startDate: '', endDate: '',
    };
  }
  return { scheduleMode: 'custom', fromMonth: '', toMonth: '', startDate: p.start_date, endDate: p.end_date ?? '' };
}

function scheduleFields(form: ProjectForm): { start_date: string | null; end_date: string | null } {
  if (form.scheduleMode === 'months' && form.fromMonth) {
    const endMonth = form.toMonth && form.toMonth >= form.fromMonth ? form.toMonth : form.fromMonth;
    return {
      start_date: `${form.fromMonth}-01`,
      end_date: format(endOfMonth(parseISO(`${endMonth}-01`)), 'yyyy-MM-dd'),
    };
  }
  if (form.scheduleMode === 'custom' && form.startDate) {
    return {
      start_date: form.startDate,
      end_date: form.endDate && form.endDate >= form.startDate ? form.endDate : null,
    };
  }
  return { start_date: null, end_date: null };
}

const MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i);

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, isLoading: projLoading, createProject, updateProject, deleteProject } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { team } = useTeam();
  const { user } = useUser();
  const showFinance = user ? canManageFinance(user.role) : false;
  const canEdit = user ? canManage(user.role) : false;

  const { clients } = useFinanceClients();
  const { invoices } = useClientInvoices();
  const { expenses } = useExpenses();

  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortOpen, setSortOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const isLoading = projLoading || tasksLoading;

  // Per-client financials (owner/manager only)
  const clientFinance = useMemo(() => {
    const map = new Map<string, { revenue: number; profit: number }>();
    if (!showFinance) return map;
    const rev = new Map<string, number>();
    invoices.forEach((i) => rev.set(i.client_id, (rev.get(i.client_id) ?? 0) + i.amount));
    const exp = new Map<string, number>();
    expenses.filter((e) => e.type === 'operational' && e.client_id).forEach((e) => exp.set(e.client_id!, (exp.get(e.client_id!) ?? 0) + e.amount));
    new Set([...rev.keys(), ...exp.keys()]).forEach((id) =>
      map.set(id, { revenue: rev.get(id) ?? 0, profit: (rev.get(id) ?? 0) - (exp.get(id) ?? 0) })
    );
    return map;
  }, [invoices, expenses, showFinance]);

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const metrics = useMemo(() => projects.map((p) => computeProjectMetrics(p, tasks, team)), [projects, tasks, team]);

  // Month scoping
  const stripYear = month.getFullYear();
  const monthCounts = useMemo(
    () => MONTH_INDEXES.map((i) => metrics.filter((m) => projectOverlapsMonth(m.project, new Date(stripYear, i, 1))).length),
    [metrics, stripYear]
  );
  const inMonth = useMemo(() => metrics.filter((m) => projectOverlapsMonth(m.project, month)), [metrics, month]);
  const unscheduledAll = useMemo(() => metrics.filter((m) => !m.project.start_date), [metrics]);

  const applyView = useCallback(
    (list: ProjectMetrics[]) => {
      let l = filterProjects(list, filter);
      if (search.trim()) {
        const q = search.toLowerCase();
        l = l.filter((m) => m.project.name.toLowerCase().includes(q));
      }
      return sortProjects(l, sortBy);
    },
    [filter, search, sortBy]
  );

  const displayed = useMemo(() => applyView(scope === 'month' ? inMonth : metrics), [applyView, scope, inMonth, metrics]);
  const displayedUnscheduled = useMemo(() => (scope === 'month' ? applyView(unscheduledAll) : []), [applyView, scope, unscheduledAll]);

  const summary = useMemo(() => {
    const base = scope === 'month' ? inMonth : metrics;
    const active = base.filter((m) => m.project.status === 'active').length;
    const openTasks = base.reduce((s, m) => s + (m.totalTasks - m.doneTasks), 0);
    const overdue = base.reduce((s, m) => s + m.overdueTasks, 0);
    return { total: base.length, active, openTasks, overdue };
  }, [scope, inMonth, metrics]);

  function openNew() {
    setEditingId(null);
    setForm(scope === 'month'
      ? { ...emptyForm, scheduleMode: 'months', fromMonth: format(month, 'yyyy-MM') }
      : emptyForm);
    setDialogOpen(true);
  }

  const openEdit = useCallback((m: ProjectMetrics, focusSchedule = false) => {
    setEditingId(m.project.id);
    const schedule = deriveScheduleForm(m.project);
    if (focusSchedule && schedule.scheduleMode === 'none') {
      schedule.scheduleMode = 'months';
      schedule.fromMonth = format(month, 'yyyy-MM');
    }
    setForm({
      name: m.project.name, status: m.project.status, color: m.project.color,
      client_id: m.project.client_id ?? '', ...schedule,
    });
    setDialogOpen(true);
  }, [month]);

  function setScheduleMode(mode: ScheduleMode) {
    setForm((f) => ({
      ...f,
      scheduleMode: mode,
      fromMonth: mode === 'months' && !f.fromMonth ? format(month, 'yyyy-MM') : f.fromMonth,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    setSaving(true);
    try {
      const schedule = scheduleFields(form);
      if (editingId) {
        await updateProject(editingId, { name: form.name.trim(), status: form.status, color: form.color, client_id: form.client_id || null, ...schedule });
      } else {
        await createProject({ name: form.name.trim(), status: form.status, color: form.color, company_id: user.company_id, client_id: form.client_id || null, ...schedule });
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const kpis = [
    { label: scope === 'month' ? `In ${format(month, 'MMMM')}` : 'Total Projects', value: summary.total },
    { label: 'Active', value: summary.active },
    { label: 'Open Tasks', value: summary.openTasks },
    { label: 'Overdue', value: summary.overdue, tone: summary.overdue > 0 ? 'text-red' : 'text-text' },
  ];

  const rowProps = {
    router, canEdit, showFinance, clientFinance, clientName, openEdit,
    onDelete: (m: ProjectMetrics) => setDeleteTarget({ id: m.project.id, name: m.project.name }),
  };

  return (
    <Shell title="Projects" subtitle={scope === 'month' ? `${format(month, 'MMMM yyyy')} · ${summary.total} projects` : `${summary.active} active · ${summary.overdue} overdue`}>
      {isLoading ? (
        <ProjectsSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Month navigator */}
          <div className="overflow-hidden rounded-card border border-border bg-card">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              {scope === 'month' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setMonth((m) => startOfMonth(addMonths(m, -1)))} aria-label="Previous month"
                      className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:border-border-hover hover:text-text">
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <h2 className="text-display w-44 text-center text-2xl text-text sm:w-48">{format(month, 'MMMM yyyy')}</h2>
                    <button onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))} aria-label="Next month"
                      className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:border-border-hover hover:text-text">
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {!isSameMonth(month, new Date()) && (
                    <button onClick={() => setMonth(startOfMonth(new Date()))} className="text-xs font-semibold text-accent hover:text-accent-light">
                      Back to today
                    </button>
                  )}
                  <div className="ml-auto flex items-baseline gap-2">
                    <span className="stat-numeral text-3xl text-text">{inMonth.length}</span>
                    <span className="eyebrow">project{inMonth.length === 1 ? '' : 's'} this month</span>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-display text-2xl text-text">All Projects</h2>
                  <div className="ml-auto flex items-baseline gap-2">
                    <span className="stat-numeral text-3xl text-text">{metrics.length}</span>
                    <span className="eyebrow">total</span>
                  </div>
                </>
              )}
              <div className="flex rounded-lg border border-border p-0.5">
                {(['month', 'all'] as const).map((s) => (
                  <button key={s} onClick={() => setScope(s)}
                    className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-colors', scope === s ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-text')}>
                    {s === 'month' ? 'Month' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Year strip — pick a month, see how many projects it holds */}
            {scope === 'month' && (
              <div className="flex items-center gap-1.5 border-t border-border px-3 py-2.5">
                <button onClick={() => setMonth(new Date(stripYear - 1, month.getMonth(), 1))} aria-label="Previous year"
                  className="rounded-md p-1 text-muted transition-colors hover:bg-bg hover:text-text">
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center text-xs font-semibold tabular-nums text-text">{stripYear}</span>
                <button onClick={() => setMonth(new Date(stripYear + 1, month.getMonth(), 1))} aria-label="Next year"
                  className="rounded-md p-1 text-muted transition-colors hover:bg-bg hover:text-text">
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
                <div className="mx-1 h-6 w-px shrink-0 bg-border" />
                <div className="flex flex-1 gap-1 overflow-x-auto">
                  {MONTH_INDEXES.map((i) => {
                    const chipMonth = new Date(stripYear, i, 1);
                    const selected = isSameMonth(chipMonth, month);
                    const isCurrent = isSameMonth(chipMonth, new Date());
                    const count = monthCounts[i];
                    return (
                      <button key={i} onClick={() => setMonth(chipMonth)}
                        className={cn(
                          'flex min-w-[46px] flex-1 flex-col items-center rounded-lg px-1.5 py-1 transition-colors',
                          selected ? 'bg-primary text-primary-foreground' : 'hover:bg-bg',
                          !selected && isCurrent && 'ring-1 ring-inset ring-accent'
                        )}>
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', !selected && (count > 0 ? 'text-muted' : 'text-faint'))}>
                          {format(chipMonth, 'MMM')}
                        </span>
                        <span className={cn('text-[13px] font-semibold tabular-nums', !selected && (count > 0 ? 'text-text' : 'text-faint'))}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-card px-5 py-4">
                <p className="eyebrow truncate">{k.label}</p>
                <p className={cn('stat-numeral mt-1.5 text-3xl', k.tone ?? 'text-text')}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…"
                className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none" />
            </div>
            <div className="relative">
              <button onClick={() => setSortOpen((v) => !v)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-text hover:border-border-hover">
                <ChevronUpDownIcon className="h-4 w-4" /> Sort
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl">
                    {SORT_OPTIONS.map((o) => (
                      <button key={o.value} onClick={() => { setSortBy(o.value); setSortOpen(false); }}
                        className={cn('block w-full px-3 py-2 text-left text-[13px] font-medium', sortBy === o.value ? 'bg-accent-muted text-accent' : 'text-text hover:bg-bg')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {canEdit && (
              <button onClick={openNew} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-95">
                <PlusIcon className="h-4 w-4" /> Add Project
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors', filter === f.key ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Scheduled projects for the selected month / all projects */}
          <div className="space-y-2">
            {scope === 'month' && (
              <p className="eyebrow">{format(month, 'MMMM yyyy')} · {displayed.length} project{displayed.length === 1 ? '' : 's'}</p>
            )}
            {displayed.length === 0 ? (
              search.trim() || filter !== 'all' ? (
                <EmptyState title="No projects found" description="Nothing matches your search or filters." />
              ) : scope === 'month' ? (
                <EmptyState
                  icon={CalendarDaysIcon}
                  title={`No projects in ${format(month, 'MMMM yyyy')}`}
                  description={canEdit ? 'Add a project to this month, or schedule one of your unscheduled projects below.' : 'Nothing is scheduled for this month.'}
                  actionLabel={canEdit ? 'Add Project' : undefined}
                  onAction={canEdit ? openNew : undefined}
                />
              ) : (
                <EmptyState title="No projects yet" description="Create your first project to start tracking work." actionLabel={canEdit ? 'Add Project' : undefined} onAction={canEdit ? openNew : undefined} />
              )
            ) : (
              <div className="overflow-hidden rounded-card border border-border bg-card">
                <ListHeader showFinance={showFinance} />
                {displayed.map((m, i) => (
                  <ProjectRow key={m.project.id} m={m} isLast={i === displayed.length - 1} {...rowProps} />
                ))}
              </div>
            )}
          </div>

          {/* Unscheduled projects — assign them a month so they show up above */}
          {scope === 'month' && displayedUnscheduled.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow">Unscheduled · {displayedUnscheduled.length}</p>
                <p className="text-xs text-faint">Assign a month so these appear in your monthly view</p>
              </div>
              <div className="overflow-hidden rounded-card border border-border bg-card">
                <ListHeader showFinance={showFinance} />
                {displayedUnscheduled.map((m, i) => (
                  <ProjectRow key={m.project.id} m={m} isLast={i === displayedUnscheduled.length - 1} showScheduleCta {...rowProps} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">{editingId ? 'Edit Project' : 'New Project'}</DialogTitle>
              <button onClick={() => setDialogOpen(false)} className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Project Name</label>
                <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sweetsalt" className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                {showFinance && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Client (optional)</label>
                    <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none">
                      <option value="">— None —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Schedule — assign to a month or a period of time */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Schedule</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULE_MODES.map((mode) => (
                    <button key={mode.value} type="button" onClick={() => setScheduleMode(mode.value)}
                      className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors', form.scheduleMode === mode.value ? 'border-accent bg-accent-muted text-accent' : 'border-border text-muted hover:text-text')}>
                      {mode.label}
                    </button>
                  ))}
                </div>
                {form.scheduleMode === 'months' && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted">From month</label>
                        <input type="month" required value={form.fromMonth} onChange={(e) => setForm({ ...form, fromMonth: e.target.value })}
                          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted">To month (optional)</label>
                        <input type="month" value={form.toMonth} min={form.fromMonth || undefined} onChange={(e) => setForm({ ...form, toMonth: e.target.value })}
                          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-faint">Leave “To month” empty to assign the project to a single month.</p>
                  </div>
                )}
                {form.scheduleMode === 'custom' && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted">Start date</label>
                        <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted">End date (optional)</label>
                        <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-faint">Leave “End date” empty for an ongoing project.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={cn('h-7 w-7 rounded-lg transition-all active:scale-90', form.color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : 'hover:scale-105')} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-card border border-border bg-card p-6 shadow-xl">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">Delete Project</DialogTitle>
            <p className="mt-2 text-sm text-muted">Delete <strong className="text-text">{deleteTarget?.name}</strong> and all its tasks, comments and activity? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text">Cancel</button>
              <button onClick={() => { if (deleteTarget) { deleteProject(deleteTarget.id); setDeleteTarget(null); } }} className="rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white hover:bg-red/90">Delete</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </Shell>
  );
}

function ListHeader({ showFinance }: { showFinance: boolean }) {
  return (
    <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted lg:flex">
      <span className="flex-1">Project</span>
      <span className="w-40">Progress</span>
      <span className="w-16 text-center">Open</span>
      <span className="w-16 text-center">Overdue</span>
      <span className="w-24">Team</span>
      {showFinance && <span className="w-28 text-right">Revenue</span>}
      {showFinance && <span className="w-28 text-right">Profit</span>}
      <span className="w-16" />
    </div>
  );
}

interface ProjectRowProps {
  m: ProjectMetrics;
  isLast: boolean;
  showScheduleCta?: boolean;
  router: ReturnType<typeof useRouter>;
  canEdit: boolean;
  showFinance: boolean;
  clientFinance: Map<string, { revenue: number; profit: number }>;
  clientName: Map<string, string>;
  openEdit: (m: ProjectMetrics, focusSchedule?: boolean) => void;
  onDelete: (m: ProjectMetrics) => void;
}

function ProjectRow({ m, isLast, showScheduleCta, router, canEdit, showFinance, clientFinance, clientName, openEdit, onDelete }: ProjectRowProps) {
  const fin = m.project.client_id ? clientFinance.get(m.project.client_id) : undefined;
  const linkedName = m.project.client_id ? clientName.get(m.project.client_id) : undefined;
  const period = formatProjectPeriod(m.project);

  return (
    <div onClick={() => router.push(`/projects/${m.project.id}`)}
      className={cn('group flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-bg lg:flex-nowrap', !isLast && 'border-b border-border')}>
      {/* Name + status + schedule */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.project.color }} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">{m.project.name}</span>
            {m.health === 'red' && <Badge variant="danger">At Risk</Badge>}
          </div>
          <p className="truncate text-xs text-muted">
            <Badge variant={getStatusBadgeVariant(m.project.status)}>{m.project.status}</Badge>
            {linkedName && <span className="ml-1.5">· {linkedName}</span>}
            <span className="ml-1.5 whitespace-nowrap">
              · <CalendarDaysIcon className="mb-0.5 inline h-3.5 w-3.5" />{' '}
              {period ? <span className="font-medium text-accent">{period}</span> : <span className="text-faint">Unscheduled</span>}
            </span>
          </p>
        </div>
      </div>
      {/* Progress */}
      <div className="flex w-full items-center gap-2 lg:w-40">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
          <div className="h-full rounded-full" style={{ width: `${m.progressPercent}%`, backgroundColor: getProgressRawColor(m.progressPercent, m.overdueTasks) }} />
        </div>
        <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted">{m.progressPercent}%</span>
      </div>
      {/* Open */}
      <span className="w-16 text-center text-[13px] tabular-nums text-text">{m.totalTasks - m.doneTasks}</span>
      {/* Overdue */}
      <span className={cn('w-16 text-center text-[13px] font-semibold tabular-nums', m.overdueTasks > 0 ? 'text-red' : 'text-faint')}>{m.overdueTasks}</span>
      {/* Team */}
      <div className="w-24">{m.assignees.length > 0 ? <AvatarStack users={m.assignees} max={3} size="xs" /> : <span className="text-xs text-faint">—</span>}</div>
      {/* Finance */}
      {showFinance && <span className="w-28 text-right text-[13px] tabular-nums text-text">{fin ? formatOMR(fin.revenue) : <span className="text-faint">—</span>}</span>}
      {showFinance && <span className={cn('w-28 text-right text-[13px] font-semibold tabular-nums', fin ? (fin.profit >= 0 ? 'text-text' : 'text-red') : '')}>{fin ? formatOMR(fin.profit) : <span className="text-faint">—</span>}</span>}
      {/* Actions */}
      <div className={cn('flex items-center justify-end gap-1', showScheduleCta && canEdit ? 'w-auto lg:w-40' : 'w-16')}>
        {showScheduleCta && canEdit && (
          <button onClick={(e) => { e.stopPropagation(); openEdit(m, true); }}
            className="flex h-7 items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent">
            <CalendarDaysIcon className="h-3.5 w-3.5" /> Schedule
          </button>
        )}
        {canEdit && (
          <>
            <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="rounded-lg p-1.5 text-muted opacity-0 transition-opacity hover:bg-card hover:text-text group-hover:opacity-100" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(m); }} className="rounded-lg p-1.5 text-muted opacity-0 transition-opacity hover:bg-red-bg hover:text-red group-hover:opacity-100" title="Delete"><TrashIcon className="h-4 w-4" /></button>
          </>
        )}
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-faint" />
      </div>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex gap-1 border-t border-border px-3 py-2.5">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9 flex-1 rounded-lg" />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card px-5 py-4"><Skeleton className="mb-2 h-3 w-20" /><Skeleton className="h-7 w-12" /></div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="overflow-hidden rounded-card border border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
            <Skeleton className="h-4 flex-1" /><Skeleton className="h-1.5 w-40 rounded-full" /><Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
