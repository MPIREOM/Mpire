// Omani Rial (OMR) — 3 decimal places (1 rial = 1000 baisa).

const omrFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'OMR',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const omrCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'OMR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a number as OMR with 3 decimals, e.g. "OMR 1,250.000". */
export function formatOMR(amount: number): string {
  return omrFormatter.format(amount ?? 0);
}

/** Compact OMR (no decimals) for dashboard headline figures. */
export function formatOMRCompact(amount: number): string {
  return omrCompact.format(amount ?? 0);
}

/** Parse a user-entered amount string into a number (strips symbols/commas). */
export function parseAmount(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
