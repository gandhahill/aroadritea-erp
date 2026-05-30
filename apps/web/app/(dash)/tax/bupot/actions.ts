'use server';

import { getSession } from '@/lib/auth';
import { listBuktiPotong, exportBupot21Xml, exportBupotUnifikasiXml } from '@erp/services/tax';
import { getTranslations } from 'next-intl/server';
import type { AuditContext } from '@erp/shared/types';
import { db } from '@erp/db';
import { withholdingTaxes } from '@erp/db/schema/accounting';
import { desc, eq, and } from '@erp/db';

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: '',
  };
}

export async function fetchBuktiPotongAction(period: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await listBuktiPotong(period, ctx);
  if (!res.ok) return { error: res.error.message };
  return { rows: res.value };
}

export async function exportBuktiPotongCsvAction(period: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await listBuktiPotong(period, ctx);
  if (!res.ok) return { error: res.error.message };

  const rows = res.value;
  if (rows.length === 0) return { error: 'No data to export for this period' };

  let csv = 'BUPOT_NUMBER,VENDOR_NAME,TAX_CODE,INCOME_TYPE,DPP,TAX_AMOUNT,ISSUE_DATE\n';
  for (const row of rows) {
    csv += `"${row.bupotNumber}","${row.vendorName.replace(/"/g, '""')}","${row.taxCode}","${row.incomeType}","${row.dpp}","${row.taxAmount}","${row.issueDate}"\n`;
  }

  return { csv };
}

/**
 * Export PPh 21 (employee payroll) withholdings for a period as Coretax BP21 bulk XML.
 * Period format: 'YYYY-MM'.
 */
export async function exportBupot21XmlAction(period: string) {
  const t = await getTranslations('tax.bupot21');
  const ctx = await getAuditContext();
  if (!ctx) return { error: t('unauthorized') };

  const res = await exportBupot21Xml(period, ctx);
  if (!res.ok) {
    const known = ['noPayroll', 'noWithholding', 'invalidPeriod', 'exportFailed'];
    const suffix = res.error.message.startsWith('tax.bupot21.')
      ? res.error.message.slice('tax.bupot21.'.length)
      : '';
    return { error: known.includes(suffix) ? t(suffix) : t('exportFailed') };
  }
  return { xml: res.value, filename: `BP21_${period}.xml` };
}

/**
 * Export PPh 23 (vendor) withholdings for a period as Coretax Bukti Potong
 * Unifikasi bulk XML (BPU). Period format: 'YYYY-MM'.
 */
export async function exportBupotUnifikasiXmlAction(period: string) {
  const t = await getTranslations('tax.bupotUnifikasi');
  const ctx = await getAuditContext();
  if (!ctx) return { error: t('unauthorized') };

  const res = await exportBupotUnifikasiXml(period, ctx);
  if (!res.ok) {
    const known = ['noData', 'invalidPeriod', 'exportFailed'];
    const suffix = res.error.message.startsWith('tax.bupotUnifikasi.')
      ? res.error.message.slice('tax.bupotUnifikasi.'.length)
      : '';
    return { error: known.includes(suffix) ? t(suffix) : t('exportFailed') };
  }
  return { xml: res.value, filename: `BPU_${period}.xml` };
}
