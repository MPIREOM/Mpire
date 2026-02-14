-- ============================================================
-- MPIRE — Enable Realtime for Comments, Activity, Users & Finance
-- Run this in Supabase SQL Editor to enable live updates
-- ============================================================

-- Add task_comments to realtime publication (live comments in drawer)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add task_activity to realtime publication (live activity feed in drawer)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add users to realtime publication (live team updates)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add finance_records to realtime publication (live finance data)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_records;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add finance_uploads to realtime publication (live upload tracking)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_uploads;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
