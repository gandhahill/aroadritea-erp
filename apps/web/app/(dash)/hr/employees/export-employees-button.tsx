'use client';

import { InlineAlert } from '@/components/confirm-dialog';
import { exportWorkbook } from '@/lib/export-workbook';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ExportXlsxButton } from '../../reporting/export-button';
import { serverExportEmployees } from './actions';

export function ExportEmployeesButton({
  q,
  status,
  locationId,
}: {
  q?: string;
  status?: string;
  locationId?: string;
}) {
  const t = useTranslations('reporting.omzetHarian'); // Reusing existing translation or use common
  const errors = useTranslations('common.errors');
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    const result = await serverExportEmployees({
      search: q,
      status: status as 'active' | 'probation' | 'on_leave' | 'terminated' | undefined,
      locationId,
    });
    if (result.ok && result.value) {
      await exportWorkbook(
        `hr-employees-${new Date().toISOString().split('T')[0]}.xlsx`,
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
