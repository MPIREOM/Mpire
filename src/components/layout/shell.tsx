'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { CommandPalette } from '@/components/command-palette';
import { LiveProvider } from '@/components/live/live-provider';

interface ShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Restore persisted preferences
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    const savedPinned = localStorage.getItem('sidebar-pinned');
    if (savedPinned === 'true') {
      setPinned(true);
      setCollapsed(false); // pinned means always expanded
    } else if (savedCollapsed === 'true') {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    if (pinned) return; // can't collapse when pinned
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, [pinned]);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-pinned', String(next));
      if (next) {
        // Pin: force expanded
        setCollapsed(false);
        localStorage.setItem('sidebar-collapsed', 'false');
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → open command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }

      // [ → toggle sidebar collapse (only outside inputs, and only if not pinned)
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
          return;
        e.preventDefault();
        toggleCollapse();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleCollapse]);

  return (
    <LiveProvider>
      <div className="min-h-screen bg-bg">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          pinned={pinned}
          onTogglePin={togglePin}
        />

        <div
          className={cn(
            'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'
          )}
        >
          <TopNav
            title={title}
            subtitle={subtitle}
            onMenuClick={() => setSidebarOpen(true)}
            onCommandPalette={() => setCommandOpen(true)}
          />
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.625, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </main>
        </div>

        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onToggleSidebar={toggleCollapse}
        />
      </div>
    </LiveProvider>
  );
}
