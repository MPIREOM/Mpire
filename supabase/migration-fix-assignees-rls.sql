-- ============================================================
-- MPIRE - Fix task_assignees RLS to scope by company
-- Run this in Supabase SQL Editor to close cross-company leak
-- ============================================================

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Users can read task assignees" ON public.task_assignees;

-- Recreate with company scoping via project -> company join
CREATE POLICY "Users can read task assignees"
  ON public.task_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = task_assignees.task_id
        AND p.company_id = public.get_my_company_id()
    )
  );
