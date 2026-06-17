/**
 * Notification helpers — build message bodies for WhatsApp notifications.
 */

import type { TemplateParams } from './whatsapp';

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

/**
 * Approved Meta template names, one per event. Override via env if your
 * approved templates use different names. The defaults match the templates
 * documented in WHATSAPP_SETUP.md.
 */
function templateName(event: NotificationEvent): string {
  switch (event) {
    case 'task_created':
      return process.env.WHATSAPP_TEMPLATE_TASK_CREATED || 'task_created';
    case 'task_assigned':
      return process.env.WHATSAPP_TEMPLATE_TASK_ASSIGNED || 'task_assigned';
    case 'comment_added':
      return process.env.WHATSAPP_TEMPLATE_COMMENT_ADDED || 'comment_added';
  }
}

/**
 * Build the approved-template payload for a task event.
 *
 * The body parameter ORDER below must match the {{1}}, {{2}}, ... placeholders
 * in the approved template (see WHATSAPP_SETUP.md). WhatsApp requires every
 * placeholder to be filled, so optional fields fall back to a dash.
 */
export function buildTemplateParams(payload: TaskNotificationPayload): TemplateParams {
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
  const project = payload.projectName?.trim() || '—';

  switch (payload.event) {
    case 'task_created':
    case 'task_assigned':
      // {{1}} task title, {{2}} project, {{3}} actor
      return {
        name: templateName(payload.event),
        languageCode,
        bodyParams: [payload.taskTitle, project, payload.actorName],
      };

    case 'comment_added':
      // {{1}} task title, {{2}} project, {{3}} actor, {{4}} comment
      return {
        name: templateName(payload.event),
        languageCode,
        bodyParams: [
          payload.taskTitle,
          project,
          payload.actorName,
          (payload.commentBody?.slice(0, 300) || '').trim() || '—',
        ],
      };
  }
}

/**
 * Build the approved-template payload for the monthly finance report.
 *
 * Uses a template with a DOCUMENT header (the PDF) and a short body summarising
 * revenue and expenses. The PDF must already be uploaded via uploadWhatsAppMedia.
 *
 * Template body placeholders (see WHATSAPP_SETUP.md):
 *   {{1}} month   {{2}} revenue collected   {{3}} total expenses   {{4}} net profit
 */
export function buildFinanceReportTemplate(args: {
  monthLabel: string;
  revenueCollected: string;
  totalExpenses: string;
  netProfit: string;
  mediaId: string;
  filename: string;
}): TemplateParams {
  return {
    name: process.env.WHATSAPP_TEMPLATE_FINANCE_REPORT || 'monthly_finance_report',
    languageCode: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US',
    bodyParams: [args.monthLabel, args.revenueCollected, args.totalExpenses, args.netProfit],
    headerDocument: { mediaId: args.mediaId, filename: args.filename },
  };
}
