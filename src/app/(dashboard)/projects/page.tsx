'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shell } from '@/components/layout/shell';
import { useProjects } from '@/hooks/use-projects';
import { useTasks } from '@/hooks/use-tasks';
import { useTeam } from '@/hooks/use-team';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectKPICard, ProjectListRow } from '@/components/projects/project-kpi-card';
import {
  computeProjectMetrics,
  sortProjects,
  filterProjects,
  type SortKey,
  type FilterKey,
} from '@/lib/project-utils';
import {
  Squares2X2Icon,
  ListBulletIcon,
  FunnelIcon,
  ChevronUpDownIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PauseCircleIcon,
} from '@heroicons/react/24/outline';

/* ── Sort options ── */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'overdue', label: 'Most Overdue' },
  { value: 'progress', label: 'Progress' },
  { value: 'name', label: 'Name' },
  { value: 'updated', label: 'Recently Updated' },
];

/* ── Filter pills ── */
interface FilterPill {
  key: FilterKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count: number;
}

/* ── Page ── */
export default function ProjectsPage() {
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasks();
  const { team } = useTeam();

  const isLoading = projectsLoading || tasksLoading;

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortKey>('priority');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

  // Compute metrics for all projects
  const allMetrics = useMemo(
    () => projects.map((p) => computeProjectMetrics(p, tasks, team)),
    [projects, tasks, team]
  );

  // Summary counts for filter pills
  const counts = useMemo(() => {
    const active = allMetrics.filter((m) => m.project.status === 'active').length;
    const atRisk = allMetrics.filter((m) => m.health === 'red').length;
    const completed = allMetrics.filter((m) => m.project.status === 'completed').length;
    const paused = allMetrics.filter((m) => m.project.status === 'paused').length;
    return { all: allMetrics.length, active, atRisk, completed, paused };
  }, [allMetrics]);

  const filterPills: FilterPill[] = [
    { key: 'all', label: 'All', icon: ChartBarIcon, count: counts.all },
    { key: 'active', label: 'Active', icon: CheckCircleIcon, count: counts.active },
    { key: 'at-risk', label: 'At Risk', icon: ExclamationTriangleIcon, count: counts.atRisk },
    { key: 'completed', label: 'Completed', icon: CheckCircleIcon, count: counts.completed },
    { key: 'paused', label: 'Paused', icon: PauseCircleIcon, count: counts.paused },
  ];

  // Summary KPIs
  const totalOverdue = useMemo(() => allMetrics.reduce((s, m) => s + m.overdueTasks, 0), [allMetrics]);
  const totalInProgress = useMemo(() => allMetrics.reduce((s, m) => s + m.inProgressTasks, 0), [allMetrics]);
  const avgProgress = useMemo(() => {
    if (allMetrics.length === 0) return 0;
    return Math.round(allMetrics.reduce((s, m) => s + m.progressPercent, 0) / allMetrics.length);
  }, [allMetrics]);

  // Apply filter → search → sort
  const displayed = useMemo(() => {
    let list = filterProjects(allMetrics, filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.project.name.toLowerCase().includes(q));
    }
    return sortProjects(list, sortBy);
  }, [allMetrics, filter, search, sortBy]);

  return (
    <Shell title="Projects" subtitle={`${counts.active} active · ${totalOverdue} overdue`}>
      {isLoading ? (
        <ProjectsPageSkeleton />
      ) : (
        <div className="space-y-6">
          {/* ── Summary KPI row ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Projects', value: counts.all, color: 'text-text' },
              { label: 'Active', value: counts.active, color: 'text-green' },
              { label: 'In Progress Tasks', value: totalInProgress, color: 'text-blue' },
              { label: 'Avg. Completion', value: `${avgProgress}%`, color: 'text-accent' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{kpi.label}</p>
                <p className={cn('text-xl font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
              </motion.div>
            ))}
          </div>

          {/* ── Toolbar: search, filters, view toggle, sort ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="sticky top-14 z-20 -mx-4 space-y-3 bg-bg/95 px-4 pb-3 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          >
            {/* Search + Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-[13px] text-text placeholder:text-muted/50 transition-colors focus:border-accent focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOpen((v) => !v)}
                  className="gap-1.5"
                >
                  <ChevronUpDownIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
                <AnimatePresence>
                  {sortOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setSortBy(opt.value);
                              setSortOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center px-3 py-2 text-[12px] font-medium transition-colors',
                              sortBy === opt.value
                                ? 'bg-accent-muted text-accent'
                                : 'text-text hover:bg-bg'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-border bg-card p-0.5">
                <button
                  onClick={() => setView('grid')}
                  className={cn(
                    'rounded-md p-1.5 transition-colors',
                    view === 'grid' ? 'bg-accent-muted text-accent' : 'text-muted hover:text-text'
                  )}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    'rounded-md p-1.5 transition-colors',
                    view === 'list' ? 'bg-accent-muted text-accent' : 'text-muted hover:text-text'
                  )}
                >
                  <ListBulletIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filterPills
                .filter((p) => p.count > 0 || p.key === 'all')
                .map((pill) => (
                  <motion.button
                    key={pill.key}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setFilter(pill.key)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                      filter === pill.key
                        ? 'bg-accent-muted text-accent shadow-sm'
                        : 'bg-card text-muted hover:bg-bg hover:text-text border border-border'
                    )}
                  >
                    <pill.icon className="h-3.5 w-3.5" />
                    {pill.label}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                      filter === pill.key ? 'bg-accent/10 text-accent' : 'bg-bg text-muted'
                    )}>
                      {pill.count}
                    </span>
                  </motion.button>
                ))}
            </div>
          </motion.div>

          {/* ── Content ── */}
          {displayed.length === 0 ? (
            search ? (
              <EmptyState
                icon={MagnifyingGlassIcon}
                title="No projects found"
                description={`No projects match "${search}". Try a different search term.`}
                actionLabel="Clear search"
                onAction={() => setSearch('')}
              />
            ) : (
              <EmptyState
                icon={FolderPlusIcon}
                title="No projects yet"
                description="Get started by creating your first project to track tasks, progress, and team activity."
              />
            )
          ) : view === 'grid' ? (
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.06 },
                },
              }}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-5 lg:grid-cols-2"
            >
              {displayed.map((m) => (
                <motion.div
                  key={m.project.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
                  }}
                >
                  <ProjectKPICard metrics={m} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.04 },
                },
              }}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {/* List header */}
              <div className="hidden items-center gap-4 px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted sm:flex">
                <span className="flex-1">Project</span>
                <span className="w-28 text-center">Progress</span>
                <span className="w-12 text-center">Overdue</span>
                <span className="hidden w-12 text-center md:block">Week</span>
                <span className="hidden w-20 lg:block">Team</span>
                <span className="w-4" />
              </div>
              {displayed.map((m) => (
                <motion.div
                  key={m.project.id}
                  variants={{
                    hidden: { opacity: 0, x: -12 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
                  }}
                >
                  <ProjectListRow metrics={m} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ── Skeleton loader ── */
function ProjectsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </motion.div>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      {/* Card skeletons */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="mb-5 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="rounded-lg bg-bg/50 px-3 py-2.5">
                  <Skeleton className="mb-1 h-2.5 w-12" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
            <Skeleton className="mb-4 h-2 w-full rounded-full" />
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div className="flex -space-x-1.5">
                {Array.from({ length: 3 }).map((_, k) => (
                  <Skeleton key={k} className="h-6 w-6 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
