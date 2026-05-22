'use client';

import { useTranslations } from 'next-intl';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportEmployees } from './actions';
import { exportWorkbook } from '@/lib/export-workbook';

export function ExportEmployeesButton({ 
  q, 
  status, 
  locationId 
}: { 
  q?: string; 
  status?: string; 
  locationId?: string; 
}) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common

  async function handleExport() {
    const result = await serverExportEmployees({ 
      search: q, 
      status: status as "active" | "probation" | "on_leave" | "terminated" | undefined, 
      locationId 
    });
    if (result.ok && result.value) {
      await exportWorkbook(`hr-employees-${new Date().toISOString().split('T')[0]}.xlsx`, result.value.sheets);
    } else {
      alert('Failed to export employees');
    }
  }

  return <ExportXlsxButton onExport={handleExport} label={t('exportExcel') || 'Export Excel'} />;
}
