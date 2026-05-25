'use client';

import { InlineAlert } from '@/components/confirm-dialog';
import { exportWorkbook } from '@/lib/export-workbook';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportOrders } from './actions';

export function ExportOrdersButton({ date }: { date?: string }) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common
  const errors = useTranslations('common.errors');
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    const result = await serverExportOrders(date);
    if (result.ok && result.value) {
      await exportWorkbook(
        `pos-orders-${date || new Date().toISOString().split('T')[0]}.xlsx`,
        result.value.sheets,
      );
    } else {
      setError(result.error ?? errors('serverError'));
    }
  }

  return (
    <div className="relative inline-block">
      <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />
      {error ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72">
          <InlineAlert message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
    </div>
  );
}
