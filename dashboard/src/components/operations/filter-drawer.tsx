'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Project, User, TaskStatus, TaskPriority } from '@/types/database';

export interface FilterState {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeId?: string;
  dueRange?: 'today' | 'tomorrow' | 'week' | 'custom';
}

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
  projects: Project[];
  team: User[];
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
];

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const dueOptions = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This Week' },
];

export function FilterDrawer({
  open,
  onClose,
  filters,
  onApply,
  onClear,
  projects,
  team,
}: FilterDrawerProps) {
  const [local, setLocal] = useState<FilterState>(filters);

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  function handleSelect(key: keyof FilterState, value: string) {
    setLocal((prev) => ({
      ...prev,
      [key]: prev[key] === value ? undefined : value,
    }));
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />

      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel className="w-screen max-w-xs transform border-l border-border bg-card shadow-lg transition-transform sm:max-w-sm">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <DialogTitle className="text-[15px] font-bold text-text">
                Filters
              </DialogTitle>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* Due Date */}
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Due Date
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {dueOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleSelect('dueRange', opt.value)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        local.dueRange === opt.value
                          ? 'border-accent bg-accent-muted text-accent'
                          : 'border-border text-muted hover:border-border-hover hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Status */}
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Status
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleSelect('status', opt.value)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        local.status === opt.value
                          ? 'border-accent bg-accent-muted text-accent'
                          : 'border-border text-muted hover:border-border-hover hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Priority */}
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Priority
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {priorityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        handleSelect('priority', opt.value)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        local.priority === opt.value
                          ? 'border-accent bg-accent-muted text-accent'
                          : 'border-border text-muted hover:border-border-hover hover:text-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Project */}
              <fieldset>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Project
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        handleSelect('projectId', p.id)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        local.projectId === p.id
                          ? 'border-accent bg-accent-muted text-accent'
                          : 'border-border text-muted hover:border-border-hover hover:text-text'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Assignee (manager/owner only) */}
              {team.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Assignee
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {team.map((u) => (
                      <button
                        key={u.id}
                        onClick={() =>
                          handleSelect('assigneeId', u.id)
                        }
                        className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          local.assigneeId === u.id
                            ? 'border-accent bg-accent-muted text-accent'
                            : 'border-border text-muted hover:border-border-hover hover:text-text'
                        }`}
                      >
                        {u.full_name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 border-t border-border p-4">
              <button
                onClick={onClear}
                className="flex-1 rounded-xl border border-border px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
              >
                Clear
              </button>
              <button
                onClick={() => onApply(local)}
                className="flex-1 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-light"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
