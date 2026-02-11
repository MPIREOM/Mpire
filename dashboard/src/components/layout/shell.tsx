'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';

interface ShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Shell({ title, subtitle, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-60">
        <TopNav
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
