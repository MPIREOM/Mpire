import type { Role } from '@/types/database';

export function canManage(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

export function isOwner(role: Role): boolean {
  return role === 'owner';
}

export function canViewAllTasks(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

export function canAssignTasks(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

export function canCreateTasks(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

export function canDeleteTasks(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

// Delete projects — owner (the top-level admin role) and managers.
export function canDeleteProjects(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

// Finance: everyone can reach the tab, but views differ by role.
export function canAccessFinance(role: Role): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff' || role === 'investor';
}

// Full finance control: revenue, clients, payments, fixed expenses (salaries), dashboard.
export function canManageFinance(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

// Read the financial dashboard (aggregate P&L). Investors get read-only.
export function canViewFinanceDashboard(role: Role): boolean {
  return role === 'owner' || role === 'manager' || role === 'investor';
}

// Add operational expenses (models, editors, space rental, ...).
export function canEnterExpenses(role: Role): boolean {
  return role === 'owner' || role === 'manager' || role === 'staff';
}

// View fixed expenses / salaries — owner & managers only.
export function canViewFixedExpenses(role: Role): boolean {
  return role === 'owner' || role === 'manager';
}

export function canAccessSettings(role: Role): boolean {
  return role === 'owner';
}

export function isCEOView(role: Role): boolean {
  return role === 'owner' || role === 'investor';
}
