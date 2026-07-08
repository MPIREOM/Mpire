-- ============================================================
-- MPIRE EXPENSE SCOPE + INVOICE ATTACHMENTS MIGRATION
-- Adds:
--   * expenses.scope        — general | client_based | asset_purchase
--   * expenses.invoice_path — storage path of the attached invoice
--   * expenses.invoice_name — original file name (for display)
--   * recurring_expenses.scope — carried into generated expenses
--   * private storage bucket `expense-invoices` + RLS policies
-- Paste into Supabase SQL Editor & run
-- ============================================================

-- --------------------------------------------------------
-- 1. Expense scope (what kind of spend this is)
-- --------------------------------------------------------
alter table public.expenses
  add column if not exists scope text not null default 'general';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'expenses_scope_check'
  ) then
    alter table public.expenses
      add constraint expenses_scope_check
      check (scope in ('general', 'client_based', 'asset_purchase'));
  end if;
end $$;

-- Backfill: expenses already attributed to a client are client-based.
update public.expenses set scope = 'client_based'
  where client_id is not null and scope = 'general';

-- --------------------------------------------------------
-- 2. Invoice attachment columns
-- --------------------------------------------------------
alter table public.expenses
  add column if not exists invoice_path text,
  add column if not exists invoice_name text;

-- --------------------------------------------------------
-- 3. Recurring templates carry a scope too
-- --------------------------------------------------------
alter table public.recurring_expenses
  add column if not exists scope text not null default 'general';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'recurring_expenses_scope_check'
  ) then
    alter table public.recurring_expenses
      add constraint recurring_expenses_scope_check
      check (scope in ('general', 'client_based', 'asset_purchase'));
  end if;
end $$;

-- --------------------------------------------------------
-- 4. Private storage bucket for invoices (10 MB, pdf/images)
-- --------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-invoices',
  'expense-invoices',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- --------------------------------------------------------
-- 5. Storage RLS — paths are {company_id}/{uuid}/{filename}
-- --------------------------------------------------------
do $$ begin

  -- Read: anyone in the company who can see finance data
  if not exists (select 1 from pg_policies where policyname = 'expense_invoices_select') then
    create policy "expense_invoices_select"
      on storage.objects for select
      using (
        bucket_id = 'expense-invoices'
        and (storage.foldername(name))[1] = public.get_my_company_id()::text
        and public.get_my_role() in ('owner', 'manager', 'staff', 'investor')
      );
  end if;

  -- Upload: roles that can enter expenses
  if not exists (select 1 from pg_policies where policyname = 'expense_invoices_insert') then
    create policy "expense_invoices_insert"
      on storage.objects for insert
      with check (
        bucket_id = 'expense-invoices'
        and (storage.foldername(name))[1] = public.get_my_company_id()::text
        and public.get_my_role() in ('owner', 'manager', 'staff')
      );
  end if;

  -- Delete: finance managers, or the uploader themselves
  if not exists (select 1 from pg_policies where policyname = 'expense_invoices_delete') then
    create policy "expense_invoices_delete"
      on storage.objects for delete
      using (
        bucket_id = 'expense-invoices'
        and (storage.foldername(name))[1] = public.get_my_company_id()::text
        and (
          public.get_my_role() in ('owner', 'manager')
          or owner_id = auth.uid()::text
        )
      );
  end if;

end $$;
