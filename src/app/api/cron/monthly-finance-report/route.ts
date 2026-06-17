import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfMonth, subMonths, parse, format } from 'date-fns';
import { buildFinanceReport } from '@/lib/finance-report';
import { renderFinanceReportPdf } from '@/lib/finance-report-pdf';
import {
  uploadWhatsAppMedia,
  sendWhatsAppTemplate,
} from '@/lib/whatsapp';
import { buildFinanceReportTemplate } from '@/lib/notifications';
import { formatOMR } from '@/lib/currency';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/monthly-finance-report
 *
 * Sends the previous month's finance report (short WhatsApp summary + PDF) to
 * every user with `receives_finance_report = true` and a phone number set.
 *
 * Scheduled via vercel.json crons. Vercel adds `Authorization: Bearer <CRON_SECRET>`
 * automatically when CRON_SECRET is configured. For manual verification:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<app>/api/cron/monthly-finance-report?month=2026-05"
 */
export async function GET(request: NextRequest) {
  // Auth — require the cron secret if one is configured.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }

  // Target month: explicit ?month=YYYY-MM (for testing) or the previous month.
  const monthParam = request.nextUrl.searchParams.get('month');
  const month = monthParam
    ? startOfMonth(parse(monthParam, 'yyyy-MM', new Date()))
    : startOfMonth(subMonths(new Date(), 1));
  const monthSlug = format(month, 'yyyy-MM');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Recipients: opted-in users with a phone number.
  const { data: recipients, error: recErr } = await admin
    .from('users')
    .select('id, full_name, phone_number, company_id')
    .eq('receives_finance_report', true)
    .not('phone_number', 'is', null);

  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 });
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ sent: 0, reason: 'no opted-in recipients', month: monthSlug });
  }

  // Group recipients by company so we compute/upload the report once per company.
  const byCompany = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const list = byCompany.get(r.company_id) ?? [];
    list.push(r);
    byCompany.set(r.company_id, list);
  }

  let sent = 0;
  let failed = 0;
  const companyResults: Record<string, unknown>[] = [];

  for (const [companyId, companyRecipients] of byCompany) {
    try {
      const { data: company } = await admin
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      const companyName = company?.name ?? 'Company';

      const report = await buildFinanceReport(admin, companyId, month);
      const pdfBytes = await renderFinanceReportPdf(report, companyName);
      const filename = `Finance-Report-${monthSlug}.pdf`;

      const upload = await uploadWhatsAppMedia(pdfBytes, filename, 'application/pdf');
      if (!upload.success || !upload.mediaId) {
        companyResults.push({ companyId, error: `media upload failed: ${upload.error}` });
        failed += companyRecipients.length;
        continue;
      }

      const template = buildFinanceReportTemplate({
        monthLabel: report.monthLabel,
        revenueCollected: formatOMR(report.revenueCollected),
        totalExpenses: formatOMR(report.totalExpenses),
        netProfit: formatOMR(report.net),
        mediaId: upload.mediaId,
        filename,
      });

      const summaryBody =
        `Monthly Finance Report — ${report.monthLabel}\n` +
        `Revenue collected: ${formatOMR(report.revenueCollected)}\n` +
        `Total expenses: ${formatOMR(report.totalExpenses)}\n` +
        `Net profit: ${formatOMR(report.net)}`;

      await Promise.allSettled(
        companyRecipients.map(async (r) => {
          const phone = r.phone_number as string;
          const result = await sendWhatsAppTemplate(phone, template);

          await admin.from('notification_log').insert({
            user_id: r.id,
            task_id: null,
            event_type: 'monthly_finance_report',
            channel: 'whatsapp',
            phone_number: phone,
            message_body: summaryBody,
            status: result.success ? 'sent' : 'failed',
            error_message: result.error || null,
            provider_message_id: result.messageId || null,
            sent_at: result.success ? new Date().toISOString() : null,
          });

          if (result.success) sent += 1;
          else failed += 1;
        })
      );

      companyResults.push({ companyId, recipients: companyRecipients.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[finance-report cron]', companyId, msg);
      companyResults.push({ companyId, error: msg });
      failed += companyRecipients.length;
    }
  }

  return NextResponse.json({ month: monthSlug, sent, failed, companies: companyResults });
}
