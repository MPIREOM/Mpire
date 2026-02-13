import type { Task, User } from '@/types/database';

/** Get all assigned users from a task (junction table first, fallback to legacy assignee) */
export function getTaskAssignees(task: Task): User[] {
  if (task.task_assignees && task.task_assignees.length > 0) {
    return task.task_assignees
      .map((ta) => ta.user)
      .filter((u): u is User => !!u);
  }
  return task.assignee ? [task.assignee] : [];
}

/** Get all assigned user IDs from a task */
export function getTaskAssigneeIds(task: Task): string[] {
  if (task.task_assignees && task.task_assignees.length > 0) {
    return task.task_assignees.map((ta) => ta.user_id);
  }
  return task.assignee_id ? [task.assignee_id] : [];
}

/** Check if a user is assigned to a task */
export function isAssignedTo(task: Task, userId: string): boolean {
  if (task.task_assignees && task.task_assignees.length > 0) {
    return task.task_assignees.some((ta) => ta.user_id === userId);
  }
  return task.assignee_id === userId;
}
