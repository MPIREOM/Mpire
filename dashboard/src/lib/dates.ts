import { format, isToday, isTomorrow, isPast, startOfDay, isThisWeek, parseISO } from 'date-fns';

export function formatDate(date: string | null): string {
  if (!date) return '—';
  const d = parseISO(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'done') return false;
  return isPast(startOfDay(parseISO(dueDate))) && !isToday(parseISO(dueDate));
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return isToday(parseISO(dueDate));
}

export function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return isThisWeek(parseISO(dueDate), { weekStartsOn: 0 });
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
