-- Migration: Add ON DELETE CASCADE to task child tables
-- Run this in Supabase SQL Editor before deploying.
-- This allows deleting tasks/projects without manual child cleanup.

-- task_comments → tasks
ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey,
  ADD CONSTRAINT task_comments_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- task_activity → tasks
ALTER TABLE task_activity
  DROP CONSTRAINT IF EXISTS task_activity_task_id_fkey,
  ADD CONSTRAINT task_activity_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- tasks → projects
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_project_id_fkey,
  ADD CONSTRAINT tasks_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- RLS: Allow owners to update users (for role management)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owners_update_users' AND tablename = 'users'
  ) THEN
    CREATE POLICY owners_update_users ON users
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.role = 'owner'
            AND u.company_id = users.company_id
        )
      );
  END IF;
END $$;

-- RLS: Allow delete on task_activity for task owners/managers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'managers_delete_task_activity' AND tablename = 'task_activity'
  ) THEN
    CREATE POLICY managers_delete_task_activity ON task_activity
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;

-- RLS: Allow delete on task_comments for task owners/managers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'managers_delete_task_comments' AND tablename = 'task_comments'
  ) THEN
    CREATE POLICY managers_delete_task_comments ON task_comments
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
            AND u.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
