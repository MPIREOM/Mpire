'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, startOfMonth, subMonths, isSameMonth, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatOMR, formatOMRCompact } from '@/lib/currency';
import { canViewFixedExpenses } from '@/lib/roles';
import { useFinanceClients, useClientInvoices, useExpenses } from '@/hooks/use-finance-data';
import type { User, FinanceClient, ClientInvoice, Expense } from '@/types/database';

function monthRevenue(clients: FinanceClient[], invoices: ClientInvoice[], month: Date) {
  const monthInvoices = invoices.filter((i) => isSameMonth(parseISO(i.month), month));
  let expected = 0;
  let collected = 0;
  // Retainer clients: invoice amount if present, else their monthly rate
  for (const c of clients.filter((c) => c.status === 'active' && c.type === 'retainer')) {
    const inv = monthInvoices.find((i) => i.client_id === c.id);
    expected += inv ? inv.amount : c.monthly_amount;
    collected += inv ? inv.paid_amount : 0;
  }
  // Campaign / ad-hoc invoices
  for (const inv of monthInvoices) {
    const client = clients.find((c) => c.id === inv.client_id);
    if (client && client.type === 'retainer') continue; // already counted
    expected += inv.amount;
    collected += inv.paid_amount;
  }
  return { expected, collected };
}

function monthExpenses(expenses: Expense[], month: Date) {
  const inMonth = expenses.filter((e) => isSameMonth(parseISO(e.expense_date), month));
  const operational = inMonth.filter((e) => e.type === 'operational').reduce((s, e) => s + e.amount, 0);
  const fixed = inMonth.filter((e) => e.type === 'fixed').reduce((s, e) => s + e.amount, 0);
  return { operational, fixed };
}

export function FinanceDashboard({ user }: { user: User }) {
  const { clients } = useFinanceClients();
  const { invoices } = useClientInvoices();
  const { expenses } = useExpenses();
  const showFixed = canViewFixedExpenses(user.role);

  const now = startOfMonth(new Date());

  const kpis = useMemo(() => {
    const rev = monthRevenue(clients, invoices, now);
    const exp = monthExpenses(expenses, now);
    const retainers = clients.filter((c) => c.status === 'active' && c.type === 'retainer').length;
    const campaigns = clients.filter((c) => c.status === 'active' && c.type === 'campaign').length;
    const net = rev.expected - exp.operational - exp.fixed;
    return { ...rev, ...exp, retainers, campaigns, net, outstanding: rev.expected - rev.collected };
  }, [clients, invoices, expenses, now]);

  // 6-month trend
  const trend = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const m = subMonths(now, 5 - idx);
      const rev = monthRevenue(clients, invoices, m);
      const exp = monthExpenses(expenses, m);
      return {
        month: format(m, 'MMM'),
        Revenue: rev.expected,
        Expenses: exp.operational + (showFixed ? exp.fixed : 0),
      };
    });
  }, [clients, invoices, expenses, now, showFixed]);

  // Operational expense categories (this month)
  const opByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), now))
      .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses, now]);

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: 'Revenue (this month)', value: formatOMR(kpis.expected), sub: `${formatOMR(kpis.collected)} collected` },
    { label: 'Outstanding', value: formatOMR(kpis.outstanding), sub: 'unpaid this month', tone: kpis.outstanding > 0 ? 'text-red' : 'text-text' },
    { label: 'Operational Expenses', value: formatOMR(kpis.operational), sub: 'this month' },
    ...(showFixed
      ? [
          { label: 'Fixed Expenses', value: formatOMR(kpis.fixed), sub: 'salaries, rent, utilities' },
          { label: 'Net Profit', value: formatOMR(kpis.net), sub: 'after all expenses', tone: kpis.net >= 0 ? 'text-green' : 'text-red' },
        ]
      : [
          { label: 'Gross (excl. fixed)', value: formatOMR(kpis.expected - kpis.operational), sub: 'revenue − operational' },
        ]),
    { label: 'Active Clients', value: String(kpis.retainers + kpis.campaigns), sub: `${kpis.retainers} retainer · ${kpis.campaigns} campaign` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card p-5 sm:p-6">
            <p className="eyebrow truncate">{c.label}</p>
            <p className={cn('stat-numeral mt-3 text-3xl', c.tone ?? 'text-text')}>{c.value}</p>
            {c.sub && <p className="mt-2 text-xs text-faint">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Trend */}
      <div className="rounded-card border border-border bg-card p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight text-text">Revenue vs Expenses</h3>
        <p className="mb-4 text-[13px] text-muted">Last 6 months · OMR</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={48}
              tickFormatter={(v) => formatOMRCompact(Number(v)).replace('OMR', '').trim()} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
              formatter={(value) => formatOMR(Number(value))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Revenue" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Operational categories */}
      {opByCategory.length > 0 && (
        <div className="rounded-card border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-display text-lg font-semibold tracking-tight text-text">Operational Spend by Category</h3>
            <p className="text-[13px] text-muted">This month</p>
          </div>
          {opByCategory.map((c, i) => (
            <div key={c.category} className={cn('flex items-center justify-between px-5 py-2.5', i !== opByCategory.length - 1 && 'border-b border-border')}>
              <span className="text-[13px] font-medium text-text">{c.category}</span>
              <span className="stat-numeral text-base text-text">{formatOMR(c.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
