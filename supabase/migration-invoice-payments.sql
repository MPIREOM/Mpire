-- ============================================================
-- MPIRE INVOICE PAYMENTS MIGRATION
-- Adds: invoice_payments table — a dated ledger of every payment
-- received against a client invoice (advances, partials, settlements).
-- The invoice keeps its paid_amount/paid_status aggregate in sync.
-- Paste into Supabase SQL Editor & run
-- ============================================================

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.client_invoices(id) on delete cascade,
  amount numeric(14,3) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice on public.invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_company on public.invoice_payments(company_id);
create index if not exists idx_invoice_payments_paid_on on public.invoice_payments(paid_on);

alter table public.invoice_payments enable row level security;

-- Mirrors client_invoices: owners/managers write, investors read too.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'invoice_payments_select') then
    create policy "invoice_payments_select"
      on public.invoice_payments for select
      using (
        company_id = public.get_my_company_id()
        and public.get_my_role() in ('owner', 'manager', 'investor')
      );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'invoice_payments_write') then
    create policy "invoice_payments_write"
      on public.invoice_payments for all
      using (
        company_id = public.get_my_company_id()
        and public.get_my_role() in ('owner', 'manager')
      )
      with check (
        company_id = public.get_my_company_id()
        and public.get_my_role() in ('owner', 'manager')
      );
  end if;
end $$;

-- Realtime updates in the tracker
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'invoice_payments'
  ) then
    alter publication supabase_realtime add table public.invoice_payments;
  end if;
end $$;

-- Backfill: one payment row per invoice that already has money collected,
-- dated with the invoice's paid_date (or its creation date as fallback).
insert into public.invoice_payments (company_id, invoice_id, amount, paid_on, created_by)
select i.company_id, i.id, i.paid_amount, coalesce(i.paid_date, i.created_at::date), i.created_by
from public.client_invoices i
where i.paid_amount > 0
  and not exists (select 1 from public.invoice_payments p where p.invoice_id = i.id);
