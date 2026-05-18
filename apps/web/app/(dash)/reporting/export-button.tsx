'use client';

import { exportWorkbook, type WorkbookSheet } from '@/lib/export-workbook';
import { useState } from 'react';

interface Props {
  filename: string;
  sheets: WorkbookSheet[];
  label?: string;
}

/**
 * Unified XLSX export button used across reporting pages.
 *
 * Style matches the jade variant used by daily-summary, hourly-sales,
 * donations, omzet-harian, and inventory-variance so every "Export
 * Excel" CTA in the app looks and behaves the same.
 */
export function ExportXlsxButton({ filename, sheets, label = 'Export Excel' }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          setBusy(true);
          await exportWorkbook(filename, sheets);
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-jade px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-jade/90 disabled:opacity-50"
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
