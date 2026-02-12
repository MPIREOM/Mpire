'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { canManage, canAccessFinance, canAccessSettings } from '@/lib/roles';
import { Avatar } from '@/components/ui/avatar';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  FolderIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  section: string;
  requiresManage?: boolean;
  requiresFinance?: boolean;
  requiresSettings?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/operations', icon: ChartBarIcon, section: 'Main' },
  { name: 'Projects', href: '/projects', icon: FolderIcon, section: 'Main', requiresManage: true },
  { name: 'Finance', href: '/finance', icon: CurrencyDollarIcon, section: 'Main', requiresFinance: true },
  { name: 'People', href: '/people', icon: UsersIcon, section: 'Team', requiresManage: true },
  { name: 'Time Tracking', href: '/people/time', icon: ClockIcon, section: 'Team', requiresManage: true },
  { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentListIcon, section: 'Work' },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, section: 'System', requiresSettings: true },
];

const navListVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const navItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
  },
};

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const role = user?.role ?? 'staff';

  const filteredNav = navigation.filter((item) => {
    if (item.requiresManage && !canManage(role)) return false;
    if (item.requiresFinance && !canAccessFinance(role)) return false;
    if (item.requiresSettings && !canAccessSettings(role)) return false;
    return true;
  });

  const sections = [...new Set(filteredNav.map((i) => i.section))];

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
          'w-60 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <Link
            href="/operations"
            className="flex items-center gap-2.5 overflow-hidden"
            onClick={onClose}
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-light text-[12px] font-extrabold text-white shadow-sm"
            >
              M
            </motion.div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap text-[15px] font-bold tracking-wider text-text"
                >
                  MPIRE
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-bg hover:text-text lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <motion.div variants={navListVariants} initial="hidden" animate="visible">
            {sections.map((section) => (
              <div key={section} className="mb-4">
                <AnimatePresence mode="wait">
                  {!collapsed ? (
                    <motion.p
                      key="label"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mb-2 overflow-hidden px-3 text-[10px] font-semibold uppercase tracking-widest text-muted"
                    >
                      {section}
                    </motion.p>
                  ) : (
                    <div className="mx-auto mb-2 h-px w-6 bg-border" />
                  )}
                </AnimatePresence>
                {filteredNav
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href === '/operations' && pathname === '/') ||
                      (item.href === '/projects' && pathname.startsWith('/projects/'));

                    return (
                      <motion.div key={item.name} variants={navItemVariants}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'group relative mb-0.5 flex items-center rounded-lg text-[13px] font-medium transition-all duration-200',
                            collapsed
                              ? 'justify-center px-2 py-2.5'
                              : 'gap-2.5 px-3 py-2',
                            isActive
                              ? 'bg-accent-muted text-accent'
                              : 'text-muted hover:bg-bg hover:text-text'
                          )}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="sidebarIndicator"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent"
                              transition={{
                                type: 'spring',
                                stiffness: 350,
                                damping: 30,
                              }}
                            />
                          )}
                          <motion.div
                            whileHover={{ scale: 1.15 }}
                            transition={{ duration: 0.15 }}
                            className="relative"
                          >
                            <item.icon className="h-[18px] w-[18px] shrink-0" />
                          </motion.div>
                          <AnimatePresence mode="wait">
                            {!collapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                className="whitespace-nowrap"
                              >
                                {item.name}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {/* Tooltip for collapsed mode */}
                          {collapsed && (
                            <div className="pointer-events-none absolute left-full z-[60] ml-3 hidden rounded-lg bg-text px-2.5 py-1.5 text-[11px] font-semibold text-card shadow-lg group-hover:block">
                              {item.name}
                              <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-text" />
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
              </div>
            ))}
          </motion.div>
        </nav>

        {/* Collapse toggle — desktop only */}
        <div className="hidden border-t border-border px-2 py-2 lg:block">
          <motion.button
            whileHover={{ backgroundColor: 'var(--color-bg)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onToggleCollapse}
            className={cn(
              'flex w-full items-center rounded-lg px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:text-text',
              collapsed ? 'justify-center' : 'gap-2.5'
            )}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </motion.div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-1 items-center justify-between"
                >
                  <span>Collapse</span>
                  <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[9px] font-medium text-muted">
                    [
                  </kbd>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Footer — user info */}
        <div className="border-t border-border p-2">
          {user && (
            <motion.div
              whileHover={{ backgroundColor: 'var(--color-bg)' }}
              className={cn(
                'flex items-center rounded-lg px-2 py-2.5 transition-colors',
                collapsed ? 'justify-center' : 'gap-2.5'
              )}
            >
              <div className="relative shrink-0">
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-green" />
              </div>
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="min-w-0 overflow-hidden"
                  >
                    <p className="truncate text-[13px] font-semibold text-text">
                      {user.full_name}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {user.role}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Tooltip for collapsed user */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full z-[60] ml-3 hidden rounded-lg bg-text px-2.5 py-1.5 text-[11px] font-semibold text-card shadow-lg group-hover:block">
                  {user.full_name}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </aside>
    </>
  );
}
