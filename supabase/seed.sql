-- ============================================================
-- MPIRE Seed Data
-- ============================================================
-- Run AFTER schema.sql and after creating auth users in Supabase.
-- Replace the UUIDs below with the actual auth.users IDs
-- created via Supabase Auth (Dashboard > Authentication > Users).
--
-- Sample credentials to create in Supabase Auth:
--   almuhannad@mpireom.com  / Owner2024!
--   fajar@mpireom.com       / Manager2024!
--   harith@mpireom.com      / Staff2024!
-- ============================================================

-- Placeholder UUIDs — replace with real auth.users IDs
-- You can also run the companion seed.ts script which automates this.

do $$
declare
  v_company_id uuid;
  v_bu_ops uuid;
  v_bu_dev uuid;
  v_owner_id uuid := '00000000-0000-0000-0000-000000000001'; -- replace
  v_manager_id uuid := '00000000-0000-0000-0000-000000000002'; -- replace
  v_staff_id uuid := '00000000-0000-0000-0000-000000000003'; -- replace
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
  (v_owner_id, 'almuhannad@mpireom.com', 'Al Muhannad', 'owner', v_company_id),
  (v_manager_id, 'fajar@mpireom.com', 'Fajar', 'manager', v_company_id),
  (v_staff_id, 'harith@mpireom.com', 'Harith', 'staff', v_company_id);

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
  (v_proj_website, 'Design landing page mockups', 'Create high-fidelity mockups for the new landing page', 'in_progress', 'high', current_date, v_staff_id, v_manager_id),
  (v_proj_website, 'Implement auth flow', 'Set up Supabase Auth with email/password and OAuth', 'todo', 'high', current_date + 1, v_staff_id, v_manager_id),
  (v_proj_website, 'Write API documentation', 'Document all REST endpoints', 'todo', 'medium', current_date + 3, v_manager_id, v_owner_id),
  (v_proj_website, 'Set up CI/CD pipeline', 'GitHub Actions for staging and production', 'done', 'medium', current_date - 2, v_staff_id, v_manager_id),
  (v_proj_website, 'Optimize page load speed', 'Target LCP under 2.5s', 'todo', 'low', current_date + 7, v_staff_id, v_manager_id),
  (v_proj_website, 'Fix mobile nav bug', 'Hamburger menu not closing on route change', 'todo', 'high', current_date - 1, v_staff_id, v_manager_id);

-- Tasks — Mobile App
insert into public.tasks (project_id, title, description, status, priority, due_date, assignee_id, created_by) values
  (v_proj_mobile, 'Set up React Native project', 'Initialize with Expo and configure TypeScript', 'done', 'high', current_date - 5, v_staff_id, v_manager_id),
  (v_proj_mobile, 'Build onboarding screens', 'Three-step onboarding with illustrations', 'in_progress', 'medium', current_date + 2, v_staff_id, v_manager_id),
  (v_proj_mobile, 'Integrate push notifications', 'Firebase Cloud Messaging setup', 'todo', 'medium', current_date + 5, v_manager_id, v_owner_id),
  (v_proj_mobile, 'Design app icon and splash', 'Final assets for App Store and Play Store', 'todo', 'low', current_date + 10, v_staff_id, v_manager_id);

-- Tasks — Daily Operations
insert into public.tasks (project_id, title, description, status, priority, due_date, assignee_id, created_by) values
  (v_proj_ops, 'Review weekly financials', 'Check P&L and cash position', 'todo', 'high', current_date, v_owner_id, v_owner_id),
  (v_proj_ops, 'Team standup prep', 'Prepare agenda for Monday standup', 'todo', 'medium', current_date, v_manager_id, v_manager_id),
  (v_proj_ops, 'Client follow-up emails', 'Send project updates to 3 clients', 'in_progress', 'high', current_date - 1, v_manager_id, v_owner_id),
  (v_proj_ops, 'Update project timeline', 'Reflect new deadlines in Gantt chart', 'todo', 'medium', current_date + 1, v_manager_id, v_owner_id),
  (v_proj_ops, 'Office supplies order', 'Restock printer paper and toner', 'done', 'low', current_date - 3, v_staff_id, v_manager_id);

end $$;
