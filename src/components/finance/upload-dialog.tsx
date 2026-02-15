'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  onUploaded: () => void;
}

interface ParsedData {
  headers: string[];
  rows: Record<string, string | number | Date>[];
  fileName: string;
}

interface ColumnMapping {
  month: string;
  category: string;
  amount: string;
}

const REQUIRED_FIELDS = ['month', 'category', 'amount'] as const;

export function UploadDialog({ open, onClose, businessId, onUploaded }: UploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ month: '', category: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep('upload');
    setParsed(null);
    setMapping({ month: '', category: '', amount: '' });
    setError('');
    setSaving(false);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

        if (json.length === 0) {
          setError('File is empty');
          return;
        }

        const headers = Object.keys(json[0]);
        setParsed({ headers, rows: json, fileName: file.name });

        // Auto-detect columns
        const autoMapping: ColumnMapping = { month: '', category: '', amount: '' };
        for (const h of headers) {
          const lower = h.toLowerCase();
          if (lower.includes('month') || lower.includes('date') || lower.includes('period')) autoMapping.month = h;
          else if (lower.includes('category') || lower.includes('type') || lower.includes('item') || lower.includes('description')) autoMapping.category = h;
          else if (lower.includes('amount') || lower.includes('total') || lower.includes('value') || lower.includes('cost')) autoMapping.amount = h;
        }
        setMapping(autoMapping);
        setStep('map');
      } catch {
        setError('Failed to parse file. Please use a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleMapNext() {
    if (!mapping.month || !mapping.category || !mapping.amount) {
      setError('Please map all required columns');
      return;
    }
    setError('');
    setStep('preview');
  }

  // Transform rows using mapping
  function getMappedRecords() {
    if (!parsed) return [];
    return parsed.rows
      .map((row) => {
        const rawMonth = row[mapping.month];
        const category = String(row[mapping.category] ?? '').trim();

        // Parse amount — strip currency symbols, commas, spaces before converting
        const rawAmount = row[mapping.amount];
        const amount = typeof rawAmount === 'number' ? rawAmount
          : Number(String(rawAmount).replace(/[^0-9.\-]/g, '')) || 0;

        // Normalize month to YYYY-MM
        let month = '';
        if (rawMonth instanceof Date) {
          // cellDates: true returns JS Date objects for date cells
          month = `${rawMonth.getFullYear()}-${String(rawMonth.getMonth() + 1).padStart(2, '0')}`;
        } else if (typeof rawMonth === 'number' && rawMonth > 1 && rawMonth < 2958466) {
          // Excel serial number fallback (days since 1900-01-01)
          const d = new Date((rawMonth - 25569) * 86400 * 1000);
          if (!isNaN(d.getTime())) {
            month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        } else {
          const monthRaw = String(rawMonth ?? '');
          if (/^\d{4}-\d{2}$/.test(monthRaw)) {
            month = monthRaw;
          } else {
            const d = new Date(monthRaw);
            if (!isNaN(d.getTime())) {
              month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
          }
        }

        return { month, category, amount };
      })
      .filter((r) => r.category && r.month);
  }

  async function handleUpload() {
    setError('');
    setSaving(true);

    try {
      const records = getMappedRecords();
      const res = await fetch('/api/finance/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          file_name: parsed?.fileName ?? 'upload.xlsx',
          column_mapping: mapping,
          records,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      toast.success(`Uploaded ${records.length} finance records`);
      onUploaded();
      onClose();
      reset();
    } catch {
      toast.error('Upload failed — network error');
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => { onClose(); reset(); }}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <DialogTitle className="text-base font-bold text-text">
              {step === 'upload' && 'Upload Finance Data'}
              {step === 'map' && 'Map Columns'}
              {step === 'preview' && 'Preview & Confirm'}
            </DialogTitle>
            <button
              type="button"
              onClick={() => { onClose(); reset(); }}
              className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            {(['upload', 'map', 'preview'] as const).map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className={cn('h-px flex-1', step === s || (['map', 'preview'].indexOf(step) > ['map', 'preview'].indexOf(s)) ? 'bg-accent' : 'bg-border')} />}
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  step === s ? 'bg-accent text-white' :
                  (['upload', 'map', 'preview'].indexOf(step) > i) ? 'bg-green text-white' : 'bg-bg text-muted'
                )}>
                  {(['upload', 'map', 'preview'].indexOf(step) > i) ? '✓' : i + 1}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-colors hover:border-accent hover:bg-accent-muted">
                <ArrowUpTrayIcon className="h-8 w-8 text-muted" />
                <span className="text-sm font-medium text-muted">
                  Drop Excel or CSV file here, or click to browse
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-muted">
                Supported: .xlsx, .xls, .csv — We&apos;ll auto-detect columns and let you map them.
              </p>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 'map' && parsed && (
            <div className="space-y-4">
              <p className="text-[13px] text-muted">
                Found <strong>{parsed.rows.length}</strong> rows and <strong>{parsed.headers.length}</strong> columns in <strong>{parsed.fileName}</strong>.
                Map your columns to the required fields:
              </p>

              {REQUIRED_FIELDS.map((field) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                    {field === 'month' ? 'Month / Date' : field === 'category' ? 'Category / Type' : 'Amount'}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-muted"
                  >
                    <option value="">— Select column —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleMapNext}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-light"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && parsed && (
            <div className="space-y-4">
              <p className="text-[13px] text-muted">
                Ready to upload <strong>{getMappedRecords().length}</strong> records.
              </p>
              <div className="rounded-lg border border-yellow/20 bg-yellow-bg px-3 py-2 text-[13px] text-yellow">
                All existing finance records for this business will be replaced.
              </div>

              {/* Preview table */}
              <div className="max-h-64 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-1.5 font-semibold text-muted">Month</th>
                      <th className="px-3 py-1.5 font-semibold text-muted">Category</th>
                      <th className="px-3 py-1.5 text-right font-semibold text-muted">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getMappedRecords().slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 tabular-nums">{r.month}</td>
                        <td className="px-3 py-1.5">{r.category}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {getMappedRecords().length > 10 && (
                  <p className="border-t border-border px-3 py-1.5 text-xs text-muted">
                    +{getMappedRecords().length - 10} more rows
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('map')}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted hover:bg-bg hover:text-text"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={saving}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-light disabled:opacity-50"
                >
                  {saving ? 'Uploading...' : 'Upload & Replace'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[13px] font-medium text-red">{error}</p>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
