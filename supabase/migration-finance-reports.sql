-- ============================================================
-- MPIRE MONTHLY FINANCE REPORT MIGRATION
-- Adds: users.receives_finance_report flag (per-person opt-in)
-- Paste into Supabase SQL Editor & run
-- ============================================================

-- Per-person opt-in for the monthly WhatsApp finance report.
-- A user only receives the report if this is true AND phone_number is set.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'receives_finance_report'
  ) then
    alter table public.users
      add column receives_finance_report boolean not null default false;
  end if;
end $$;

-- Optional: index recipients for faster cron lookups.
create index if not exists idx_users_finance_report
  on public.users(company_id)
  where receives_finance_report = true;
