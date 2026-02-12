'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface TopNavProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  onCommandPalette?: () => void;
}

export function TopNav({ title, subtitle, onMenuClick, onCommandPalette }: TopNavProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur-xl transition-all duration-300 lg:px-6',
        scrolled ? 'border-border shadow-sm' : 'border-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-text lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-[15px] font-bold text-text">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-muted">{subtitle}</p>
          )}
        </motion.div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Command palette trigger */}
        {onCommandPalette && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCommandPalette}
            className="hidden items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-[12px] text-muted transition-all hover:border-border-hover hover:text-text sm:flex"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
              &#x2318;K
            </kbd>
          </motion.button>
        )}

        {/* Notifications bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted hover:text-text"
        >
          <BellIcon className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </Button>

        {/* Divider */}
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-muted hover:text-red"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
