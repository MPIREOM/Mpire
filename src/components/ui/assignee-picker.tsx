'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { User } from '@/types/database';

interface AssigneePickerProps {
  team: User[];
  selected: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function AssigneePicker({
  team,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Assign people...',
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = search
    ? team.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()))
    : team;

  function toggle(userId: string) {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId));
    } else {
      onChange([...selected, userId]);
    }
  }

  function remove(userId: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selected.filter((id) => id !== userId));
  }

  const selectedUsers = selected
    .map((id) => team.find((u) => u.id === id))
    .filter((u): u is User => !!u);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-left text-sm transition-colors',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-muted/60">{placeholder}</span>
        ) : (
          selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 rounded-md bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent"
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
                style={{ backgroundColor: avatarColor(u.full_name) }}
              >
                {u.full_name.charAt(0)}
              </span>
              {u.full_name.split(' ')[0]}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => remove(u.id, e)}
                  className="ml-0.5 rounded p-0.5 hover:bg-accent/10"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))
        )}
        <ChevronUpDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card shadow-lg">
          {/* Search */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team..."
              autoFocus
              className="w-full rounded-md border-0 bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-muted"
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-center text-xs text-muted">No team members found</p>
            )}
            {filtered.map((u) => {
              const isSelected = selected.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-accent-muted text-accent'
                      : 'text-text hover:bg-bg'
                  )}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: avatarColor(u.full_name) }}
                  >
                    {u.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.full_name}</p>
                    <p className="truncate text-xs text-muted">{u.role}</p>
                  </div>
                  {isSelected && (
                    <CheckIcon className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact avatar stack for displaying multiple assignees */
export function AvatarStack({
  users,
  max = 3,
  size = 'sm',
}: {
  users: User[];
  max?: number;
  size?: 'xs' | 'sm';
}) {
  if (users.length === 0) return <span className="text-xs text-muted/50">—</span>;

  const shown = users.slice(0, max);
  const overflow = users.length - max;
  const sizeClass = size === 'xs' ? 'h-5 w-5 text-[8px]' : 'h-6 w-6 text-[9px]';
  const offset = size === 'xs' ? '-ml-1.5' : '-ml-2';

  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <span
          key={u.id}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md border-2 border-card font-bold text-white',
            sizeClass,
            i > 0 && offset
          )}
          style={{ backgroundColor: avatarColor(u.full_name) }}
          title={u.full_name}
        >
          {u.full_name.charAt(0)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md border-2 border-card bg-muted font-bold text-white',
            sizeClass,
            offset
          )}
          title={users.slice(max).map((u) => u.full_name).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
