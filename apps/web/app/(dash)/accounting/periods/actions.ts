'use server';

import { getSession } from '@/lib/auth';
import { and, db, desc, eq, inArray, sql } from '@erp/db';
import { accountingPeriods, journalEntries } from '@erp/db/schema/accounting';
import { requirePermission } from '@erp/services/iam';

export interface AccountingPeriodRow {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
  closedAt: Date | null;
  draftCount: number;
  postedCount: number;
  reversedCount: number;
}

export async function fetchAccountingPeriods(): Promise<AccountingPeriodRow[]> {
  const session = await getSession();
  if (!session?.user) return [];

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const perm = await requirePermission(userId, 'accounting.view');
  if (!perm.ok) return [];

  const periods = await db
    .select({
      id: accountingPeriods.id,
      code: accountingPeriods.code,
      startDate: accountingPeriods.startDate,
      endDate: accountingPeriods.endDate,
      status: accountingPeriods.status,
      closedAt: accountingPeriods.closedAt,
    })
    .from(accountingPeriods)
    .where(eq(accountingPeriods.tenantId, tenantId))
    .orderBy(desc(accountingPeriods.startDate));

  if (periods.length === 0) return [];

  const periodIds = periods.map((period) => period.id);
  const counts = await db
    .select({
      periodId: journalEntries.periodId,
      status: journalEntries.status,
      count: sql<number>`count(*)::int`,
    })
    .from(journalEntries)
    .where(and(eq(journalEntries.tenantId, tenantId), inArray(journalEntries.periodId, periodIds)))
    .groupBy(journalEntries.periodId, journalEntries.status);

  const countsByPeriod = new Map<
    string,
    { draftCount: number; postedCount: number; reversedCount: number }
  >();

  for (const row of counts) {
    const current = countsByPeriod.get(row.periodId) ?? {
      draftCount: 0,
      postedCount: 0,
      reversedCount: 0,
    };

    if (row.status === 'draft') current.draftCount = row.count;
    if (row.status === 'posted') current.postedCount = row.count;
    if (row.status === 'reversed') current.reversedCount = row.count;
    countsByPeriod.set(row.periodId, current);
  }

  return periods.map((period) => ({
    ...period,
    ...(countsByPeriod.get(period.id) ?? {
      draftCount: 0,
      postedCount: 0,
      reversedCount: 0,
    }),
  }));
}
