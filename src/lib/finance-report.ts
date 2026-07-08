/**
 * Server-side monthly finance report computation.
 *
 * Mirrors the logic in src/components/finance/finance-dashboard.tsx so the
 * numbers in the WhatsApp/PDF report match what owners see in the app.
 */

import { format, isSameMonth, parseISO, subMonths } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SCOPE_LABELS, SCOPE_ORDER } from '@/lib/expense-scope';
import type { FinanceClient, ClientInvoice, Expense } from '@/types/database';

export interface FinanceReport {
  companyId: string;
  month: Date;
  monthLabel: string; // e.g. "May 2026"
  revenueExpected: number;
  revenueCollected: number;
  outstanding: number;
  operational: number;
  fixed: number;
  totalExpenses: number;
  net: number;
  netMargin: number | null; // net / expected revenue
  collectionRate: number | null; // collected / expected
  momRevenueChange: number | null; // expected revenue vs previous month
  activeRetainers: number;
  activeCampaigns: number;
  perClient: { name: string; expected: number; collected: number }[];
  opByCategory: { category: string; amount: number }[];
  opByScope: { label: string; amount: number }[];
  clientProfitability: { name: string; revenue: number; direct: number; margin: number }[];
  trend: { label: string; revenue: number; expenses: number; net: number }[]; // 6 months ending at report month
}

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

/**
 * Build a finance report for one company and month using a service-role client.
 */
export async function buildFinanceReport(
  admin: SupabaseClient,
  companyId: string,
  month: Date
): Promise<FinanceReport> {
  const [clientsRes, invoicesRes, expensesRes] = await Promise.all([
    admin.from('finance_clients').select('*').eq('company_id', companyId),
    admin.from('client_invoices').select('*').eq('company_id', companyId),
    admin.from('expenses').select('*').eq('company_id', companyId),
  ]);

  const clients = (clientsRes.data ?? []) as FinanceClient[];
  const invoices = (invoicesRes.data ?? []) as ClientInvoice[];
  const expenses = (expensesRes.data ?? []) as Expense[];

  const rev = monthRevenue(clients, invoices, month);
  const exp = monthExpenses(expenses, month);
  const net = rev.expected - exp.operational - exp.fixed;

  const activeRetainers = clients.filter((c) => c.status === 'active' && c.type === 'retainer').length;
  const activeCampaigns = clients.filter((c) => c.status === 'active' && c.type === 'campaign').length;

  // Per-client revenue breakdown for the month
  const monthInvoices = invoices.filter((i) => isSameMonth(parseISO(i.month), month));
  const perClientMap = new Map<string, { name: string; expected: number; collected: number }>();
  for (const c of clients.filter((c) => c.status === 'active' && c.type === 'retainer')) {
    const inv = monthInvoices.find((i) => i.client_id === c.id);
    perClientMap.set(c.id, {
      name: c.name,
      expected: inv ? inv.amount : c.monthly_amount,
      collected: inv ? inv.paid_amount : 0,
    });
  }
  for (const inv of monthInvoices) {
    const client = clients.find((c) => c.id === inv.client_id);
    if (client && client.type === 'retainer') continue;
    const name = client?.name ?? inv.label ?? 'Ad-hoc';
    const existing = perClientMap.get(inv.client_id);
    if (existing) {
      existing.expected += inv.amount;
      existing.collected += inv.paid_amount;
    } else {
      perClientMap.set(inv.client_id, { name, expected: inv.amount, collected: inv.paid_amount });
    }
  }
  const perClient = Array.from(perClientMap.values())
    .filter((c) => c.expected > 0 || c.collected > 0)
    .sort((a, b) => b.expected - a.expected);

  // Operational expenses by category for the month
  const catMap = new Map<string, number>();
  expenses
    .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), month))
    .forEach((e) => catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount));
  const opByCategory = Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Operational expenses split by scope (general / client-based / asset purchases)
  const scopeMap = new Map<string, number>();
  expenses
    .filter((e) => e.type === 'operational' && isSameMonth(parseISO(e.expense_date), month))
    .forEach((e) => {
      const scope = e.scope ?? 'general';
      scopeMap.set(scope, (scopeMap.get(scope) ?? 0) + e.amount);
    });
  const opByScope = SCOPE_ORDER
    .map((scope) => ({ label: SCOPE_LABELS[scope], amount: scopeMap.get(scope) ?? 0 }))
    .filter((r) => r.amount > 0);

  // Client profitability: revenue vs directly-attributed expenses
  const clientProfitability = clients
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
        .filter((e) => e.client_id === c.id && isSameMonth(parseISO(e.expense_date), month))
        .reduce((s, e) => s + e.amount, 0);
      return { name: c.name, revenue, direct, margin: revenue - direct };
    })
    .filter((r) => r.revenue > 0 || r.direct > 0)
    .sort((a, b) => b.margin - a.margin);

  // 6-month trend ending at the report month
  const trend = Array.from({ length: 6 }, (_, idx) => {
    const m = subMonths(month, 5 - idx);
    const r = monthRevenue(clients, invoices, m);
    const e = monthExpenses(expenses, m);
    return {
      label: format(m, 'MMM yyyy'),
      revenue: r.expected,
      expenses: e.operational + e.fixed,
      net: r.expected - e.operational - e.fixed,
    };
  });

  // Month-over-month revenue change (expected)
  const prevRev = monthRevenue(clients, invoices, subMonths(month, 1));
  const momRevenueChange = prevRev.expected > 0 ? (rev.expected - prevRev.expected) / prevRev.expected : null;

  return {
    companyId,
    month,
    monthLabel: format(month, 'MMMM yyyy'),
    revenueExpected: rev.expected,
    revenueCollected: rev.collected,
    outstanding: rev.expected - rev.collected,
    operational: exp.operational,
    fixed: exp.fixed,
    totalExpenses: exp.operational + exp.fixed,
    net,
    netMargin: rev.expected > 0 ? net / rev.expected : null,
    collectionRate: rev.expected > 0 ? rev.collected / rev.expected : null,
    momRevenueChange,
    activeRetainers,
    activeCampaigns,
    perClient,
    opByCategory,
    opByScope,
    clientProfitability,
    trend,
  };
}
