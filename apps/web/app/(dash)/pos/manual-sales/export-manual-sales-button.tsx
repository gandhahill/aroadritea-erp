'use client';

import { exportWorkbook } from '@/lib/export-workbook';
import { useTranslations } from 'next-intl';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportManualSales } from './actions';

export function ExportManualSalesButton({ locationId }: { locationId?: string }) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common

  async function handleExport() {
    const result = await serverExportManualSales(locationId);
    if (result.ok && result.value) {
      await exportWorkbook(
        `pos-manual-sales-${new Date().toISOString().split('T')[0]}.xlsx`,
        result.value.sheets,
      );
    } else {
      alert('Failed to export manual sales');
    }
  }

  return <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />;
}
