/**
 * accounting.pettyCash — SD §25.7
 *
 * Petty cash management: one account per location, topup/expense tracking.
 * Warning threshold: balance < maxLimit * 0.2.
 */

import { db } from '@erp/db';
import { pettyCashAccounts, pettyCashTransactions } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq } from 'drizzle-orm';
import { requirePermission } from '../iam';
import {
  type CreatePettyCashAccountInput,
  CreatePettyCashAccountSchema,
  type ListPettyCashTransactionsInput,
  ListPettyCashTransactionsSchema,
  type RecordPettyCashExpenseInput,
  RecordPettyCashExpenseSchema,
  type ReplenishPettyCashInput,
  ReplenishPettyCashSchema,
} from './schemas';

// --- Return types ---

export interface PettyCashAccountResult {
  id: string;
  locationId: string;
  balance: string;
  maxLimit: string;
  lastReplenishAt: string | null;
  isLowBalance: boolean;
}

export interface PettyCashTransactionResult {
  id: string;
  accountId: string;
  kind: string;
  amount: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PettyCashTransactionListResult {
  items: PettyCashTransactionResult[];
  total: number;
}

// --- Helpers ---

function toAccountResult(row: typeof pettyCashAccounts.$inferSelect): PettyCashAccountResult {
  const balance = row.balance;
  const maxLimit = row.maxLimit;
  const isLowBalance = maxLimit > 0n && balance < (maxLimit * 20n) / 100n;
  return {
    id: row.id,
    locationId: row.locationId,
    balance: balance.toString(),
    maxLimit: maxLimit.toString(),
    lastReplenishAt: row.lastReplenishAt?.toISOString() ?? null,
    isLowBalance,
  };
}

function toTransactionResult(
  row: typeof pettyCashTransactions.$inferSelect,
): PettyCashTransactionResult {
  return {
    id: row.id,
    accountId: row.accountId,
    kind: row.kind,
    amount: row.amount.toString(),
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

// --- Service functions ---

/**
 * Get petty cash balance for a location.
 */
export async function getPettyCashBalance(
  locationId: string,
  ctx: AuditContext,
): Promise<Result<PettyCashAccountResult>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.view', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const rows = await db
    .select()
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        eq(pettyCashAccounts.locationId, locationId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return err(AppError.notFound('accounting.pettyCash.accountNotFound', { locationId }));
  }

  return ok(toAccountResult(row));
}

/**
 * List petty cash transactions for a location (paginated, newest first).
 */
export async function listPettyCashTransactions(
  input: ListPettyCashTransactionsInput,
  ctx: AuditContext,
): Promise<Result<PettyCashTransactionListResult>> {
  const parsed = ListPettyCashTransactionsSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.pettyCash.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { locationId, limit, offset } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.view', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const account = await db
    .select({ id: pettyCashAccounts.id })
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        eq(pettyCashAccounts.locationId, locationId),
      ),
    )
    .limit(1);

  const acctRow = account[0];
  if (!acctRow) {
    return err(AppError.notFound('accounting.pettyCash.accountNotFound', { locationId }));
  }

  const accountId = acctRow.id;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(pettyCashTransactions)
      .where(eq(pettyCashTransactions.accountId, accountId))
      .orderBy(desc(pettyCashTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: pettyCashTransactions.id })
      .from(pettyCashTransactions)
      .where(eq(pettyCashTransactions.accountId, accountId)),
  ]);

  return ok({
    items: rows.map(toTransactionResult),
    total: countResult.length,
  });
}

/**
 * Record a petty cash expense — deducts balance.
 */
