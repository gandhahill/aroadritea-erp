'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant, requirePermissionAtLocation } from '@/lib/authz';
import { and, db, desc, eq, inArray, isNull } from '@erp/db';
import { pettyCashAccounts, pettyCashTransactions } from '@erp/db/schema/accounting';
import { locations, users } from '@erp/db/schema/auth';
import {
  createPettyCashAccount,
  depositPettyCashToBank,
  recordPettyCashExpense,
  replenishPettyCash,
} from '@erp/services/accounting';
import type { LocaleString } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
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
  createdByName: string | null;
  createdAt: Date;
}

/** Outlets that don't yet have a petty cash account — surface them so
 * the operator can open one per-outlet with its own plafond + opening
 * balance instead of being limited to the user's home location. */
export interface PettyCashEmptyLocation {
  id: string;
  name: string;
  code: string;
}

function pickName(name: unknown, locale: string, fallback: string): string {
  if (!name) return fallback;
  const rec = name as Record<string, string>;
  return rec[locale] ?? rec.id ?? rec.en ?? rec.zh ?? fallback;
}

async function getSessionContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export async function fetchPettyCashAccounts(_tenantId: string): Promise<PettyCashAccountItem[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const scope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.petty_cash.view',
    ctx.tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) return [];

  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  const rows = await db
    .select({
      id: pettyCashAccounts.id,
      locationId: pettyCashAccounts.locationId,
      balance: pettyCashAccounts.balance,
      maxLimit: pettyCashAccounts.maxLimit,
      lastReplenishAt: pettyCashAccounts.lastReplenishAt,
    })
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        scope.global ? undefined : inArray(pettyCashAccounts.locationId, scope.locationIds),
      ),
    );

  const locationIds = rows.map((r) => r.locationId);
  // tenantId filter added — prior query loaded ALL tenants' locations,
  // leaking outlet names across tenants in a multi-tenant deploy.
  const locRows =
    locationIds.length > 0
      ? await db
          .select({ id: locations.id, name: locations.name, code: locations.code })
          .from(locations)
          .where(eq(locations.tenantId, ctx.tenantId))
      : [];
  const locMap = new Map(
    locRows.map((l) => [l.id, { name: l.name as LocaleString, code: l.code }]),
  );

  return rows.map((r) => {
    const balance = r.balance;
    const maxLimit = r.maxLimit;
    const isLowBalance = maxLimit > 0n && balance < (maxLimit * 20n) / 100n;
    const loc = locMap.get(r.locationId);
    return {
      id: r.id,
      locationId: r.locationId,
      locationName: pickName(loc?.name, locale, loc?.code ?? r.locationId),
      balance: balance.toString(),
      maxLimit: maxLimit.toString(),
      isLowBalance,
      lastReplenishAt: r.lastReplenishAt,
    };
  });
}

/**
 * Active store outlets that don't yet have a petty cash account.
 * The UI uses this to render a "Buka Kas Kecil" card per outlet so each
 * outlet can be opened with its own plafond + opening balance.
 */
export async function fetchEmptyPettyCashLocations(
  _tenantId: string,
): Promise<PettyCashEmptyLocation[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const scope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.petty_cash.manage',
    ctx.tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) return [];

  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      code: locations.code,
    })
    .from(locations)
    .leftJoin(
      pettyCashAccounts,
      and(
        eq(pettyCashAccounts.locationId, locations.id),
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
      ),
    )
    .where(
      and(
        eq(locations.tenantId, ctx.tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
        scope.global ? undefined : inArray(locations.id, scope.locationIds),
        isNull(pettyCashAccounts.id),
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    name: pickName(r.name, locale, r.code),
    code: r.code,
  }));
}

export async function fetchPettyCashTransactions(
  accountId: string,
  limit = 50,
): Promise<PettyCashTransactionItem[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];

  // Look up the parent account first so we can tenant-scope the
  // transactions query — otherwise `accountId` from URL params could be
  // pointed at another tenant's account.
  const [account] = await db
    .select({ id: pettyCashAccounts.id, locationId: pettyCashAccounts.locationId })
    .from(pettyCashAccounts)
    .where(and(eq(pettyCashAccounts.id, accountId), eq(pettyCashAccounts.tenantId, ctx.tenantId)))
    .limit(1);
  if (!account) return [];
  const allowed = await requirePermissionAtLocation(
    ctx.userId,
    'accounting.petty_cash.view',
    account.locationId,
  );
  if (!allowed) return [];

  // JOIN against users so the UI shows display names, not UUIDs. The
  // join is tenant-scoped so a stray cross-tenant `users` row can't
  // leak a name into the petty-cash history (defense-in-depth).
  const rows = await db
    .select({
      id: pettyCashTransactions.id,
      kind: pettyCashTransactions.kind,
      amount: pettyCashTransactions.amount,
      description: pettyCashTransactions.description,
      createdById: pettyCashTransactions.createdBy,
      createdByName: users.displayName,
      createdAt: pettyCashTransactions.createdAt,
    })
    .from(pettyCashTransactions)
    .leftJoin(
      users,
      and(eq(users.id, pettyCashTransactions.createdBy), eq(users.tenantId, ctx.tenantId)),
    )
    .where(eq(pettyCashTransactions.accountId, accountId))
    .orderBy(desc(pettyCashTransactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    amount: r.amount.toString(),
    description: r.description,
    // Resolved name only — never expose the raw UUID to operators.
    createdByName: r.createdByName ?? null,
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

export async function replenishAction(locationId: string, amount: number, description: string) {
  const ctx = await getActionContext();
  const result = await replenishPettyCash(
    { locationId, amount: amount.toString(), description: description || 'Isi ulang kas kecil' },
    { ...ctx, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}

export async function expenseAction(locationId: string, amount: number, description: string) {
  const ctx = await getActionContext();
  const result = await recordPettyCashExpense(
    { locationId, amount: amount.toString(), description },
    { ...ctx, locationId },
  );
  if (!result.ok) throw new Error(result.error.messageKey);
  revalidatePath('/accounting/petty-cash');
  return result.value;
}

export async function depositToBankAction(locationId: string, amount: number, description: string) {
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
