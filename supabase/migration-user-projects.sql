-- Add allowed_project_ids column to users table
-- NULL means the user can see all projects (default)
-- When set, the user can only see the listed projects
alter table public.users
  add column if not exists allowed_project_ids uuid[] default null;

-- Allow owners to update any user in the same company
create policy "Owners can update company users"
  on public.users for update
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'owner'
  )
  with check (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'owner'
  );