export async function recordPettyCashExpense(
  input: RecordPettyCashExpenseInput,
  ctx: AuditContext,
): Promise<Result<PettyCashTransactionResult>> {
  const parsed = RecordPettyCashExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.pettyCash.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { locationId, amount: amountStr, description } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.expense', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const amount = BigInt(amountStr);

  const account = await db
    .select()
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        eq(pettyCashAccounts.locationId, locationId),
      ),
    )
    .limit(1);

  const acct = account[0];
  if (!acct) {
    return err(AppError.notFound('accounting.pettyCash.accountNotFound', { locationId }));
  }

  if (acct.balance < amount) {
    return err(
      AppError.businessRule('accounting.pettyCash.insufficientBalance', {
        balance: acct.balance.toString(),
        requested: amountStr,
      }),
    );
  }

  return tryCatch(
    async () => {
      const txId = generateId();
      const newBalance = acct.balance - amount;

      await db
        .update(pettyCashAccounts)
        .set({
          balance: newBalance,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(pettyCashAccounts.id, acct.id));

      const txRows = await db
        .insert(pettyCashTransactions)
        .values({
          id: txId,
          accountId: acct.id,
          kind: 'expense',
          amount,
          description,
          createdBy: ctx.userId,
        })
        .returning();

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'petty_cash_transaction',
        entityId: txId,
        before: null,
        after: {
          id: txId,
          kind: 'expense',
          amount: amountStr,
          description,
          locationId,
          balanceBefore: acct.balance.toString(),
          balanceAfter: newBalance.toString(),
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      return toTransactionResult(txRows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.pettyCash.expenseFailed', e);
    },
  );
}

/**
 * Replenish (topup) petty cash — increases balance.
 */
export async function replenishPettyCash(
  input: ReplenishPettyCashInput,
  ctx: AuditContext,
): Promise<Result<PettyCashTransactionResult>> {
  const parsed = ReplenishPettyCashSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.pettyCash.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { locationId, amount: amountStr, description } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.replenish', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const amount = BigInt(amountStr);

  const account = await db
    .select()
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        eq(pettyCashAccounts.locationId, locationId),
      ),
    )
    .limit(1);

  const acct = account[0];
  if (!acct) {
    return err(AppError.notFound('accounting.pettyCash.accountNotFound', { locationId }));
  }

  const newBalance = acct.balance + amount;

  if (newBalance > acct.maxLimit) {
    return err(
      AppError.businessRule('accounting.pettyCash.exceedsMaxLimit', {
        maxLimit: acct.maxLimit.toString(),
        currentBalance: acct.balance.toString(),
        topupAmount: amountStr,
        resultingBalance: newBalance.toString(),
      }),
    );
  }

  return tryCatch(
    async () => {
      const txId = generateId();

      await db
        .update(pettyCashAccounts)
        .set({
          balance: newBalance,
          lastReplenishAt: new Date(),
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(pettyCashAccounts.id, acct.id));

      const txRows = await db
        .insert(pettyCashTransactions)
        .values({
          id: txId,
          accountId: acct.id,
          kind: 'topup',
          amount,
          description,
          createdBy: ctx.userId,
        })
        .returning();

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'petty_cash_transaction',
        entityId: txId,
        before: null,
        after: {
          id: txId,
          kind: 'topup',
          amount: amountStr,
          description,
          locationId,
          balanceBefore: acct.balance.toString(),
          balanceAfter: newBalance.toString(),
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      return toTransactionResult(txRows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.pettyCash.replenishFailed', e);
    },
  );
}

/**
 * Create a petty cash account for a location. One per location.
 */
export async function createPettyCashAccount(
  input: CreatePettyCashAccountInput,
  ctx: AuditContext,
): Promise<Result<PettyCashAccountResult>> {
  const parsed = CreatePettyCashAccountSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.pettyCash.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const { locationId, maxLimit: maxLimitStr } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.manage', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const existing = await db
    .select({ id: pettyCashAccounts.id })
    .from(pettyCashAccounts)
    .where(
      and(
        eq(pettyCashAccounts.tenantId, ctx.tenantId),
        eq(pettyCashAccounts.locationId, locationId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return err(AppError.conflict('accounting.pettyCash.accountAlreadyExists', { locationId }));
  }

  return tryCatch(
    async () => {
      const acctId = generateId();
      const maxLimit = BigInt(maxLimitStr);

      const rows = await db
        .insert(pettyCashAccounts)
        .values({
          id: acctId,
          tenantId: ctx.tenantId,
          locationId,
          balance: 0n,
          maxLimit,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'petty_cash_account',
        entityId: acctId,
        before: null,
        after: {
          id: acctId,
          locationId,
          maxLimit: maxLimitStr,
          balance: '0',
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
      });

      return toAccountResult(rows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.pettyCash.createFailed', e);
    },
  );
}
