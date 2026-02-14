-- ============================================================
-- MPIRE — Enable Realtime for Comments, Activity & Users
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
