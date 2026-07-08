'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FinanceClient, ClientInvoice, Expense, ClientName, RecurringExpense, InvoicePayment, User } from '@/types/database';

const supabase = createClient();

const INVOICE_BUCKET = 'expense-invoices';

/** Uploads an expense invoice to storage. Path: {company_id}/{uuid}/{filename}. */
export async function uploadExpenseInvoice(file: File, companyId: string): Promise<{ path: string; name: string }> {
  const safeName = file.name.replace(/[^\w.\-() ]+/g, '_');
  const path = `${companyId}/${crypto.randomUUID()}/${safeName}`;
  const { error } = await supabase.storage.from(INVOICE_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path, name: file.name };
}

/** Short-lived signed URL to view/download an attached invoice. */
export async function getInvoiceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(INVOICE_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

function useRealtime(table: string, mutate: () => void, key: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-rt-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, key, mutate]);
}

/* ── Clients ── */
export function useFinanceClients() {
  const { data, error, isLoading, mutate } = useSWR<FinanceClient[]>(
    'finance-clients',
    async () => {
      const { data, error } = await supabase
        .from('finance_clients')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as FinanceClient[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('finance_clients', mutate, 'clients');

  async function addClient(payload: Partial<FinanceClient>) {
    const { error } = await supabase.from('finance_clients').insert(payload);
    if (error) throw error;
    mutate();
  }
  async function updateClient(id: string, updates: Partial<FinanceClient>) {
    const { error } = await supabase.from('finance_clients').update(updates).eq('id', id);
    if (error) throw error;
    mutate();
  }
  async function deleteClient(id: string) {
    const { error } = await supabase.from('finance_clients').delete().eq('id', id);
    if (error) throw error;
    mutate();
  }

  return { clients: data ?? [], isLoading, error, mutate, addClient, updateClient, deleteClient };
}

/* ── Client names (names-only view; readable by all roles incl. staff) ── */
export function useClientNames() {
  const { data, mutate } = useSWR<ClientName[]>(
    'finance-client-names',
    async () => {
      const { data, error } = await supabase
        .from('finance_client_names')
        .select('id, name, type, status')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as ClientName[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('finance_clients', mutate, 'client-names');
  return { clientNames: data ?? [], mutate };
}

/* ── Client invoices (revenue) ── */
export function useClientInvoices() {
  const { data, error, isLoading, mutate } = useSWR<ClientInvoice[]>(
    'client-invoices',
    async () => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*, client:finance_clients(*)')
        .order('month', { ascending: false });
      if (error) throw error;
      return data as ClientInvoice[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('client_invoices', mutate, 'invoices');

  async function addInvoice(payload: Partial<ClientInvoice>) {
    const { data, error } = await supabase.from('client_invoices').insert(payload).select('*, client:finance_clients(*)').single();
    if (error) throw error;
    mutate();
    return data as ClientInvoice;
  }
  async function updateInvoice(id: string, updates: Partial<ClientInvoice>) {
    const { error } = await supabase.from('client_invoices').update(updates).eq('id', id);
    if (error) throw error;
    mutate();
  }
  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('client_invoices').delete().eq('id', id);
    if (error) throw error;
    mutate();
  }

  return { invoices: data ?? [], isLoading, error, mutate, addInvoice, updateInvoice, deleteInvoice };
}

/* ── Invoice payments (dated ledger of money received) ── */
export function useInvoicePayments() {
  const { data, error, isLoading, mutate } = useSWR<InvoicePayment[]>(
    'invoice-payments',
    async () => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InvoicePayment[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('invoice_payments', mutate, 'payments');

  async function addPayment(payload: Partial<InvoicePayment>) {
    const { error } = await supabase.from('invoice_payments').insert(payload);
    if (error) throw error;
    mutate();
  }
  async function deletePayment(id: string) {
    const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
    if (error) throw error;
    mutate();
  }
  async function deletePaymentsForInvoices(invoiceIds: string[]) {
    if (invoiceIds.length === 0) return;
    const { error } = await supabase.from('invoice_payments').delete().in('invoice_id', invoiceIds);
    if (error) throw error;
    mutate();
  }

  return { payments: data ?? [], isLoading, error, mutate, addPayment, deletePayment, deletePaymentsForInvoices };
}

/* ── Expenses ── */
export function useExpenses() {
  const { data, error, isLoading, mutate } = useSWR<Expense[]>(
    'expenses',
    async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, client:finance_clients(*), creator:users!expenses_created_by_fkey(*)')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('expenses', mutate, 'expenses');

  async function addExpense(payload: Partial<Expense>) {
    const { error } = await supabase.from('expenses').insert(payload);
    if (error) throw error;
    mutate();
  }
  async function updateExpense(id: string, updates: Partial<Expense>) {
    const { error } = await supabase.from('expenses').update(updates).eq('id', id);
    if (error) throw error;
    mutate();
  }
  async function deleteExpense(id: string) {
    const invoicePath = (data ?? []).find((e) => e.id === id)?.invoice_path;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    if (invoicePath) {
      // Best effort — the expense row is already gone.
      await supabase.storage.from(INVOICE_BUCKET).remove([invoicePath]).catch(() => {});
    }
    mutate();
  }

  return { expenses: data ?? [], isLoading, error, mutate, addExpense, updateExpense, deleteExpense };
}

/* ── Recurring expense templates (owner/manager) ── */
export function useRecurringExpenses() {
  const { data, error, isLoading, mutate } = useSWR<RecurringExpense[]>(
    'recurring-expenses',
    async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return data as RecurringExpense[];
    },
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  );
  useRealtime('recurring_expenses', mutate, 'recurring');

  async function addRecurring(payload: Partial<RecurringExpense>) {
    const { error } = await supabase.from('recurring_expenses').insert(payload);
    if (error) throw error;
    mutate();
  }
  async function updateRecurring(id: string, updates: Partial<RecurringExpense>) {
    const { error } = await supabase.from('recurring_expenses').update(updates).eq('id', id);
    if (error) throw error;
    mutate();
  }
  async function deleteRecurring(id: string) {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) throw error;
    mutate();
  }

  // Returns the list of active templates not yet generated for the given month (first-of-month ISO).
  async function pendingForMonth(monthFirst: string): Promise<RecurringExpense[]> {
    const active = (data ?? []).filter((t) => t.active);
    if (active.length === 0) return [];
    const { data: existing } = await supabase
      .from('expenses')
      .select('recurring_id')
      .eq('expense_date', monthFirst)
      .not('recurring_id', 'is', null);
    const done = new Set((existing ?? []).map((e: { recurring_id: string | null }) => e.recurring_id));
    return active.filter((t) => !done.has(t.id));
  }

  // Generates expense rows for the month from pending templates. Returns count added.
  async function generateForMonth(monthFirst: string, user: User): Promise<number> {
    const pending = await pendingForMonth(monthFirst);
    if (pending.length === 0) return 0;
    const rows = pending.map((t) => ({
      company_id: t.company_id,
      type: t.type,
      scope: t.scope,
      category: t.category,
      description: t.description,
      amount: t.amount,
      expense_date: monthFirst,
      recurring_id: t.id,
      created_by: user.id,
    }));
    const { error } = await supabase.from('expenses').insert(rows);
    if (error) throw error;
    return rows.length;
  }

  return { recurring: data ?? [], isLoading, error, mutate, addRecurring, updateRecurring, deleteRecurring, pendingForMonth, generateForMonth };
}
