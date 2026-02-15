-- ============================================================
-- WhatsApp Notifications — Schema Migration
-- ============================================================

-- 1. Add WhatsApp fields to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean NOT NULL DEFAULT false;

-- 2. Notification log — tracks every sent message
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'task_created', 'comment_added', 'task_assigned'
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'email', etc.
  phone_number text,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message text,
  provider_message_id text, -- ID returned by WhatsApp API
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON public.notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_task ON public.notification_log(task_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON public.notification_log(status);

-- 3. RLS for notification_log
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notification_log FOR SELECT
  USING (user_id = auth.uid());

-- Service role (via API route) inserts notifications
CREATE POLICY "Service role can insert notifications"
  ON public.notification_log FOR INSERT
  WITH CHECK (true);

-- Service role can update notification status
CREATE POLICY "Service role can update notifications"
  ON public.notification_log FOR UPDATE
  USING (true);
