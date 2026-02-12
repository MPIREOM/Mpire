export type Role = 'owner' | 'manager' | 'staff' | 'investor';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface BusinessUnit {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  company_id: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  name: string;
  status: ProjectStatus;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string | null;
  recurring_rule: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: Project;
  assignee?: User;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user?: User;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  user?: User;
}

// KPI types
export interface OperationsKPI {
  dueToday: number;
  overdue: number;
  inProgress: number;
  completionRate: number;
  completionPeriodDays: number;
}

export interface ProjectHealth {
  project: Project;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  progressPercent: number;
  healthStatus: 'green' | 'yellow' | 'red';
}
