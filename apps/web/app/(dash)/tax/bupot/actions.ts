'use server';

import { getSession } from '@/lib/auth';
import { listBuktiPotong } from '@erp/services/tax';
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
