/**
 * Server-side monthly finance report computation.
 *
 * Mirrors the logic in src/components/finance/finance-dashboard.tsx so the
 * numbers in the WhatsApp/PDF report match what owners see in the app.
 */

import { format, isSameMonth, parseISO } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  activeRetainers: number;
  activeCampaigns: number;
  perClient: { name: string; expected: number; collected: number }[];
  opByCategory: { category: string; amount: number }[];
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
    activeRetainers,
    activeCampaigns,
    perClient,
    opByCategory,
  };
}
