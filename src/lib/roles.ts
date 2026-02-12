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

export function canAccessFinance(role: Role): boolean {
  return role === 'owner' || role === 'investor';
}

export function canAccessSettings(role: Role): boolean {
  return role === 'owner';
}
