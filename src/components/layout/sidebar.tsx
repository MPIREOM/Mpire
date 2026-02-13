'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { canManage, canAccessFinance, canAccessSettings } from '@/lib/roles';
import { Avatar } from '@/components/ui/avatar';
import {
  ChevronLeftIcon,
  XMarkIcon,
  MapPinIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pinned: boolean;
  onTogglePin: () => void;
}

interface NavItem {
  name: string;
  emoji: string;
  href: string;
  requiresManage?: boolean;
  requiresFinance?: boolean;
  requiresSettings?: boolean;
  badge?: number;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', emoji: '📊', href: '/operations' },
  { name: 'Projects', emoji: '📁', href: '/projects', requiresManage: true },
  { name: 'Tasks', emoji: '✅', href: '/tasks' },
  { name: 'Timesheet', emoji: '🕐', href: '/timesheet' },
  { name: 'People', emoji: '👥', href: '/people', requiresManage: true },
  { name: 'Finance', emoji: '💰', href: '/finance', requiresFinance: true },
];

const bottomNavigation: NavItem[] = [
  { name: 'Settings', emoji: '⚙️', href: '/settings', requiresSettings: true },
];

export function Sidebar({ open, onClose, collapsed, onToggleCollapse, pinned, onTogglePin }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const role = user?.role ?? 'staff';

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  function canAccess(item: NavItem) {
    if (item.requiresManage && !canManage(role)) return false;
    if (item.requiresFinance && !canAccessFinance(role)) return false;
    if (item.requiresSettings && !canAccessSettings(role)) return false;
    return true;
  }

  const filteredNav = navigation.filter(canAccess);
  const filteredBottom = bottomNavigation.filter(canAccess);

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
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'sidebar-dark fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-gradient-to-b from-gray-900 to-gray-950 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          collapsed ? 'lg:w-[72px]' : 'lg:w-60',
          'w-60 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Brand ── */}
        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-3">
          <Link
            href="/operations"
            className="flex items-center gap-2.5 overflow-hidden"
            onClick={onClose}
          >
            <motion.div
              whileHover={{ scale: 1.08, rotate: -3 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-xl shadow-lg shadow-blue-500/20"
            >
              🎯
            </motion.div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap text-[16px] font-bold tracking-wider text-white"
                >
                  MPIRE
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 transition-all hover:bg-white/5 hover:text-gray-300 active:scale-90 lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* ── Main navigation ── */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <div className="space-y-1">
            {filteredNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/operations' && pathname === '/') ||
                (item.href === '/projects' && pathname.startsWith('/projects/'));

              return (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  collapsed={collapsed}
                  onClick={onClose}
                />
              );
            })}
          </div>
        </nav>

        {/* ── Bottom navigation (Settings) ── */}
        <div className="border-t border-white/[0.06] px-2 py-2 space-y-1">
          {filteredBottom.map((item) => {
            const isActive = pathname === item.href;
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
                onClick={onClose}
              />
            );
          })}

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'group relative flex items-center rounded-xl pl-2 py-2.5 text-[13px] font-medium text-gray-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-red-400 active:scale-[0.97]',
              !collapsed && 'gap-2'
            )}
          >
            <span className="flex w-10 shrink-0 items-center justify-center">
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </span>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap"
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <div className="pointer-events-none absolute left-full z-[60] ml-3 hidden rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg group-hover:block">
                Sign out
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-800" />
              </div>
            )}
          </button>

          {/* Pin + Collapse — desktop only */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Pin toggle */}
            <motion.button
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onTogglePin}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              className={cn(
                'flex items-center justify-center rounded-xl p-2.5 text-[12px] transition-colors',
                pinned
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <motion.div animate={{ rotate: pinned ? 0 : 45 }} transition={{ duration: 0.2 }}>
                <MapPinIcon className="h-4 w-4" />
              </motion.div>
            </motion.button>

            {/* Collapse toggle */}
            {!pinned && (
              <motion.button
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                whileTap={{ scale: 0.97 }}
                onClick={onToggleCollapse}
                className={cn(
                  'flex flex-1 items-center rounded-xl px-3 py-2.5 text-[12px] font-medium text-gray-500 transition-colors hover:text-gray-300',
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
                      <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                        [
                      </kbd>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            {/* Pinned label */}
            <AnimatePresence>
              {pinned && !collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="text-[11px] font-medium text-blue-400"
                >
                  Pinned
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── User footer ── */}
        <div className="border-t border-white/[0.06] p-2">
          {user && (
            <motion.div
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              className={cn(
                'group relative flex items-center rounded-xl px-2 py-2.5 transition-colors cursor-default',
                collapsed ? 'justify-center' : 'gap-2.5'
              )}
            >
              <div className="relative shrink-0">
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-emerald-400" />
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
                    <p className="truncate text-[13px] font-semibold text-white">
                      {user.full_name}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {user.role}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Tooltip for collapsed user */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full z-[60] ml-3 hidden rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg group-hover:block">
                  {user.full_name}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-800" />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ── Nav link with emoji, active state, tooltip ── */
function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center rounded-xl pl-2 py-2.5 text-[13px] font-medium transition-all duration-200 active:scale-[0.97]',
        !collapsed && 'gap-2',
        isActive
          ? 'bg-gradient-to-r from-blue-600/90 to-purple-600/90 text-white shadow-lg shadow-blue-500/20'
          : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <motion.span
          layoutId="sidebarIndicator"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      {/* Emoji icon — fixed-width slot so it stays pinned when collapsing */}
      <motion.span
        whileHover={{ scale: 1.15 }}
        transition={{ duration: 0.15 }}
        className="relative flex w-10 shrink-0 items-center justify-center text-[22px] leading-none"
      >
        {item.emoji}
        {/* Notification badge */}
        {item.badge != null && item.badge > 0 && (
          <span className="absolute -top-1.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </motion.span>

      {/* Label */}
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

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full z-[60] ml-3 hidden rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg group-hover:block">
          {item.name}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-800" />
        </div>
      )}
    </Link>
  );
}
