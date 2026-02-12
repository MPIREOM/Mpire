'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { CommandPalette } from '@/components/command-palette';

interface ShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-60">
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
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
