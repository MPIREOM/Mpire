'use client';

import { useMemo, useState } from 'react';
import { Shell } from '@/components/layout/shell';
import { useUser } from '@/hooks/use-user';
import {
  canAccessFinance,
  canViewFinanceDashboard,
  canManageFinance,
  canEnterExpenses,
} from '@/lib/roles';
import { cn } from '@/lib/utils';
import {
  ChartPieIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { FinanceDashboard } from '@/components/finance/finance-dashboard';
import { MonthlyTracker } from '@/components/finance/monthly-tracker';
import { ExpenseEntry } from '@/components/finance/expense-entry';
import { ClientsManager } from '@/components/finance/clients-manager';

type TabKey = 'dashboard' | 'monthly' | 'expenses' | 'clients';

export default function FinancePage() {
  const { user } = useUser();

  const tabs = useMemo(() => {
    if (!user) return [];
    const list: { key: TabKey; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [];
    if (canViewFinanceDashboard(user.role)) list.push({ key: 'dashboard', label: 'Dashboard', icon: ChartPieIcon });
    if (canManageFinance(user.role)) list.push({ key: 'monthly', label: 'Monthly Tracker', icon: CalendarDaysIcon });
    if (canEnterExpenses(user.role)) list.push({ key: 'expenses', label: 'Expenses', icon: BanknotesIcon });
    if (canManageFinance(user.role)) list.push({ key: 'clients', label: 'Clients', icon: UserGroupIcon });
    return list;
  }, [user]);

  const [tab, setTab] = useState<TabKey | null>(null);
  const active = tab ?? tabs[0]?.key ?? null;

  if (!user) {
    return (
      <Shell title="Finance" subtitle="Loading…">
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Shell>
    );
  }

  if (!canAccessFinance(user.role) || tabs.length === 0) {
    return (
      <Shell title="Finance" subtitle="Access denied">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm font-medium text-muted">You don&apos;t have access to Finance.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Finance" subtitle="Revenue, expenses & profitability · OMR">
      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold transition-colors',
              active === t.key ? 'text-accent' : 'text-muted hover:text-text'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {active === t.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {active === 'dashboard' && <FinanceDashboard user={user} />}
      {active === 'monthly' && <MonthlyTracker user={user} />}
      {active === 'expenses' && <ExpenseEntry user={user} />}
      {active === 'clients' && <ClientsManager user={user} />}
    </Shell>
  );
}
