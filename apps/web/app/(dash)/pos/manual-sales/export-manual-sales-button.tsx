'use client';

import { InlineAlert } from '@/components/confirm-dialog';
import { exportWorkbook } from '@/lib/export-workbook';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportManualSales } from './actions';

export function ExportManualSalesButton({ locationId }: { locationId?: string }) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common
  const errors = useTranslations('common.errors');
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    const result = await serverExportManualSales(locationId);
    if (result.ok && result.value) {
      await exportWorkbook(
        `pos-manual-sales-${new Date().toISOString().split('T')[0]}.xlsx`,
        result.value.sheets,
      );
    } else {
      setError(result.error ?? errors('serverError'));
    }
  }

  return (
    <div className="space-y-2">
      {error ? <InlineAlert message={error} onDismiss={() => setError(null)} /> : null}
      <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />
    </div>
  );
}
