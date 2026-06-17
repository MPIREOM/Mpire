/**
 * Renders a monthly finance report to a PDF (Uint8Array) using pdf-lib.
 * Pure JS — no native deps, safe to run in a serverless function.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatOMR } from '@/lib/currency';
import type { FinanceReport } from '@/lib/finance-report';

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 50;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.85, 0.85, 0.88);

export async function renderFinanceReportPdf(
  report: FinanceReport,
  companyName: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const text = (
    s: string,
    x: number,
    size: number,
    f: PDFFont = font,
    color = INK
  ) => {
    page.drawText(s, { x, y, size, font: f, color });
  };

  const textRight = (s: string, xRight: number, size: number, f: PDFFont = font, color = INK) => {
    const w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xRight - w, y, size, font: f, color });
  };

  const hr = (p: PDFPage, yy: number) => {
    p.drawLine({
      start: { x: MARGIN, y: yy },
      end: { x: PAGE_W - MARGIN, y: yy },
      thickness: 0.5,
      color: LINE,
    });
  };

  // Header
  text(companyName, MARGIN, 20, bold);
  y -= 24;
  text('Monthly Finance Report', MARGIN, 13, font, MUTED);
  textRight(report.monthLabel, PAGE_W - MARGIN, 13, bold);
  y -= 12;
  hr(page, y);
  y -= 28;

  // KPI rows
  const kpi = (label: string, value: string, valueColor = INK) => {
    ensureSpace(22);
    text(label, MARGIN, 11, font, MUTED);
    textRight(value, PAGE_W - MARGIN, 12, bold, valueColor);
    y -= 22;
  };

  kpi('Revenue expected', formatOMR(report.revenueExpected));
  kpi('Revenue collected', formatOMR(report.revenueCollected));
  kpi('Outstanding', formatOMR(report.outstanding), report.outstanding > 0 ? rgb(0.8, 0.2, 0.2) : INK);
  kpi('Operational expenses', formatOMR(report.operational));
  kpi('Fixed expenses', formatOMR(report.fixed));
  kpi('Total expenses', formatOMR(report.totalExpenses));
  kpi('Net profit', formatOMR(report.net), report.net >= 0 ? rgb(0.15, 0.55, 0.25) : rgb(0.8, 0.2, 0.2));
  kpi('Active clients', `${report.activeRetainers + report.activeCampaigns} (${report.activeRetainers} retainer, ${report.activeCampaigns} campaign)`);

  y -= 10;

  // Per-client breakdown
  if (report.perClient.length > 0) {
    ensureSpace(40);
    hr(page, y);
    y -= 22;
    text('Revenue by client', MARGIN, 13, bold);
    y -= 20;
    text('Client', MARGIN, 10, font, MUTED);
    textRight('Expected', PAGE_W - MARGIN - 110, 10, font, MUTED);
    textRight('Collected', PAGE_W - MARGIN, 10, font, MUTED);
    y -= 16;
    for (const c of report.perClient) {
      ensureSpace(18);
      const name = c.name.length > 40 ? c.name.slice(0, 38) + '…' : c.name;
      text(name, MARGIN, 11);
      textRight(formatOMR(c.expected), PAGE_W - MARGIN - 110, 11);
      textRight(formatOMR(c.collected), PAGE_W - MARGIN, 11);
      y -= 18;
    }
  }

  // Operational by category
  if (report.opByCategory.length > 0) {
    y -= 10;
    ensureSpace(40);
    hr(page, y);
    y -= 22;
    text('Operational spend by category', MARGIN, 13, bold);
    y -= 20;
    for (const c of report.opByCategory) {
      ensureSpace(18);
      text(c.category, MARGIN, 11);
      textRight(formatOMR(c.amount), PAGE_W - MARGIN, 11);
      y -= 18;
    }
  }

  // Footer note
  ensureSpace(30);
  y -= 6;
  hr(page, y);
  y -= 16;
  text(
    `Generated ${new Date().toISOString().slice(0, 10)} · Figures in OMR`,
    MARGIN,
    9,
    font,
    MUTED
  );

  return doc.save();
}
