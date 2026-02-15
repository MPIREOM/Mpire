/**
 * Notification helpers — build message bodies for WhatsApp notifications.
 */

export type NotificationEvent = 'task_created' | 'comment_added' | 'task_assigned';

interface TaskNotificationPayload {
  event: NotificationEvent;
  taskTitle: string;
  projectName?: string;
  actorName: string; // the person who triggered the event
  commentBody?: string; // only for comment_added
}

/** Build a human-readable WhatsApp message for a task event. */
export function buildNotificationMessage(payload: TaskNotificationPayload): string {
  const project = payload.projectName ? ` in *${payload.projectName}*` : '';

  switch (payload.event) {
    case 'task_created':
      return (
        `📋 *New Task Created*\n\n` +
        `*${payload.taskTitle}*${project}\n\n` +
        `Created by ${payload.actorName}`
      );

    case 'task_assigned':
      return (
        `👤 *Task Assigned to You*\n\n` +
        `*${payload.taskTitle}*${project}\n\n` +
        `Assigned by ${payload.actorName}`
      );

    case 'comment_added':
      return (
        `💬 *New Comment*\n\n` +
        `On task: *${payload.taskTitle}*${project}\n\n` +
        `${payload.actorName}: "${payload.commentBody?.slice(0, 200) ?? ''}"`
      );

    default:
      return `Notification: ${payload.event} on ${payload.taskTitle}`;
  }
}
