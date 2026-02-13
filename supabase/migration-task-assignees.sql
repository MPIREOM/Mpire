-- Migration: Multi-assignee support for tasks
-- Creates task_assignees junction table and migrates existing assignee_id data

-- 1. Create junction table
create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

-- 2. Migrate existing assignee_id data into junction table
insert into public.task_assignees (task_id, user_id)
select id, assignee_id from public.tasks
where assignee_id is not null
on conflict do nothing;

-- 3. Enable RLS
alter table public.task_assignees enable row level security;

create policy "Users can read task assignees"
  on public.task_assignees for select
  using (true);

create policy "Managers can insert task assignees"
  on public.task_assignees for insert
  with check (public.get_my_role() in ('owner', 'manager'));

create policy "Managers can delete task assignees"
  on public.task_assignees for delete
  using (public.get_my_role() in ('owner', 'manager'));

-- 4. Update task visibility RLS to include junction table
-- Drop and recreate the select policy
drop policy if exists "Staff read assigned tasks" on public.tasks;
create policy "Staff read assigned tasks"
  on public.tasks for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and p.company_id = public.get_my_company_id()
    )
    and (
      public.get_my_role() in ('owner', 'manager')
      or assignee_id = auth.uid()
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = tasks.id and ta.user_id = auth.uid()
      )
    )
  );

-- Drop and recreate the update policy
drop policy if exists "Staff can update own task status" on public.tasks;
create policy "Staff can update own task status"
  on public.tasks for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and p.company_id = public.get_my_company_id()
    )
    and (
      public.get_my_role() in ('owner', 'manager')
      or assignee_id = auth.uid()
      or exists (
        select 1 from public.task_assignees ta
        where ta.task_id = tasks.id and ta.user_id = auth.uid()
      )
    )
  );

-- 5. Enable realtime
alter publication supabase_realtime add table public.task_assignees;
