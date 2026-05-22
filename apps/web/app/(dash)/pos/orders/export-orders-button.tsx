'use client';

import { useTranslations } from 'next-intl';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportOrders } from './actions';
import { exportWorkbook } from '@/lib/export-workbook';

export function ExportOrdersButton({ date }: { date?: string }) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common

  async function handleExport() {
    const result = await serverExportOrders(date);
    if (result.ok && result.value) {
      await exportWorkbook(`pos-orders-${date || new Date().toISOString().split('T')[0]}.xlsx`, result.value.sheets);
    } else {
      alert('Failed to export orders');
    }
  }

  return <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />;
}
