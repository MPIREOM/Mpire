import type { ExpenseScope } from '@/types/database';

/** Display labels for expense scopes, shared by the app UI and PDF report. */
export const SCOPE_LABELS: Record<ExpenseScope, string> = {
  general: 'General Portfolio',
  client_based: 'Client-based',
  asset_purchase: 'Asset Purchase',
};

export const SCOPE_ORDER: ExpenseScope[] = ['general', 'client_based', 'asset_purchase'];
