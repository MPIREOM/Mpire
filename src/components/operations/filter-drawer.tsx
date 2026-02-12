'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
        active
          ? 'border-accent bg-accent-muted text-accent shadow-sm'
          : 'border-border text-muted hover:border-border-hover hover:text-text'
      )}
    >
      {label}
    </motion.button>
  );
}

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

  const activeCount = Object.values(local).filter(Boolean).length;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel className="w-screen max-w-xs sm:max-w-sm">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="flex h-full flex-col border-l border-border bg-card shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-accent-muted p-1.5">
                  <FunnelIcon className="h-4 w-4 text-accent" />
                </div>
                <DialogTitle className="text-[15px] font-bold text-text">
                  Filters
                </DialogTitle>
                {activeCount > 0 && (
                  <Badge variant="accent">{activeCount}</Badge>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* Due Date */}
              <fieldset>
                <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Due Date
                </legend>
                <div className="flex flex-wrap gap-2">
                  {dueOptions.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={local.dueRange === opt.value}
                      onClick={() => handleSelect('dueRange', opt.value)}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Status */}
              <fieldset>
                <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Status
                </legend>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={local.status === opt.value}
                      onClick={() => handleSelect('status', opt.value)}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Priority */}
              <fieldset>
                <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Priority
                </legend>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map((opt) => (
                    <FilterChip
                      key={opt.value}
                      label={opt.label}
                      active={local.priority === opt.value}
                      onClick={() => handleSelect('priority', opt.value)}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Project */}
              <fieldset>
                <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Project
                </legend>
                <div className="flex flex-wrap gap-2">
                  {projects.map((p) => (
                    <FilterChip
                      key={p.id}
                      label={p.name}
                      active={local.projectId === p.id}
                      onClick={() => handleSelect('projectId', p.id)}
                    />
                  ))}
                </div>
              </fieldset>

              {/* Assignee */}
              {team.length > 0 && (
                <fieldset>
                  <legend className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Assignee
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {team.map((u) => (
                      <FilterChip
                        key={u.id}
                        label={u.full_name}
                        active={local.assigneeId === u.id}
                        onClick={() => handleSelect('assigneeId', u.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-border p-4">
              <Button variant="outline" className="flex-1" onClick={onClear}>
                Clear All
              </Button>
              <Button className="flex-1" onClick={() => onApply(local)}>
                Apply Filters
              </Button>
            </div>
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
