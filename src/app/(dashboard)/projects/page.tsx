'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  PlusIcon, XMarkIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon,
  ChevronUpDownIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon, CalendarDaysIcon,
  Squares2X2Icon, ListBulletIcon, PaintBrushIcon,
} from '@heroicons/react/24/outline';
import { format, addMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, isFirstDayOfMonth, isLastDayOfMonth } from 'date-fns';
import { Shell } from '@/components/layout/shell';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { useTeam } from '@/hooks/use-team';
import { useUser } from '@/hooks/use-user';
import { useFinanceClients } from '@/hooks/use-finance-data';
import { canManage, canManageFinance, canDeleteProjects } from '@/lib/roles';
import { cn } from '@/lib/utils';
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
  const canDelete = user ? canDeleteProjects(user.role) : false;

  const { clients } = useFinanceClients();

  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<'gallery' | 'list'>('gallery');

  useEffect(() => {
    if (localStorage.getItem('projects-view') === 'list') setView('list');
  }, []);
  function changeView(v: 'gallery' | 'list') {
    setView(v);
    localStorage.setItem('projects-view', v);
  }
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
    router, canEdit, canDelete, clientName, openEdit,
    onDelete: (m: ProjectMetrics) => setDeleteTarget({ id: m.project.id, name: m.project.name }),
  };

  return (
    <Shell title="Projects" subtitle={scope === 'month' ? `${format(month, 'MMMM yyyy')} · ${summary.total} projects` : `${summary.active} active · ${summary.overdue} overdue`}>
      {isLoading ? (
        <ProjectsSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Editorial masthead — the month as a magazine issue */}
          <div className="grain overflow-hidden rounded-card border border-border bg-card">
            <span className="pointer-events-none absolute -right-4 -top-12 select-none font-display text-[9rem] font-semibold leading-none text-accent/[0.07]">
              {scope === 'month' ? format(month, 'MM') : '∞'}
            </span>
            <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pb-4 pt-5 sm:px-6">
              {scope === 'month' ? (
                <div className="min-w-0">
                  <p className="eyebrow">Issue {format(month, 'MM')} · {format(month, 'yyyy')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-display text-4xl text-text sm:text-5xl">{format(month, 'MMMM')}</h2>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setMonth((m) => startOfMonth(addMonths(m, -1)))} aria-label="Previous month"
                        className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:border-border-hover hover:text-text">
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => setMonth((m) => startOfMonth(addMonths(m, 1)))} aria-label="Next month"
                        className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:border-border-hover hover:text-text">
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                      {!isSameMonth(month, new Date()) && (
                        <button onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs font-semibold text-accent hover:text-accent-light">
                          Back to today
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="eyebrow">The full collection</p>
                  <h2 className="text-display mt-1 text-4xl text-text sm:text-5xl">All Projects</h2>
                </div>
              )}
              <div className="flex items-end gap-5">
                <div className="text-right">
                  <p className="stat-numeral text-4xl text-text sm:text-5xl">{scope === 'month' ? inMonth.length : metrics.length}</p>
                  <p className="eyebrow mt-1">{scope === 'month' ? 'on the wall' : 'in total'}</p>
                </div>
                <div className="mb-1 flex rounded-lg border border-border p-0.5">
                  {(['month', 'all'] as const).map((s) => (
                    <button key={s} onClick={() => setScope(s)}
                      className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-colors', scope === s ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-text')}>
                      {s === 'month' ? 'Month' : 'All'}
                    </button>
                  ))}
                </div>
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
            <div className="flex h-9 items-center rounded-lg border border-border bg-card p-0.5">
              <button onClick={() => changeView('gallery')} title="Gallery view" aria-label="Gallery view"
                className={cn('flex h-full items-center rounded-md px-2.5 transition-colors', view === 'gallery' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-text')}>
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button onClick={() => changeView('list')} title="List view" aria-label="List view"
                className={cn('flex h-full items-center rounded-md px-2.5 transition-colors', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-text')}>
                <ListBulletIcon className="h-4 w-4" />
              </button>
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
                  icon={PaintBrushIcon}
                  title="A blank canvas"
                  description={canEdit ? `Nothing on the wall for ${format(month, 'MMMM yyyy')} yet. Add a project, or hang one of the unscheduled pieces below.` : `Nothing is scheduled for ${format(month, 'MMMM yyyy')}.`}
                  actionLabel={canEdit ? 'Add Project' : undefined}
                  onAction={canEdit ? openNew : undefined}
                />
              ) : (
                <EmptyState icon={PaintBrushIcon} title="The studio is empty" description="Create your first project to start tracking work." actionLabel={canEdit ? 'Add Project' : undefined} onAction={canEdit ? openNew : undefined} />
              )
            ) : view === 'gallery' ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayed.map((m, i) => (
                  <ProjectCard key={m.project.id} m={m} index={i} {...rowProps} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-border bg-card">
                <ListHeader />
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
                <p className="text-xs text-faint">Waiting to be hung — assign a month to put these on the wall</p>
              </div>
              {view === 'gallery' ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {displayedUnscheduled.map((m, i) => (
                    <ProjectCard key={m.project.id} m={m} index={i} showScheduleCta {...rowProps} />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-card border border-border bg-card">
                  <ListHeader />
                  {displayedUnscheduled.map((m, i) => (
                    <ProjectRow key={m.project.id} m={m} isLast={i === displayedUnscheduled.length - 1} showScheduleCta {...rowProps} />
                  ))}
                </div>
              )}
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

function ListHeader() {
  return (
    <div className="hidden items-center gap-4 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted lg:flex">
      <span className="flex-1">Project</span>
      <span className="w-40">Progress</span>
      <span className="w-16 text-center">Open</span>
      <span className="w-16 text-center">Overdue</span>
      <span className="w-24">Team</span>
      <span className="w-16" />
    </div>
  );
}

interface ProjectCardProps {
  m: ProjectMetrics;
  index: number;
  showScheduleCta?: boolean;
  router: ReturnType<typeof useRouter>;
  canEdit: boolean;
  canDelete: boolean;
  clientName: Map<string, string>;
  openEdit: (m: ProjectMetrics, focusSchedule?: boolean) => void;
  onDelete: (m: ProjectMetrics) => void;
}

/* Moodboard poster card — the project's color becomes its cover */
function ProjectCard({ m, index, showScheduleCta, router, canEdit, canDelete, clientName, openEdit, onDelete }: ProjectCardProps) {
  const linkedName = m.project.client_id ? clientName.get(m.project.client_id) : undefined;
  const period = formatProjectPeriod(m.project);
  const openTasks = m.totalTasks - m.doneTasks;
  const color = m.project.color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        onClick={() => router.push(`/projects/${m.project.id}`)}
        className={cn(
          'group cursor-pointer overflow-hidden rounded-card border border-border bg-card transition-all duration-300',
          'hover:-translate-y-1 hover:border-border-hover hover:shadow-xl',
          index % 2 === 0 ? 'hover:rotate-[-0.5deg]' : 'hover:rotate-[0.5deg]'
        )}
      >
        {/* Cover — a color field with grain, like a print pinned to the wall */}
        <div
          className="grain relative h-28"
          style={{ background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #000) 100%)` }}
        >
          <span className="absolute left-1/2 top-2 h-4 w-14 -translate-x-1/2 rotate-[-3deg] rounded-[2px] bg-white/30" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
            <span className="rounded-md bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90 backdrop-blur-sm">
              {m.project.status}
            </span>
            {m.health === 'red' && (
              <span className="rounded-md bg-red/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                At Risk
              </span>
            )}
          </div>
          <h3 className="absolute bottom-3 left-4 right-4 truncate font-display text-xl font-semibold tracking-tight text-white">
            {m.project.name}
          </h3>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
              {period ? <span className="truncate font-semibold text-accent">{period}</span> : <span className="text-faint">Unscheduled</span>}
            </span>
            {linkedName && <span className="truncate text-faint">{linkedName}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <div className="h-full rounded-full transition-all" style={{ width: `${m.progressPercent}%`, backgroundColor: getProgressRawColor(m.progressPercent, m.overdueTasks) }} />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted">{m.progressPercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span><strong className="font-semibold text-text">{openTasks}</strong> open</span>
              {m.overdueTasks > 0 && <span className="font-semibold text-red">{m.overdueTasks} overdue</span>}
            </div>
            {m.assignees.length > 0 ? <AvatarStack users={m.assignees} max={3} size="xs" /> : <span className="text-xs text-faint">—</span>}
          </div>
          {(canEdit || canDelete) && (
            <div className="flex items-center justify-between border-t border-border pt-3">
              {showScheduleCta && canEdit ? (
                <button onClick={(e) => { e.stopPropagation(); openEdit(m, true); }}
                  className="flex h-7 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent">
                  <CalendarDaysIcon className="h-3.5 w-3.5" /> Schedule
                </button>
              ) : <span className="text-[11px] text-faint">{m.lastActivityRelative}</span>}
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
                )}
                {canDelete && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(m); }} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-bg hover:text-red" title="Delete"><TrashIcon className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface ProjectRowProps {
  m: ProjectMetrics;
  isLast: boolean;
  showScheduleCta?: boolean;
  router: ReturnType<typeof useRouter>;
  canEdit: boolean;
  canDelete: boolean;
  clientName: Map<string, string>;
  openEdit: (m: ProjectMetrics, focusSchedule?: boolean) => void;
  onDelete: (m: ProjectMetrics) => void;
}

function ProjectRow({ m, isLast, showScheduleCta, router, canEdit, canDelete, clientName, openEdit, onDelete }: ProjectRowProps) {
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
      {/* Actions */}
      <div className={cn('flex items-center justify-end gap-1', showScheduleCta && canEdit ? 'w-auto lg:w-40' : 'w-16')}>
        {showScheduleCta && canEdit && (
          <button onClick={(e) => { e.stopPropagation(); openEdit(m, true); }}
            className="flex h-7 items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent">
            <CalendarDaysIcon className="h-3.5 w-3.5" /> Schedule
          </button>
        )}
        {canEdit && (
          <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="rounded-lg p-1.5 text-muted transition-opacity hover:bg-card hover:text-text lg:opacity-0 lg:group-hover:opacity-100" title="Edit"><PencilSquareIcon className="h-4 w-4" /></button>
        )}
        {canDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(m); }} className="rounded-lg p-1.5 text-muted transition-opacity hover:bg-red-bg hover:text-red lg:opacity-0 lg:group-hover:opacity-100" title="Delete"><TrashIcon className="h-4 w-4" /></button>
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
