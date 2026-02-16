-- ============================================================
-- MPIRE FULL SETUP (schema + seed) — paste into SQL Editor & run
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
create index if not exists idx_business_units_company on public.business_units(company_id);

-- 3. Users (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('owner', 'manager', 'staff', 'investor')),
  company_id uuid not null references public.companies(id) on delete cascade,
  avatar_url text,
  last_seen_at timestamptz,
  allowed_project_ids uuid[] default null,
  phone_number text,
  created_at timestamptz not null default now()
);
create index if not exists idx_users_company on public.users(company_id);
create index if not exists idx_users_role on public.users(role);

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
create index if not exists idx_projects_company on public.projects(company_id);
create index if not exists idx_projects_status on public.projects(status);

-- 5. Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'done', 'blocked')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  assignee_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  recurring_rule text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_priority on public.tasks(priority);

-- 5b. Task Assignees (many-to-many junction)
create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

-- 6. Task Comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_comments_task on public.task_comments(task_id);

-- 7. Task Activity Log
create table if not exists public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  meta jsonb default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_task_activity_task on public.task_activity(task_id);

-- 8. Finance Uploads (version history per project)
create table if not exists public.finance_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  file_name text not null,
  column_mapping jsonb not null default '{}',
  row_count integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_finance_uploads_project on public.finance_uploads(project_id);
create index if not exists idx_finance_uploads_uploaded_by on public.finance_uploads(uploaded_by);

-- 9. Finance Records (the actual data rows)
create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  upload_id uuid not null references public.finance_uploads(id) on delete cascade,
  month text not null,
  category text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_finance_records_project on public.finance_records(project_id);
create index if not exists idx_finance_records_upload on public.finance_records(upload_id);
create index if not exists idx_finance_records_month on public.finance_records(month);

-- 10. User Sessions (presence & visit tracking)
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page text
);
create index if not exists idx_user_sessions_user on public.user_sessions(user_id);
create index if not exists idx_user_sessions_last_seen on public.user_sessions(last_seen_at);

-- AUTO-UPDATE updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ROW LEVEL SECURITY
alter table public.companies enable row level security;
alter table public.business_units enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.finance_uploads enable row level security;
alter table public.finance_records enable row level security;
alter table public.user_sessions enable row level security;

create or replace function public.get_my_company_id()
returns uuid as $$
  select company_id from public.users where id = auth.uid()
$$ language sql security definer stable;

create or replace function public.get_my_role()
returns text as $$
  select role from public.users where id = auth.uid()
