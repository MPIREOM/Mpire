/**
 * Client-side helper to fire WhatsApp notifications via the API route.
 * All calls are fire-and-forget (never block the UI).
 */

import type { NotificationEvent } from './notifications';

interface NotifyParams {
  event: NotificationEvent;
  taskId: string;
  taskTitle: string;
  projectName?: string;
  actorId: string;
  actorName: string;
  commentBody?: string;
  assigneeIds?: string[];
}

/** Fire a notification request to the server. Never throws. */
export function fireNotification(params: NotifyParams): void {
  fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: params.event,
      task_id: params.taskId,
      task_title: params.taskTitle,
      project_name: params.projectName,
      actor_id: params.actorId,
      actor_name: params.actorName,
      comment_body: params.commentBody,
      assignee_ids: params.assigneeIds,
    }),
  }).catch(() => {
    // Silently ignore — notifications should never break the app
  });
}
