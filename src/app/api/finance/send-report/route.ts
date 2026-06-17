import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfMonth, subMonths, parse, format } from 'date-fns';
import { createServerSupabase } from '@/lib/supabase/server';
import { canManageFinance } from '@/lib/roles';
import { buildFinanceReport } from '@/lib/finance-report';
import { renderFinanceReportPdf } from '@/lib/finance-report-pdf';
import { uploadWhatsAppMedia, sendWhatsAppTemplate } from '@/lib/whatsapp';
import { buildFinanceReportTemplate } from '@/lib/notifications';
import { formatOMR } from '@/lib/currency';
import type { Role } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/finance/send-report
 *
 * Manually sends the finance report (short WhatsApp summary + PDF) to every
 * opted-in user in the caller's company. Owner/manager only.
 *
 * Body:
 *   month?: 'YYYY-MM'  — defaults to the previous month.
 */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }

  // Authenticate the caller and check finance-management permission.
  const supabase = await createServerSupabase();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', authUser.id)
    .single();

  if (!caller || !canManageFinance(caller.role as Role)) {
    return NextResponse.json(
      { error: 'Only owners and managers can send the finance report' },
      { status: 403 }
    );
  }

  // Target month from body (YYYY-MM) or previous month.
  let monthParam: string | undefined;
  try {
    const body = await request.json();
    monthParam = typeof body?.month === 'string' ? body.month : undefined;
  } catch {
    // no body — use default
  }
  const month = monthParam
    ? startOfMonth(parse(monthParam, 'yyyy-MM', new Date()))
    : startOfMonth(subMonths(new Date(), 1));
  const monthSlug = format(month, 'yyyy-MM');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Opted-in recipients in the caller's company with a phone number.
  const { data: recipients, error: recErr } = await admin
    .from('users')
    .select('id, full_name, phone_number')
    .eq('company_id', caller.company_id)
    .eq('receives_finance_report', true)
    .not('phone_number', 'is', null);

  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 });
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { sent: 0, failed: 0, month: monthSlug, reason: 'No opted-in recipients with a phone number.' },
      { status: 200 }
    );
  }

  try {
    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', caller.company_id)
      .single();
    const companyName = company?.name ?? 'Company';

    const report = await buildFinanceReport(admin, caller.company_id, month);
    const pdfBytes = await renderFinanceReportPdf(report, companyName);
    const filename = `Finance-Report-${monthSlug}.pdf`;

    const upload = await uploadWhatsAppMedia(pdfBytes, filename, 'application/pdf');
    if (!upload.success || !upload.mediaId) {
      return NextResponse.json(
        { error: `Failed to upload PDF to WhatsApp: ${upload.error}` },
        { status: 502 }
      );
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

    let sent = 0;
    let failed = 0;
    await Promise.allSettled(
      recipients.map(async (r) => {
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

    return NextResponse.json({ month: monthSlug, monthLabel: report.monthLabel, sent, failed, total: recipients.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[finance send-report]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
