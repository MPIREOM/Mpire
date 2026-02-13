-- ============================================================
-- MPIRE — Add Backlog Status Migration
-- ============================================================

-- Update the check constraint on tasks.status to include 'backlog'
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('backlog', 'todo', 'in_progress', 'done', 'blocked'));