$$ language sql security definer stable;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Users can read own company') then
    create policy "Users can read own company" on public.companies for select using (id = public.get_my_company_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read company BUs') then
    create policy "Users can read company BUs" on public.business_units for select using (company_id = public.get_my_company_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read company members') then
    create policy "Users can read company members" on public.users for select using (company_id = public.get_my_company_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update own profile') then
    create policy "Users can update own profile" on public.users for update using (id = auth.uid()) with check (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read company projects') then
    create policy "Users can read company projects" on public.projects for select using (company_id = public.get_my_company_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can insert projects') then
    create policy "Managers can insert projects" on public.projects for insert with check (company_id = public.get_my_company_id() and public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can update projects') then
    create policy "Managers can update projects" on public.projects for update using (company_id = public.get_my_company_id() and public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can delete projects') then
    create policy "Managers can delete projects" on public.projects for delete using (company_id = public.get_my_company_id() and public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Staff read assigned tasks') then
    create policy "Staff read assigned tasks" on public.tasks for select using (exists (select 1 from public.projects p where p.id = tasks.project_id and p.company_id = public.get_my_company_id()) and (public.get_my_role() in ('owner', 'manager') or assignee_id = auth.uid() or exists (select 1 from public.task_assignees ta where ta.task_id = tasks.id and ta.user_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can insert tasks') then
    create policy "Managers can insert tasks" on public.tasks for insert with check (exists (select 1 from public.projects p where p.id = tasks.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Staff can update own task status') then
    create policy "Staff can update own task status" on public.tasks for update using (exists (select 1 from public.projects p where p.id = tasks.project_id and p.company_id = public.get_my_company_id()) and (public.get_my_role() in ('owner', 'manager') or assignee_id = auth.uid() or exists (select 1 from public.task_assignees ta where ta.task_id = tasks.id and ta.user_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can delete tasks') then
    create policy "Managers can delete tasks" on public.tasks for delete using (exists (select 1 from public.projects p where p.id = tasks.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'manager'));
  end if;
  -- Task assignees RLS
  if not exists (select 1 from pg_policies where policyname = 'Users can read task assignees') then
    create policy "Users can read task assignees" on public.task_assignees for select using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_assignees.task_id and p.company_id = public.get_my_company_id()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can insert task assignees') then
    create policy "Managers can insert task assignees" on public.task_assignees for insert with check (public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Managers can delete task assignees') then
    create policy "Managers can delete task assignees" on public.task_assignees for delete using (public.get_my_role() in ('owner', 'manager'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read task comments') then
    create policy "Users can read task comments" on public.task_comments for select using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_comments.task_id and p.company_id = public.get_my_company_id() and (public.get_my_role() in ('owner', 'manager') or t.assignee_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert comments on visible tasks') then
    create policy "Users can insert comments on visible tasks" on public.task_comments for insert with check (user_id = auth.uid() and exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_comments.task_id and p.company_id = public.get_my_company_id() and (public.get_my_role() in ('owner', 'manager') or t.assignee_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can read task activity') then
    create policy "Users can read task activity" on public.task_activity for select using (exists (select 1 from public.tasks t join public.projects p on p.id = t.project_id where t.id = task_activity.task_id and p.company_id = public.get_my_company_id() and (public.get_my_role() in ('owner', 'manager') or t.assignee_id = auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can log task activity') then
    create policy "Users can log task activity" on public.task_activity for insert with check (user_id = auth.uid());
  end if;
  -- Owners can update any user in the same company
  if not exists (select 1 from pg_policies where policyname = 'Owners can update company users') then
    create policy "Owners can update company users" on public.users for update using (company_id = public.get_my_company_id() and public.get_my_role() = 'owner') with check (company_id = public.get_my_company_id() and public.get_my_role() = 'owner');
  end if;
  -- Finance uploads RLS
  if not exists (select 1 from pg_policies where policyname = 'Finance users can read uploads') then
    create policy "Finance users can read uploads" on public.finance_uploads for select using (exists (select 1 from public.projects p where p.id = finance_uploads.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'investor'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Finance users can insert uploads') then
    create policy "Finance users can insert uploads" on public.finance_uploads for insert with check (uploaded_by = auth.uid() and exists (select 1 from public.projects p where p.id = finance_uploads.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'investor'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Owner can delete uploads') then
    create policy "Owner can delete uploads" on public.finance_uploads for delete using (exists (select 1 from public.projects p where p.id = finance_uploads.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() = 'owner');
  end if;
  -- Finance records RLS
  if not exists (select 1 from pg_policies where policyname = 'Finance users can read records') then
    create policy "Finance users can read records" on public.finance_records for select using (exists (select 1 from public.projects p where p.id = finance_records.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'investor'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Finance users can insert records') then
    create policy "Finance users can insert records" on public.finance_records for insert with check (exists (select 1 from public.projects p where p.id = finance_records.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'investor'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Finance users can delete records') then
    create policy "Finance users can delete records" on public.finance_records for delete using (exists (select 1 from public.projects p where p.id = finance_records.project_id and p.company_id = public.get_my_company_id()) and public.get_my_role() in ('owner', 'investor'));
  end if;
  -- User sessions RLS
  if not exists (select 1 from pg_policies where policyname = 'Users can read company sessions') then
    create policy "Users can read company sessions" on public.user_sessions for select using (exists (select 1 from public.users u where u.id = user_sessions.user_id and u.company_id = public.get_my_company_id()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert own sessions') then
    create policy "Users can insert own sessions" on public.user_sessions for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update own sessions') then
    create policy "Users can update own sessions" on public.user_sessions for update using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can delete own sessions') then
    create policy "Users can delete own sessions" on public.user_sessions for delete using (user_id = auth.uid());
  end if;
end $$;

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_records;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_uploads;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- SEED DATA
-- ============================================================
do $$
declare
  v_company_id uuid;
  v_bu_ops uuid;
  v_bu_dev uuid;
  v_owner_id uuid := 'a2f6a06d-f7b3-47eb-b6f7-ac14a2cabbd5';
  v_proj_website uuid;
  v_proj_mobile uuid;
  v_proj_ops uuid;
begin

-- Company
insert into public.companies (id, name) values (gen_random_uuid(), 'MPIRE Group')
  returning id into v_company_id;

-- Business Units
insert into public.business_units (id, company_id, name) values (gen_random_uuid(), v_company_id, 'Operations')
  returning id into v_bu_ops;
insert into public.business_units (id, company_id, name) values (gen_random_uuid(), v_company_id, 'Development')
  returning id into v_bu_dev;

-- Users (must match auth.users IDs)
insert into public.users (id, email, full_name, role, company_id) values
  (v_owner_id, 'almuhannad@mpireom.com', 'Al Muhannad', 'owner', v_company_id);

-- Projects
insert into public.projects (id, company_id, business_unit_id, name, status, color) values
  (gen_random_uuid(), v_company_id, v_bu_dev, 'Website Redesign', 'active', '#3b82f6')
  returning id into v_proj_website;
insert into public.projects (id, company_id, business_unit_id, name, status, color) values
  (gen_random_uuid(), v_company_id, v_bu_dev, 'Mobile App', 'active', '#8b5cf6')
  returning id into v_proj_mobile;
insert into public.projects (id, company_id, business_unit_id, name, status, color) values
  (gen_random_uuid(), v_company_id, v_bu_ops, 'Daily Operations', 'active', '#f59e0b')
  returning id into v_proj_ops;

-- Tasks — Website Redesign
insert into public.tasks (project_id, title, description, status, priority, due_date, assignee_id, created_by) values
  (v_proj_website, 'Design landing page mockups', 'Create high-fidelity mockups for the new landing page', 'in_progress', 'high', current_date, v_owner_id, v_owner_id),
  (v_proj_website, 'Implement auth flow', 'Set up Supabase Auth with email/password and OAuth', 'todo', 'high', current_date + 1, v_owner_id, v_owner_id),
  (v_proj_website, 'Write API documentation', 'Document all REST endpoints', 'todo', 'medium', current_date + 3, v_owner_id, v_owner_id),
  (v_proj_website, 'Set up CI/CD pipeline', 'GitHub Actions for staging and production', 'done', 'medium', current_date - 2, v_owner_id, v_owner_id),
  (v_proj_website, 'Optimize page load speed', 'Target LCP under 2.5s', 'todo', 'low', current_date + 7, v_owner_id, v_owner_id),
  (v_proj_website, 'Fix mobile nav bug', 'Hamburger menu not closing on route change', 'todo', 'high', current_date - 1, v_owner_id, v_owner_id);

-- Tasks — Mobile App
insert into public.tasks (project_id, title, description, status, priority, due_date, assignee_id, created_by) values
  (v_proj_mobile, 'Set up React Native project', 'Initialize with Expo and configure TypeScript', 'done', 'high', current_date - 5, v_owner_id, v_owner_id),
  (v_proj_mobile, 'Build onboarding screens', 'Three-step onboarding with illustrations', 'in_progress', 'medium', current_date + 2, v_owner_id, v_owner_id),
  (v_proj_mobile, 'Integrate push notifications', 'Firebase Cloud Messaging setup', 'todo', 'medium', current_date + 5, v_owner_id, v_owner_id),
  (v_proj_mobile, 'Design app icon and splash', 'Final assets for App Store and Play Store', 'todo', 'low', current_date + 10, v_owner_id, v_owner_id);

-- Tasks — Daily Operations
insert into public.tasks (project_id, title, description, status, priority, due_date, assignee_id, created_by) values
  (v_proj_ops, 'Review weekly financials', 'Check P&L and cash position', 'todo', 'high', current_date, v_owner_id, v_owner_id),
  (v_proj_ops, 'Team standup prep', 'Prepare agenda for Monday standup', 'todo', 'medium', current_date, v_owner_id, v_owner_id),
  (v_proj_ops, 'Client follow-up emails', 'Send project updates to 3 clients', 'in_progress', 'high', current_date - 1, v_owner_id, v_owner_id),
  (v_proj_ops, 'Update project timeline', 'Reflect new deadlines in Gantt chart', 'todo', 'medium', current_date + 1, v_owner_id, v_owner_id),
  (v_proj_ops, 'Office supplies order', 'Restock printer paper and toner', 'done', 'low', current_date - 3, v_owner_id, v_owner_id);

end $$;
