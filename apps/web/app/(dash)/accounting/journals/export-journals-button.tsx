'use client';

import { exportWorkbook } from '@/lib/export-workbook';
import { useTranslations } from 'next-intl';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportJournals } from './actions';

export function ExportJournalsButton() {
  const t = useTranslations('accounting.journal');

  async function handleExport() {
    const result = await serverExportJournals();
    if (result.ok && result.value) {
      await exportWorkbook(
        `journals-${new Date().toISOString().split('T')[0]}.xlsx`,
        result.value.sheets,
      );
    } else {
      alert('Failed to export journals');
    }
  }

  return <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />;
}
