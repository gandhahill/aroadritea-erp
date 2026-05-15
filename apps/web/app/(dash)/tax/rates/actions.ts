'use server';

import { getSession } from '@/lib/auth';
import { accounts, asc, db, eq, taxRates } from '@erp/db';
import { requirePermission } from '@erp/services/iam';

export interface TaxRateRow {
  id: string;
  code: string;
  name: Record<string, string>;
  ratePercent: number;
  calculation: string;
  postingAccount: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export async function fetchTaxRates(): Promise<TaxRateRow[]> {
  const session = await getSession();
  if (!session?.user) return [];

  const user = session.user as Record<string, unknown>;
  const userId = String(user.id ?? '');
  const permission = await requirePermission(userId, 'tax.view');
  if (!permission.ok) return [];

  const rows = await db
    .select({
      id: taxRates.id,
      code: taxRates.code,
      name: taxRates.name,
      rateBps: taxRates.rateBps,
      calculation: taxRates.calculation,
      isActive: taxRates.isActive,
      effectiveFrom: taxRates.effectiveFrom,
      effectiveUntil: taxRates.effectiveUntil,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(taxRates)
    .leftJoin(accounts, eq(taxRates.postingAccountId, accounts.id))
    .orderBy(asc(taxRates.code));

  return rows.map((row) => {
    const accountName = row.accountName as Record<string, string> | null;
    const postingAccount = row.accountCode
      ? `${row.accountCode} - ${accountName?.id ?? accountName?.en ?? row.accountCode}`
      : '-';

    return {
      id: row.id,
      code: row.code,
      name: row.name as Record<string, string>,
      ratePercent: row.rateBps / 100,
      calculation: row.calculation,
      postingAccount,
      isActive: row.isActive,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
    };
  });
}
