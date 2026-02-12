-- ============================================================
-- MPIRE FINANCE MIGRATION
-- Adds: finance_uploads, finance_records tables + tags on tasks
-- Paste into Supabase SQL Editor & run
-- ============================================================

-- --------------------------------------------------------
-- 1. Add tags column to tasks (if not exists)
-- --------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'tags'
  ) then
    alter table public.tasks add column tags text[] not null default '{}';
  end if;
end $$;

-- --------------------------------------------------------
-- 2. Finance Uploads (version history per project)
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- 3. Finance Records (the actual data rows)
-- --------------------------------------------------------
create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  upload_id uuid not null references public.finance_uploads(id) on delete cascade,
  month text not null,          -- format: YYYY-MM
  category text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_records_project on public.finance_records(project_id);
create index if not exists idx_finance_records_upload on public.finance_records(upload_id);
create index if not exists idx_finance_records_month on public.finance_records(month);

-- --------------------------------------------------------
-- 4. Enable Row Level Security
-- --------------------------------------------------------
alter table public.finance_uploads enable row level security;
alter table public.finance_records enable row level security;

-- --------------------------------------------------------
-- 5. RLS Policies
-- --------------------------------------------------------
do $$ begin

  -- FINANCE UPLOADS --

  -- Read: owner/investor can see all company uploads
  if not exists (select 1 from pg_policies where policyname = 'Finance users can read uploads') then
    create policy "Finance users can read uploads"
      on public.finance_uploads for select
      using (
        exists (
          select 1 from public.projects p
          where p.id = finance_uploads.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() in ('owner', 'investor')
      );
  end if;

  -- Insert: owner/investor can upload
  if not exists (select 1 from pg_policies where policyname = 'Finance users can insert uploads') then
    create policy "Finance users can insert uploads"
      on public.finance_uploads for insert
      with check (
        uploaded_by = auth.uid()
        and exists (
          select 1 from public.projects p
          where p.id = finance_uploads.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() in ('owner', 'investor')
      );
  end if;

  -- Delete: owner only (for rollback)
  if not exists (select 1 from pg_policies where policyname = 'Owner can delete uploads') then
    create policy "Owner can delete uploads"
      on public.finance_uploads for delete
      using (
        exists (
          select 1 from public.projects p
          where p.id = finance_uploads.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() = 'owner'
      );
  end if;

  -- FINANCE RECORDS --

  -- Read: owner/investor can see all company records
  if not exists (select 1 from pg_policies where policyname = 'Finance users can read records') then
    create policy "Finance users can read records"
      on public.finance_records for select
      using (
        exists (
          select 1 from public.projects p
          where p.id = finance_records.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() in ('owner', 'investor')
      );
  end if;

  -- Insert: owner/investor can insert records
  if not exists (select 1 from pg_policies where policyname = 'Finance users can insert records') then
    create policy "Finance users can insert records"
      on public.finance_records for insert
      with check (
        exists (
          select 1 from public.projects p
          where p.id = finance_records.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() in ('owner', 'investor')
      );
  end if;

  -- Delete: owner/investor can delete records (for re-upload replacement)
  if not exists (select 1 from pg_policies where policyname = 'Finance users can delete records') then
    create policy "Finance users can delete records"
      on public.finance_records for delete
      using (
        exists (
          select 1 from public.projects p
          where p.id = finance_records.project_id
            and p.company_id = public.get_my_company_id()
        )
        and public.get_my_role() in ('owner', 'investor')
      );
  end if;

end $$;
