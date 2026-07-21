-- Project scheduling: assign a project to a month or a period of time.
-- start_date / end_date are nullable — projects without dates are "unscheduled".
-- A project with a start date but no end date is treated as ongoing (open-ended).
alter table public.projects
  add column if not exists start_date date default null,
  add column if not exists end_date date default null;

create index if not exists idx_projects_schedule on public.projects(start_date, end_date);
