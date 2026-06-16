'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { FinanceClient, ClientInvoice, Expense, ClientName } from '@/types/database';

const supabase = createClient();

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
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    mutate();
  }

  return { expenses: data ?? [], isLoading, error, mutate, addExpense, updateExpense, deleteExpense };
}
