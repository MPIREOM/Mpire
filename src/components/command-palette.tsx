'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogPanel } from '@headlessui/react';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3BottomLeftIcon,
  PlusIcon,
  ArrowPathIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleSidebar?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  action?: () => void;
  section: string;
  shortcut?: string;
}

export function CommandPalette({ open, onClose, onToggleSidebar }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      { id: 'overview', label: 'Go to Overview', icon: ChartBarIcon, href: '/operations', section: 'Navigation' },
      { id: 'projects', label: 'Go to Projects', icon: FolderIcon, href: '/projects', section: 'Navigation' },
      { id: 'tasks', label: 'Go to Tasks', icon: ClipboardDocumentListIcon, href: '/tasks', section: 'Navigation' },
      { id: 'finance', label: 'Go to Finance', icon: CurrencyDollarIcon, href: '/finance', section: 'Navigation' },
      { id: 'people', label: 'Go to People', icon: UsersIcon, href: '/people', section: 'Navigation' },
      { id: 'settings', label: 'Go to Settings', icon: Cog6ToothIcon, href: '/settings', section: 'Navigation' },
      // Actions
      {
        id: 'new-task',
        label: 'Create New Task',
        icon: PlusIcon,
        href: '/tasks?new=true',
        section: 'Actions',
      },
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        icon: Bars3BottomLeftIcon,
        action: onToggleSidebar,
        section: 'Actions',
        shortcut: '[',
      },
      {
        id: 'reload',
        label: 'Reload Page',
        icon: ArrowPathIcon,
        action: () => window.location.reload(),
        section: 'Actions',
      },
      {
        id: 'sign-out',
        label: 'Sign Out',
        icon: ArrowRightOnRectangleIcon,
        action: async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push('/login');
        },
        section: 'Actions',
      },
    ],
    [onToggleSidebar, router]
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        c.id.includes(q)
    );
  }, [query, commands]);

  const sections = useMemo(() => [...new Set(filtered.map((c) => c.section))], [filtered]);

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
      onClose();
    },
    [router, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % filtered.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[activeIndex]) {
            handleSelect(filtered[activeIndex]);
          }
          break;
      }
    },
    [filtered, activeIndex, handleSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  // Track flat index across sections
  let flatIndex = -1;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[18vh]">
        <DialogPanel className="w-full max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent py-3.5 text-[14px] text-text placeholder:text-muted/50 focus:outline-none"
                autoFocus
              />
              <kbd className="hidden rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
              <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-col items-center gap-2 py-10"
                  >
                    <HashtagIcon className="h-8 w-8 text-muted/30" />
                    <p className="text-[13px] text-muted">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[11px] text-muted/60">
                      Try a different search term
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {sections.map((section) => (
                      <div key={section} className="mb-1">
                        <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
                          {section}
                        </p>
                        {filtered
                          .filter((c) => c.section === section)
                          .map((item) => {
                            flatIndex++;
                            const isActive = flatIndex === activeIndex;
                            const itemIndex = flatIndex;

                            return (
                              <button
                                key={item.id}
                                data-active={isActive}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setActiveIndex(itemIndex)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                                  isActive
                                    ? 'bg-accent-muted text-accent'
                                    : 'text-text hover:bg-bg'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    'h-4 w-4 shrink-0',
                                    isActive ? 'text-accent' : 'text-muted'
                                  )}
                                />
                                <span className="flex-1">{item.label}</span>
                                {item.shortcut && (
                                  <kbd
                                    className={cn(
                                      'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                                      isActive
                                        ? 'border-accent/30 bg-accent/10 text-accent'
                                        : 'border-border bg-bg text-muted'
                                    )}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer — keyboard hints */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-medium">
                  &uarr;
                </kbd>
                <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-medium">
                  &darr;
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-medium">
                  &crarr;
                </kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-medium">
                  esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
