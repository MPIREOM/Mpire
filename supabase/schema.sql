-- ============================================================
-- MPIRE Command Center — Supabase Schema
-- ============================================================

-- 1. Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. Business Units
create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index idx_business_units_company on public.business_units(company_id);

-- 3. Users (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('owner', 'manager', 'staff', 'investor')),
  company_id uuid not null references public.companies(id) on delete cascade,
  avatar_url text,
  created_at timestamptz not null default now()
);
create index idx_users_company on public.users(company_id);
create index idx_users_role on public.users(role);

-- 4. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);
create index idx_projects_company on public.projects(company_id);
create index idx_projects_status on public.projects(status);

-- 5. Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  assignee_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  recurring_rule text, -- e.g. 'daily', 'weekly', null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_due_date on public.tasks(due_date);
create index idx_tasks_assignee on public.tasks(assignee_id);
create index idx_tasks_status on public.tasks(status);
create index idx_tasks_priority on public.tasks(priority);

-- 5b. Task Assignees (many-to-many junction)
create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index idx_task_assignees_user on public.task_assignees(user_id);

-- 6. Task Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index idx_task_comments_task on public.task_comments(task_id);

-- 7. Task Activity Log
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null, -- 'created', 'status_changed', 'assigned', 'commented', etc.
  meta jsonb default '{}',
  created_at timestamptz not null default now()
);
create index idx_task_activity_task on public.task_activity(task_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.business_units enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;

-- Helper: get current user's company_id
create or replace function public.get_my_company_id()
returns uuid as $$
  select company_id from public.users where id = auth.uid()
$$ language sql security definer stable;

-- Helper: get current user's role
create or replace function public.get_my_role()
returns text as $$
  select role from public.users where id = auth.uid()
$$ language sql security definer stable;

-- COMPANIES: users can read their own company
create policy "Users can read own company"
  on public.companies for select
  using (id = public.get_my_company_id());

-- BUSINESS UNITS: users can read BUs in their company
create policy "Users can read company BUs"
  on public.business_units for select
  using (company_id = public.get_my_company_id());

-- USERS: users can read other users in their company
create policy "Users can read company members"
  on public.users for select
  using (company_id = public.get_my_company_id());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- PROJECTS: all company users can read projects
create policy "Users can read company projects"
  on public.projects for select
  using (company_id = public.get_my_company_id());

create policy "Managers can insert projects"
  on public.projects for insert
  with check (
    company_id = public.get_my_company_id()
    and public.get_my_role() in ('owner', 'manager')
  );

create policy "Managers can update projects"
  on public.projects for update
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() in ('owner', 'manager')
  );

create policy "Managers can delete projects"
  on public.projects for delete
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() in ('owner', 'manager')
  );

-- TASKS: staff see only assigned tasks; manager/owner see all company tasks
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

create policy "Managers can insert tasks"
  on public.tasks for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and p.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'manager')
  );

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

create policy "Managers can delete tasks"
  on public.tasks for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = tasks.project_id
        and p.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'manager')
  );

-- TASK ASSIGNEES: managers can manage, anyone can read own
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

-- TASK COMMENTS: company users can read comments on visible tasks
create policy "Users can read task comments"
  on public.task_comments for select
  using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_comments.task_id
        and p.company_id = public.get_my_company_id()
        and (
          public.get_my_role() in ('owner', 'manager')
          or t.assignee_id = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
        )
    )
  );

create policy "Users can insert comments on visible tasks"
  on public.task_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_comments.task_id
        and p.company_id = public.get_my_company_id()
        and (
          public.get_my_role() in ('owner', 'manager')
          or t.assignee_id = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
        )
    )
  );

-- TASK ACTIVITY: same visibility as tasks
create policy "Users can read task activity"
  on public.task_activity for select
  using (
    exists (
      select 1 from public.tasks t
      join public.projects p on p.id = t.project_id
      where t.id = task_activity.task_id
        and p.company_id = public.get_my_company_id()
        and (
          public.get_my_role() in ('owner', 'manager')
          or t.assignee_id = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
        )
    )
  );

create policy "Users can log task activity"
  on public.task_activity for insert
  with check (
    user_id = auth.uid()
  );

-- ============================================================
-- ENABLE REALTIME for tasks
-- ============================================================
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignees;
