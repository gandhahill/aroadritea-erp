'use client';

import { exportWorkbook, type WorkbookSheet } from '@/lib/export-workbook';
import { useState } from 'react';

interface Props {
  filename: string;
  sheets: WorkbookSheet[];
  label?: string;
}

export function ExportXlsxButton({ filename, sheets, label = 'Export XLSX' }: Props) {
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
      className="rounded-md border border-brand-cream-3 bg-card px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-red/40 hover:text-brand-red disabled:opacity-50"
    >
      {busy ? 'Menyiapkan...' : label}
    </button>
  );
}
