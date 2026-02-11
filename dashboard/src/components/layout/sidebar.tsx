'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useUser } from '@/hooks/use-user';
import { canManage, canAccessFinance, canAccessSettings } from '@/lib/roles';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UsersIcon,
  ClockIcon,
  FolderIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
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
  { name: 'Tasks', href: '/operations?view=tasks', icon: ClipboardDocumentListIcon, section: 'Work' },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, section: 'System', requiresSettings: true },
];

export function Sidebar({ open, onClose }: SidebarProps) {
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
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-card transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <Link href="/operations" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-light text-[11px] font-extrabold text-white">
              M
            </div>
            <span className="text-[15px] font-bold tracking-wider text-text">
              MPIRE
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-bg hover:text-text lg:hidden"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                {section}
              </p>
              {filteredNav
                .filter((item) => item.section === section)
                .map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === '/operations' && pathname === '/');

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={clsx(
                        'group relative mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-accent-muted text-accent'
                          : 'text-muted hover:bg-bg hover:text-text'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />
                      )}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Footer — user info */}
        <div className="border-t border-border p-3">
          {user && (
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-white">
                {user.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-text">
                  {user.full_name}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {user.role}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
