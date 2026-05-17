'use server';

import { and, db, desc, eq } from '@erp/db';
import { pettyCashAccounts, pettyCashTransactions } from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import type { LocaleString } from '@erp/shared/types';
import { getSession } from '@/lib/auth';
import {
  createPettyCashAccount,
  depositPettyCashToBank,
  recordPettyCashExpense,
  replenishPettyCash,
} from '@erp/services/accounting';
import { revalidatePath } from 'next/cache';

export interface PettyCashAccountItem {
  id: string;
  locationId: string;
  locationName: string;
  balance: string;
  maxLimit: string;
  isLowBalance: boolean;
  lastReplenishAt: Date | null;
}

export interface PettyCashTransactionItem {
  id: string;
  kind: string;
  amount: string;
  description: string;
  createdBy: string | null;
  createdAt: Date;
}

export async function fetchPettyCashAccounts(tenantId: string): Promise<PettyCashAccountItem[]> {
  const rows = await db
    .select({
      id: pettyCashAccounts.id,
      locationId: pettyCashAccounts.locationId,
      balance: pettyCashAccounts.balance,
      maxLimit: pettyCashAccounts.maxLimit,
      lastReplenishAt: pettyCashAccounts.lastReplenishAt,
    })
    .from(pettyCashAccounts)
    .where(eq(pettyCashAccounts.tenantId, tenantId));

  const locationIds = rows.map((r) => r.locationId);
  const locRows =
    locationIds.length > 0
      ? await db.select({ id: locations.id, name: locations.name }).from(locations)
      : [];
  const locMap = new Map(locRows.map((l) => [l.id, l.name as LocaleString]));

  return rows.map((r) => {
    const balance = r.balance;
    const maxLimit = r.maxLimit;
    const isLowBalance = maxLimit > 0n && balance < (maxLimit * 20n) / 100n;
    const locName = locMap.get(r.locationId);
    return {
      id: r.id,
      locationId: r.locationId,
      locationName: locName?.id ?? r.locationId,
      balance: balance.toString(),
      maxLimit: maxLimit.toString(),
      isLowBalance,
      lastReplenishAt: r.lastReplenishAt,
    };
  });
}

export async function fetchPettyCashTransactions(
  accountId: string,
  limit = 50,
): Promise<PettyCashTransactionItem[]> {
  const rows = await db
    .select({
      id: pettyCashTransactions.id,
      kind: pettyCashTransactions.kind,
      amount: pettyCashTransactions.amount,
      description: pettyCashTransactions.description,
      createdBy: pettyCashTransactions.createdBy,
      createdAt: pettyCashTransactions.createdAt,
    })
    .from(pettyCashTransactions)
    .where(eq(pettyCashTransactions.accountId, accountId))
    .orderBy(desc(pettyCashTransactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: r.amount.toString(),
    description: r.description,
    createdBy: r.createdBy,
    createdAt: r.createdAt ?? new Date(0),
  }));
}

export async function createAccountAction(
  locationId: string,
  maxLimit: number,
  openingBalance: number,
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');

  const result = await createPettyCashAccount(
    {
      locationId,
      maxLimit: maxLimit.toString(),
      openingBalance: openingBalance.toString(),
    },
    { userId, tenantId, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}

async function getActionContext() {
  const session = await getSession();
  if (!session) throw new Error('Unauthenticated');
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export async function replenishAction(
  locationId: string,
  amount: number,
  description: string,
) {
  const ctx = await getActionContext();
  const result = await replenishPettyCash(
    { locationId, amount: amount.toString(), description: description || 'Isi ulang kas kecil' },
    { ...ctx, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}

export async function expenseAction(
  locationId: string,
  amount: number,
  description: string,
) {
  const ctx = await getActionContext();
  const result = await recordPettyCashExpense(
    { locationId, amount: amount.toString(), description },
    { ...ctx, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}

export async function depositToBankAction(
  locationId: string,
  amount: number,
  description: string,
) {
  const ctx = await getActionContext();
  const result = await depositPettyCashToBank(
    {
      locationId,
      amount: amount.toString(),
      description: description || 'Setor kas kecil ke bank',
    },
    { ...ctx, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}
