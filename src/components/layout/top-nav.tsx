'use client';

import { Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TopNavProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function TopNav({ title, subtitle, onMenuClick }: TopNavProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-text lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-[15px] font-bold text-text">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-red-bg hover:text-red"
          title="Sign out"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
