'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogPanel } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  ChartBarIcon,
  FolderIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UsersIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href?: string;
  section: string;
}

const commands: CommandItem[] = [
  { id: 'overview', label: 'Go to Overview', icon: ChartBarIcon, href: '/operations', section: 'Navigation' },
  { id: 'projects', label: 'Go to Projects', icon: FolderIcon, href: '/projects', section: 'Navigation' },
  { id: 'tasks', label: 'Go to Tasks', icon: ClipboardDocumentListIcon, href: '/tasks', section: 'Navigation' },
  { id: 'finance', label: 'Go to Finance', icon: CurrencyDollarIcon, href: '/finance', section: 'Navigation' },
  { id: 'people', label: 'Go to People', icon: UsersIcon, href: '/people', section: 'Navigation' },
  { id: 'settings', label: 'Go to Settings', icon: Cog6ToothIcon, href: '/settings', section: 'Navigation' },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query]);

  const sections = [...new Set(filtered.map((c) => c.section))];

  function handleSelect(item: CommandItem) {
    if (item.href) {
      router.push(item.href);
    }
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[60]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[20vh]">
        <DialogPanel className="w-full max-w-lg">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent py-3.5 text-[14px] text-text placeholder:text-muted/50 focus:outline-none"
                autoFocus
              />
              <kbd className="hidden rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-muted">
                  No results found
                </div>
              ) : (
                sections.map((section) => (
                  <div key={section}>
                    <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {section}
                    </p>
                    {filtered
                      .filter((c) => c.section === section)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-text transition-colors hover:bg-bg"
                        >
                          <item.icon className="h-4 w-4 text-muted" />
                          {item.label}
                        </button>
                      ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
