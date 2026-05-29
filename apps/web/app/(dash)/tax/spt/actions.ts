'use server';

import { getSession } from '@/lib/auth';
import { calculateSptMasa, getVatLedger, exportSptMasaCsv, type SptMasaSummary, type VatLedgerRow } from '@erp/services/tax';
import type { AuditContext } from '@erp/shared/types';
import { db } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { desc, eq, and, isNull } from '@erp/db';

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

export interface PeriodOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export async function fetchPeriodsAction(): Promise<PeriodOption[]> {
  const ctx = await getAuditContext();
  if (!ctx) return [];
  const rows = await db.select({
    id: accountingPeriods.id,
    code: accountingPeriods.code,
    status: accountingPeriods.status,
  }).from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.tenantId, ctx.tenantId),
        isNull(accountingPeriods.deletedAt)
      )
    )
    .orderBy(desc(accountingPeriods.startDate));

  return rows.map(r => ({
    id: r.id,
    code: r.code,
    name: r.code,
    status: r.status,
  }));
}

export async function calculateSptMasaAction(periodId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await calculateSptMasa(periodId, ctx);
  if (!res.ok) return { error: res.error.message };
  return { summary: res.value };
}

export async function fetchVatLedgerAction(periodId: string, type: 'in' | 'out') {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await getVatLedger(periodId, type, ctx);
  if (!res.ok) return { error: res.error.message };
  return { rows: res.value };
}

export async function exportSptMasaAction(periodId: string) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthorized' };

  const res = await exportSptMasaCsv(periodId, ctx);
  if (!res.ok) return { error: res.error.message };
  return { csv: res.value };
}
