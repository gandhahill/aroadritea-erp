'use client';

import { type WorkbookSheet, exportWorkbook } from '@/lib/export-workbook';
import { useState } from 'react';

type SheetsPayload =
  | { filename: string; sheets: WorkbookSheet[]; onExport?: never }
  | { onExport: () => Promise<void> | void; filename?: never; sheets?: never };

type Props = SheetsPayload & {
  label?: string;
  disabled?: boolean;
};

/**
 * Unified XLSX export button used across reporting pages.
 *
 * Style matches the jade variant used by daily-summary, hourly-sales,
 * donations, omzet-harian, and inventory-variance so every "Export
 * Excel" CTA in the app looks and behaves the same.
 *
 * Pass either:
 *   - `filename` + `sheets`: workbook is composed and downloaded here.
 *   - `onExport`: caller owns the export logic (used by pages that
 *     call a server action that returns a buffer).
 */
export function ExportXlsxButton(props: Props) {
  const { label = 'Export Excel', disabled } = props;
  const [busy, setBusy] = useState(false);

  async function runExport() {
    try {
      setBusy(true);
      if ('onExport' in props && props.onExport) {
        await props.onExport();
      } else if ('filename' in props && 'sheets' in props && props.filename && props.sheets) {
        await exportWorkbook(props.filename, props.sheets);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runExport}
      disabled={busy || disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5v3.75"
        />
      </svg>
      {busy ? 'Menyiapkan...' : label}
    </button>
  );
}
