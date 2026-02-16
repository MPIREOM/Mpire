import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { buildNotificationMessage, type NotificationEvent } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications
 *
 * Sends WhatsApp notifications to relevant users for task events.
 *
 * Body:
 *   event:       'task_created' | 'comment_added' | 'task_assigned'
 *   task_id:     UUID of the task
 *   task_title:  Title of the task
 *   project_name?: Name of the project
 *   actor_id:    UUID of the user who triggered the event
 *   actor_name:  Display name of the actor
 *   comment_body?: (for comment_added) The comment text
 *   assignee_ids?: (for task_assigned) Specific user IDs to notify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      event,
      task_id,
      task_title,
      project_name,
      actor_id,
      actor_name,
      comment_body,
      assignee_ids,
    } = body as {
      event: NotificationEvent;
      task_id: string;
      task_title: string;
      project_name?: string;
      actor_id: string;
      actor_name: string;
      comment_body?: string;
      assignee_ids?: string[];
    };

    if (!event || !task_id || !task_title || !actor_id || !actor_name) {
      return NextResponse.json(
        { error: 'Missing required fields: event, task_id, task_title, actor_id, actor_name' },
        { status: 400 }
      );
    }

    // Authenticate the caller
    const supabase = await createServerSupabase();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to read users + insert notification log
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // No service key — skip notifications silently in dev
      return NextResponse.json({ sent: 0, skipped: 'service role not configured' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Determine recipients: users in same company with WhatsApp enabled, excluding the actor
    const { data: caller } = await admin
      .from('users')
      .select('company_id')
      .eq('id', authUser.id)
      .single();

    if (!caller) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Recipients: users in same company who have a phone number, excluding the actor
    let recipientQuery = admin
      .from('users')
      .select('id, full_name, phone_number')
      .eq('company_id', caller.company_id)
      .not('phone_number', 'is', null)
      .neq('id', actor_id);

    // For task_assigned, only notify the specific assignees
    if (event === 'task_assigned' && assignee_ids && assignee_ids.length > 0) {
      recipientQuery = recipientQuery.in('id', assignee_ids);
    }

    // For comment_added, notify assignees of the task
    if (event === 'comment_added') {
      // Get task assignees
      const { data: taskAssignees } = await admin
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', task_id);

      const { data: task } = await admin
        .from('tasks')
        .select('assignee_id')
        .eq('id', task_id)
        .single();

      const relevantUserIds = new Set<string>();
      taskAssignees?.forEach((a) => relevantUserIds.add(a.user_id));
      if (task?.assignee_id) relevantUserIds.add(task.assignee_id);

      // Remove the commenter from recipients
      relevantUserIds.delete(actor_id);

      if (relevantUserIds.size === 0) {
        return NextResponse.json({ sent: 0, reason: 'no assignees to notify' });
      }

      recipientQuery = recipientQuery.in('id', Array.from(relevantUserIds));
    }

    const { data: recipients } = await recipientQuery;

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'no opted-in recipients' });
    }

    const message = buildNotificationMessage({
      event,
      taskTitle: task_title,
      projectName: project_name,
      actorName: actor_name,
      commentBody: comment_body,
    });

    // Send to each recipient in parallel
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const phone = recipient.phone_number as string;
        const result = await sendWhatsAppMessage(phone, message);

        // Log the notification
        await admin.from('notification_log').insert({
          user_id: recipient.id,
          task_id,
          event_type: event,
          channel: 'whatsapp',
          phone_number: phone,
          message_body: message,
          status: result.success ? 'sent' : 'failed',
          error_message: result.error || null,
          provider_message_id: result.messageId || null,
          sent_at: result.success ? new Date().toISOString() : null,
        });

        return { userId: recipient.id, ...result };
      })
    );

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    return NextResponse.json({ sent, total: recipients.length });
  } catch (err) {
    console.error('POST /api/notifications error:', err);
    return NextResponse.json(
      { error: 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
