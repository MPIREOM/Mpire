# MPIRE Command Center

Production-grade operations dashboard built with Next.js, TypeScript, TailwindCSS, Headless UI, and Supabase.

## Architecture

```
dashboard/
├── supabase/
│   ├── schema.sql          # Full database schema + RLS policies
│   └── seed.sql            # Sample data (3 users, 3 projects, 15+ tasks)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Redirect to /operations
│   │   ├── (auth)/login/page.tsx  # Login page
│   │   └── (dashboard)/
│   │       ├── layout.tsx         # Dashboard route group
│   │       ├── operations/page.tsx # Main operations page
│   │       ├── projects/page.tsx
│   │       ├── finance/page.tsx
│   │       ├── people/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── shell.tsx          # TopNav + Sidebar + Main shell
│   │   │   ├── sidebar.tsx        # Collapsible sidebar with role gating
│   │   │   └── top-nav.tsx        # Slim top navigation bar
│   │   └── operations/
│   │       ├── kpi-cards.tsx      # 4 KPI metric cards
│   │       ├── critical-focus.tsx # Overdue/urgent alert panel
│   │       ├── project-health.tsx # 2-column project health grid
│   │       ├── task-list.tsx      # Tabbed task list with search
│   │       ├── task-item.tsx      # Individual task row
│   │       ├── filter-drawer.tsx  # Right-side filter drawer (Headless UI)
│   │       └── task-detail-drawer.tsx # Task detail with comments/activity
│   ├── hooks/
│   │   ├── use-user.ts           # Current user + profile
│   │   ├── use-tasks.ts          # Tasks with realtime subscriptions
│   │   ├── use-projects.ts       # Projects list
│   │   └── use-team.ts           # Team members
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser Supabase client
│   │   │   ├── server.ts         # Server Supabase client
│   │   │   └── middleware.ts     # Auth session middleware
│   │   ├── roles.ts              # Role permission helpers
│   │   └── dates.ts              # Date formatting utilities
│   ├── types/
│   │   └── database.ts           # Full TypeScript types
│   └── middleware.ts              # Next.js auth middleware
```

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor
3. Create 3 auth users in Authentication > Users:
   - `almuhannad@mpire.com` / `Owner2024!`
   - `fajar@mpire.com` / `Manager2024!`
   - `harith@mpire.com` / `Staff2024!`
4. Copy the auth user UUIDs and update `supabase/seed.sql`
5. Run `supabase/seed.sql` in the SQL editor

### 2. Environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and anon key
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Roles

| Role | Sidebar | Tasks | Assign | Finance | Settings |
|------|---------|-------|--------|---------|----------|
| Owner | Full | All | Yes | Yes | Yes |
| Manager | Most | All | Yes | No | No |
| Staff | Limited | My Tasks | No | No | No |
| Investor | Finance | No | No | Yes | No |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: TailwindCSS v4
- **UI Components**: Headless UI (Dialog/Drawer)
- **Icons**: Heroicons
- **Data Fetching**: SWR (stale-while-revalidate)
- **Backend**: Supabase (Auth + Postgres + Realtime + RLS)
- **Dates**: date-fns
