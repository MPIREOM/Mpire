-- ============================================================
-- MPIRE FINANCE → BUSINESSES MIGRATION
-- Switches finance_uploads & finance_records from project_id
-- to business_id (referencing business_units).
-- Paste into Supabase SQL Editor & run.
-- ============================================================

-- --------------------------------------------------------
-- 1. Add business_id column to finance_uploads
-- --------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_uploads'
      and column_name = 'business_id'
  ) then
    alter table public.finance_uploads
      add column business_id uuid references public.business_units(id) on delete cascade;
  end if;
end $$;

-- --------------------------------------------------------
-- 2. Add business_id column to finance_records
-- --------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_records'
      and column_name = 'business_id'
  ) then
    alter table public.finance_records
      add column business_id uuid references public.business_units(id) on delete cascade;
  end if;
end $$;

-- --------------------------------------------------------
-- 2b. Backfill existing rows: assign business_id from their
--     project's business_unit, defaulting to Operations.
-- --------------------------------------------------------
update public.finance_uploads
  set business_id = coalesce(
    (select p.business_unit_id from public.projects p where p.id = finance_uploads.project_id),
    '28a80e59-72a2-474c-a609-d965089f3853'   -- Operations fallback
  )
where business_id is null;

update public.finance_records
  set business_id = coalesce(
    (select fu.business_id from public.finance_uploads fu where fu.id = finance_records.upload_id),
    '28a80e59-72a2-474c-a609-d965089f3853'   -- Operations fallback
  )
where business_id is null;

-- --------------------------------------------------------
-- 3. Drop old project_id columns (they are no longer used)
-- --------------------------------------------------------
do $$ begin
  -- Drop foreign key constraints first, then the columns
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_records'
      and column_name = 'project_id'
  ) then
    alter table public.finance_records drop column project_id cascade;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_uploads'
      and column_name = 'project_id'
  ) then
    alter table public.finance_uploads drop column project_id cascade;
  end if;
end $$;

-- --------------------------------------------------------
-- 4. Make business_id NOT NULL now that project_id is gone
-- --------------------------------------------------------
alter table public.finance_uploads alter column business_id set not null;
alter table public.finance_records alter column business_id set not null;

-- --------------------------------------------------------
-- 5. Add indexes on business_id
-- --------------------------------------------------------
create index if not exists idx_finance_uploads_business on public.finance_uploads(business_id);
create index if not exists idx_finance_records_business on public.finance_records(business_id);

-- --------------------------------------------------------
-- 6. Drop old RLS policies (project-based) and recreate
-- --------------------------------------------------------
do $$ begin
  -- Drop old policies if they exist
  drop policy if exists "Finance users can read uploads" on public.finance_uploads;
  drop policy if exists "Finance users can insert uploads" on public.finance_uploads;
  drop policy if exists "Owner can delete uploads" on public.finance_uploads;
  drop policy if exists "Finance users can read records" on public.finance_records;
  drop policy if exists "Finance users can insert records" on public.finance_records;
  drop policy if exists "Finance users can delete records" on public.finance_records;
end $$;

-- New business-based RLS policies

-- FINANCE UPLOADS
create policy "Finance users can read uploads"
  on public.finance_uploads for select
  using (
    exists (
      select 1 from public.business_units bu
      where bu.id = finance_uploads.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'investor')
  );

create policy "Finance users can insert uploads"
  on public.finance_uploads for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.business_units bu
      where bu.id = finance_uploads.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'investor')
  );

create policy "Owner can delete uploads"
  on public.finance_uploads for delete
  using (
    exists (
      select 1 from public.business_units bu
      where bu.id = finance_uploads.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() = 'owner'
  );

-- FINANCE RECORDS
create policy "Finance users can read records"
  on public.finance_records for select
  using (
    exists (
      select 1 from public.business_units bu
      where bu.id = finance_records.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'investor')
  );

create policy "Finance users can insert records"
  on public.finance_records for insert
  with check (
    exists (
      select 1 from public.business_units bu
      where bu.id = finance_records.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'investor')
  );

create policy "Finance users can delete records"
  on public.finance_records for delete
  using (
    exists (
      select 1 from public.business_units bu
      where bu.id = finance_records.business_id
        and bu.company_id = public.get_my_company_id()
    )
    and public.get_my_role() in ('owner', 'investor')
  );

-- --------------------------------------------------------
-- 7. Business Units CUD policies (only SELECT exists today)
-- --------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Owners can insert BUs') then
    create policy "Owners can insert BUs"
      on public.business_units for insert
      with check (
        company_id = public.get_my_company_id()
        and public.get_my_role() = 'owner'
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Owners can update BUs') then
    create policy "Owners can update BUs"
      on public.business_units for update
      using (
        company_id = public.get_my_company_id()
        and public.get_my_role() = 'owner'
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Owners can delete BUs') then
    create policy "Owners can delete BUs"
      on public.business_units for delete
      using (
        company_id = public.get_my_company_id()
        and public.get_my_role() = 'owner'
      );
  end if;
end $$;

-- --------------------------------------------------------
-- 8. Enable realtime for finance tables + business_units
-- --------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_records;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_uploads;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.business_units;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
