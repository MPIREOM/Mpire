-- ============================================================
-- MPIRE - Live Presence & Session Tracking Migration
-- ============================================================

-- 1. User Sessions - tracks each time a user enters the app
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  page text -- current page the user is on
);
create index idx_user_sessions_user on public.user_sessions(user_id);
create index idx_user_sessions_last_seen on public.user_sessions(last_seen_at);

-- RLS
alter table public.user_sessions enable row level security;

create policy "Users can read company sessions"
  on public.user_sessions for select
  using (
    exists (
      select 1 from public.users u
      where u.id = user_sessions.user_id
        and u.company_id = public.get_my_company_id()
    )
  );

create policy "Users can insert own sessions"
  on public.user_sessions for insert
  with check (user_id = auth.uid());

create policy "Users can update own sessions"
  on public.user_sessions for update
  using (user_id = auth.uid());

create policy "Users can delete own sessions"
  on public.user_sessions for delete
  using (user_id = auth.uid());

-- 2. Add last_seen_at to users table for quick presence check
alter table public.users add column if not exists last_seen_at timestamptz;

-- 3. Enable realtime for user_sessions (projects already added in schema.sql)
-- Use IF NOT EXISTS pattern via DO block to avoid duplicate errors
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
