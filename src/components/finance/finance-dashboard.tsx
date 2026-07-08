'use client';

import { useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, startOfMonth, subMonths, isSameMonth, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatOMR, formatOMRCompact } from '@/lib/currency';
import { canViewFixedExpenses } from '@/lib/roles';
import { SCOPE_LABELS, SCOPE_ORDER } from '@/lib/expense-scope';
import { useFinanceClients, useClientInvoices, useExpenses, useInvoicePayments } from '@/hooks/use-finance-data';
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

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const signedPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export function FinanceDashboard({ user }: { user: User }) {
  const { clients } = useFinanceClients();
  const { invoices } = useClientInvoices();
  const { payments } = useInvoicePayments();
  const { expenses } = useExpenses();
  const showFixed = canViewFixedExpenses(user.role);

  const now = startOfMonth(new Date());

  const kpis = useMemo(() => {
    const rev = monthRevenue(clients, invoices, now);
    const prevRev = monthRevenue(clients, invoices, subMonths(now, 1));
    const exp = monthExpenses(expenses, now);
    const retainers = clients.filter((c) => c.status === 'active' && c.type === 'retainer').length;
    const campaigns = clients.filter((c) => c.status === 'active' && c.type === 'campaign').length;
    const net = rev.expected - exp.operational - exp.fixed;
    const collectionRate = rev.expected > 0 ? rev.collected / rev.expected : null;
    const momChange = prevRev.expected > 0 ? (rev.expected - prevRev.expected) / prevRev.expected : null;
    const margin = rev.expected > 0 ? net / rev.expected : null;
    return { ...rev, ...exp, retainers, campaigns, net, outstanding: rev.expected - rev.collected, collectionRate, momChange, margin };
  }, [clients, invoices, expenses, now]);

  // 6-month trend (net only for roles that see fixed expenses)
  const trend = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const m = subMonths(now, 5 - idx);
      const rev = monthRevenue(clients, invoices, m);
      const exp = monthExpenses(expenses, m);
      const total = exp.operational + (showFixed ? exp.fixed : 0);
      return {
        month: format(m, 'MMM'),
        Revenue: rev.expected,
        Expenses: total,
        ...(showFixed ? { Net: rev.expected - total } : {}),
      };
    });
  }, [clients, invoices, expenses, now, showFixed]);

  // 6-month collected vs pending revenue (advances now, remainder later)
  const collectionTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const m = subMonths(now, 5 - idx);
      const rev = monthRevenue(clients, invoices, m);
      return {
        month: format(m, 'MMM'),
        Collected: rev.collected,
        Pending: Math.max(0, rev.expected - rev.collected),
      };
    });
  }, [clients, invoices, now]);

  // Per-client payment status for this month: advance received vs remainder due
  const clientCollection = useMemo(() => {
    const monthInvoices = invoices.filter((i) => isSameMonth(parseISO(i.month), now));
    return clients
      .filter((c) => c.status === 'active')
      .map((c) => {
        let expected = 0;
        let collected = 0;
        if (c.type === 'retainer') {
          const inv = monthInvoices.find((i) => i.client_id === c.id);
          expected = inv ? inv.amount : c.monthly_amount;
          collected = inv ? inv.paid_amount : 0;
        } else {
          const invs = monthInvoices.filter((i) => i.client_id === c.id);
          expected = invs.reduce((s, i) => s + i.amount, 0);
          collected = invs.reduce((s, i) => s + i.paid_amount, 0);
        }
        const invIds = new Set(monthInvoices.filter((i) => i.client_id === c.id).map((i) => i.id));
        const clientPayments = payments.filter((p) => invIds.has(p.invoice_id));
        const lastPaid = clientPayments.reduce<string | null>(
          (m, p) => (m === null || p.paid_on > m ? p.paid_on : m), null
        );
        return { id: c.id, name: c.name, expected, collected, pending: Math.max(0, expected - collected), lastPaid };
      })
      .filter((r) => r.expected > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [clients, invoices, payments, now]);

  // Operational expense categories (this month)
  const opByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), now))
      .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses, now]);

  // Operational spend split by scope: general portfolio / client-based / asset purchases (this month)
  const opByScope = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), now))
      .forEach((e) => map.set(e.scope ?? 'general', (map.get(e.scope ?? 'general') ?? 0) + e.amount));
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return {
      total,
      rows: SCOPE_ORDER
        .map((scope) => ({ scope, label: SCOPE_LABELS[scope], amount: map.get(scope) ?? 0 }))
        .filter((r) => r.amount > 0),
    };
  }, [expenses, now]);

  // Client profitability: revenue vs directly-attributed expenses (this month)
  const clientProfit = useMemo(() => {
    const monthInvoices = invoices.filter((i) => isSameMonth(parseISO(i.month), now));
    const rows = clients
      .filter((c) => c.status === 'active')
      .map((c) => {
        let revenue = 0;
        if (c.type === 'retainer') {
          const inv = monthInvoices.find((i) => i.client_id === c.id);
          revenue = inv ? inv.amount : c.monthly_amount;
        } else {
          revenue = monthInvoices.filter((i) => i.client_id === c.id).reduce((s, i) => s + i.amount, 0);
        }
        const direct = expenses
          .filter((e) => e.client_id === c.id && isSameMonth(parseISO(e.expense_date), now))
          .reduce((s, e) => s + e.amount, 0);
        return { id: c.id, name: c.name, revenue, direct, margin: revenue - direct };
      })
      .filter((r) => r.revenue > 0 || r.direct > 0)
      .sort((a, b) => b.margin - a.margin);
    return rows;
  }, [clients, invoices, expenses, now]);

  const cards: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: 'Revenue (this month)', value: formatOMR(kpis.expected), sub: `${formatOMR(kpis.collected)} collected` },
    { label: 'Pending Revenue', value: formatOMR(kpis.outstanding), sub: 'not yet collected this month', tone: kpis.outstanding > 0 ? 'text-red' : 'text-text' },
    { label: 'Collection Rate', value: kpis.collectionRate === null ? '—' : pct(kpis.collectionRate), sub: 'of expected revenue collected', tone: kpis.collectionRate === null ? 'text-text' : kpis.collectionRate >= 0.9 ? 'text-green' : kpis.collectionRate < 0.5 ? 'text-red' : 'text-text' },
    { label: 'Revenue MoM', value: kpis.momChange === null ? '—' : signedPct(kpis.momChange), sub: `vs ${format(subMonths(now, 1), 'MMMM')}`, tone: kpis.momChange === null ? 'text-text' : kpis.momChange >= 0 ? 'text-green' : 'text-red' },
    { label: 'Operational Expenses', value: formatOMR(kpis.operational), sub: 'this month' },
    ...(showFixed
      ? [
          { label: 'Fixed Expenses', value: formatOMR(kpis.fixed), sub: 'salaries, rent, utilities' },
          { label: 'Net Profit', value: formatOMR(kpis.net), sub: kpis.margin === null ? 'after all expenses' : `${pct(kpis.margin)} margin`, tone: kpis.net >= 0 ? 'text-green' : 'text-red' },
        ]
      : [
          { label: 'Gross (excl. fixed)', value: formatOMR(kpis.expected - kpis.operational), sub: 'revenue − operational' },
        ]),
    { label: 'Active Clients', value: String(kpis.retainers + kpis.campaigns), sub: `${kpis.retainers} retainer · ${kpis.campaigns} campaign` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4">
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
        <h3 className="font-display text-lg font-semibold tracking-tight text-text">Revenue vs Expenses{showFixed ? ' vs Net' : ''}</h3>
        <p className="mb-4 text-[13px] text-muted">Last 6 months · OMR</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={trend}>
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
            {showFixed && (
              <Line type="monotone" dataKey="Net" stroke="var(--color-green)" strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-green)', strokeWidth: 0 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Collected vs pending revenue */}
        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold tracking-tight text-text">Collected vs Pending Revenue</h3>
          <p className="mb-4 text-[13px] text-muted">Last 6 months · advances received vs balance due</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={collectionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} width={48}
                tickFormatter={(v) => formatOMRCompact(Number(v)).replace('OMR', '').trim()} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                formatter={(value) => formatOMR(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Collected" stackId="rev" fill="var(--color-green)" />
              <Bar dataKey="Pending" stackId="rev" fill="var(--color-yellow)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment status by client */}
        {clientCollection.length > 0 && (
          <div className="rounded-card border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-display text-lg font-semibold tracking-tight text-text">Payment Status by Client</h3>
              <p className="text-[13px] text-muted">This month · collected vs balance due</p>
            </div>
            <div className="space-y-4 p-5">
              {clientCollection.map((r) => (
                <div key={r.id}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] font-medium text-text">{r.name}</span>
                    {r.pending > 0 ? (
                      <span className="shrink-0 text-xs text-muted">
                        <span className="stat-numeral text-text">{formatOMR(r.collected)}</span> of {formatOMR(r.expected)}
                        <span className="ml-1.5 font-semibold text-yellow">{formatOMR(r.pending)} due</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-green">Paid in full · {formatOMR(r.expected)}</span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-green"
                      style={{ width: `${Math.min(100, (r.collected / r.expected) * 100)}%` }} />
                  </div>
                  {r.lastPaid && (
                    <p className="mt-0.5 text-[10px] text-faint">Last payment {format(parseISO(r.lastPaid), 'MMM d, yyyy')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Operational spend by scope */}
        {opByScope.rows.length > 0 && (
          <div className="rounded-card border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-display text-lg font-semibold tracking-tight text-text">Operational Spend by Type</h3>
              <p className="text-[13px] text-muted">This month · general vs client vs assets</p>
            </div>
            <div className="space-y-4 p-5">
              {opByScope.rows.map((r) => (
                <div key={r.scope}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-text">{r.label}</span>
                    <span className="stat-numeral text-sm text-text">
                      {formatOMR(r.amount)}
                      <span className="ml-1.5 text-xs text-faint">{pct(r.amount / opByScope.total)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(r.amount / opByScope.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Client profitability */}
      {clientProfit.length > 0 && (
        <div className="rounded-card border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-display text-lg font-semibold tracking-tight text-text">Client Profitability</h3>
            <p className="text-[13px] text-muted">This month · revenue vs directly-attributed expenses</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Client</th>
                  <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Revenue</th>
                  <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Direct Costs</th>
                  <th className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Margin</th>
                </tr>
              </thead>
              <tbody>
                {clientProfit.map((r, i) => (
                  <tr key={r.id} className={cn(i !== clientProfit.length - 1 && 'border-b border-border')}>
                    <td className="max-w-[220px] truncate px-5 py-2.5 text-[13px] font-medium text-text">{r.name}</td>
                    <td className="stat-numeral px-5 py-2.5 text-right text-sm text-text">{formatOMR(r.revenue)}</td>
                    <td className="stat-numeral px-5 py-2.5 text-right text-sm text-text">{formatOMR(r.direct)}</td>
                    <td className={cn('stat-numeral px-5 py-2.5 text-right text-sm', r.margin >= 0 ? 'text-green' : 'text-red')}>
                      {formatOMR(r.margin)}
                      {r.revenue > 0 && <span className="ml-1.5 text-xs text-faint">{pct(r.margin / r.revenue)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
