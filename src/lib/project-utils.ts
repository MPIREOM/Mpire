import type { Task, Project, User } from '@/types/database';
import { isOverdue, isDueToday, isDueThisWeek } from '@/lib/dates';
import { formatDistanceToNow, parseISO } from 'date-fns';

/* ── Derived project metrics from tasks ── */

export interface ProjectMetrics {
  project: Project;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  dueToday: number;
  dueThisWeek: number;
  progressPercent: number;
  health: 'green' | 'yellow' | 'red';
  dominantPriority: 'high' | 'medium' | 'low';
  assignees: User[];
  lastActivityAt: string | null;
  lastActivityRelative: string;
  highPriorityCount: number;
  weeklyCompletions: number[];
}

export function computeProjectMetrics(
  project: Project,
  tasks: Task[],
  allUsers: User[]
): ProjectMetrics {
  const pTasks = tasks.filter((t) => t.project_id === project.id);
  const total = pTasks.length;
  const done = pTasks.filter((t) => t.status === 'done').length;
  const overdue = pTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const inProgress = pTasks.filter((t) => t.status === 'in_progress').length;
  const blocked = pTasks.filter((t) => t.status === 'blocked').length;
  const today = pTasks.filter((t) => isDueToday(t.due_date) && t.status !== 'done').length;
  const week = pTasks.filter((t) => isDueThisWeek(t.due_date) && t.status !== 'done').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  // Health
  let health: 'green' | 'yellow' | 'red' = 'green';
  if (overdue > 0 || blocked > 2) health = 'red';
  else if (progress < 30 && total > 5) health = 'yellow';
  else if (inProgress === 0 && done < total && total > 0) health = 'yellow';

  // Dominant priority (what most open tasks are)
  const openTasks = pTasks.filter((t) => t.status !== 'done');
  const highCount = openTasks.filter((t) => t.priority === 'high').length;
  const medCount = openTasks.filter((t) => t.priority === 'medium').length;
  let dominantPriority: 'high' | 'medium' | 'low' = 'low';
  if (highCount > 0 && highCount >= medCount) dominantPriority = 'high';
  else if (medCount > 0) dominantPriority = 'medium';

  // Unique assignees
  const assigneeIds = [...new Set(pTasks.map((t) => t.assignee_id).filter(Boolean))];
  const assignees = assigneeIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is User => u !== undefined);

  // Last activity
  const lastActivityAt =
    pTasks.length > 0
      ? pTasks.reduce((latest, t) =>
          new Date(t.updated_at) > new Date(latest) ? t.updated_at : latest,
        pTasks[0].updated_at)
      : null;

  const lastActivityRelative = lastActivityAt
    ? formatDistanceToNow(parseISO(lastActivityAt), { addSuffix: true })
    : 'No activity';

  // Weekly completion sparkline: last 7 days, how many done per day
  const now = new Date();
  const weeklyCompletions: number[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const dayStr = day.toISOString().split('T')[0];
    const count = pTasks.filter(
      (t) => t.status === 'done' && t.updated_at.startsWith(dayStr)
    ).length;
    weeklyCompletions.push(count);
  }

  return {
    project,
    totalTasks: total,
    doneTasks: done,
    overdueTasks: overdue,
    inProgressTasks: inProgress,
    blockedTasks: blocked,
    dueToday: today,
    dueThisWeek: week,
    progressPercent: progress,
    health,
    dominantPriority,
    assignees,
    lastActivityAt,
    lastActivityRelative,
    highPriorityCount: highCount,
    weeklyCompletions,
  };
}

/* ── Colors and variants ── */

export function getHealthBadgeVariant(health: 'green' | 'yellow' | 'red') {
  if (health === 'green') return 'success' as const;
  if (health === 'yellow') return 'warning' as const;
  return 'danger' as const;
}

export function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'paused':
      return 'warning' as const;
    case 'completed':
      return 'info' as const;
    case 'archived':
      return 'default' as const;
    default:
      return 'default' as const;
  }
}

export function getPriorityColor(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high':
      return 'var(--color-red)';
    case 'medium':
      return 'var(--color-yellow)';
    case 'low':
      return 'var(--color-blue)';
  }
}

export function getProgressColor(percent: number, overdue: number) {
  if (overdue > 0) return 'bg-red';
  if (percent >= 75) return 'bg-green';
  if (percent >= 50) return 'bg-blue';
  if (percent >= 25) return 'bg-yellow';
  return 'bg-red';
}

export function getProgressRawColor(percent: number, overdue: number) {
  if (overdue > 0) return 'var(--color-red)';
  if (percent >= 75) return 'var(--color-green)';
  if (percent >= 50) return 'var(--color-blue)';
  if (percent >= 25) return 'var(--color-yellow)';
  return 'var(--color-red)';
}

export type SortKey = 'priority' | 'progress' | 'overdue' | 'name' | 'updated';
export type FilterKey = 'all' | 'active' | 'at-risk' | 'completed' | 'paused';

export function sortProjects(metrics: ProjectMetrics[], sortBy: SortKey): ProjectMetrics[] {
  const arr = [...metrics];
  switch (sortBy) {
    case 'priority': {
      const prio = { high: 0, medium: 1, low: 2 };
      return arr.sort((a, b) => prio[a.dominantPriority] - prio[b.dominantPriority]);
    }
    case 'progress':
      return arr.sort((a, b) => b.progressPercent - a.progressPercent);
    case 'overdue':
      return arr.sort((a, b) => b.overdueTasks - a.overdueTasks);
    case 'name':
      return arr.sort((a, b) => a.project.name.localeCompare(b.project.name));
    case 'updated':
      return arr.sort((a, b) => {
        if (!a.lastActivityAt) return 1;
        if (!b.lastActivityAt) return -1;
        return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      });
    default:
      return arr;
  }
}

export function filterProjects(metrics: ProjectMetrics[], filter: FilterKey): ProjectMetrics[] {
  switch (filter) {
    case 'active':
      return metrics.filter((m) => m.project.status === 'active');
    case 'at-risk':
      return metrics.filter((m) => m.health === 'red');
    case 'completed':
      return metrics.filter((m) => m.project.status === 'completed');
    case 'paused':
      return metrics.filter((m) => m.project.status === 'paused');
    default:
      return metrics;
  }
}
