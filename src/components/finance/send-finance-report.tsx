'use client';

import { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

/**
 * Owner/manager control to manually send the finance report (WhatsApp summary
 * + PDF) to opted-in recipients for a chosen month.
 */
export function SendFinanceReport() {
  // Default to the previous month.
  const [month, setMonth] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch('/api/finance/send-report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send finance report');
        return;
      }
      if (data.sent === 0 && data.reason) {
        toast.info(data.reason);
      } else {
        toast.success(
          `Finance report (${data.monthLabel ?? month}) sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}` +
            (data.failed ? ` · ${data.failed} failed` : '')
        );
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Report month
        </label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
        />
      </div>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !month}
        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-light active:scale-95 disabled:opacity-50"
      >
        <PaperAirplaneIcon className="h-4 w-4" />
        {sending ? 'Sending…' : 'Send finance report'}
      </button>
      <p className="w-full text-[11px] text-muted sm:w-auto sm:flex-1">
        Sends a WhatsApp summary + PDF to team members who have the monthly finance
        report enabled (People page) and a phone number set.
      </p>
    </div>
  );
}
