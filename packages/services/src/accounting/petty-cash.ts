/**
 * accounting.pettyCash — SD §25.7
 *
 * Petty cash management: one account per location, topup/expense tracking.
 * Warning threshold: balance < maxLimit * 0.2.
 */

import { db } from '@erp/db';
import { accounts, pettyCashAccounts, pettyCashTransactions } from '@erp/db/schema/accounting';
import { posSettings } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { createJournal } from './create-journal';
import { getPostingAccountCodes } from './posting-accounts';
import {
  type CreatePettyCashAccountInput,
  CreatePettyCashAccountSchema,
  type DepositPettyCashToBankInput,
  DepositPettyCashToBankSchema,
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

  return tryCatch(
    async () => {
      const txId = generateId();

      // Atomic decrement guarded by balance >= amount. The neon-http
      // driver doesn't support multi-statement transactions, so we rely
      // on Postgres' per-row write lock to serialize concurrent expenses:
      // either both succeed in order or the second one returns no rows
      // and we surface insufficientBalance to the caller.
      const updated = await db
        .update(pettyCashAccounts)
        .set({
          balance: sql`${pettyCashAccounts.balance} - ${amount}`,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(and(eq(pettyCashAccounts.id, acct.id), gte(pettyCashAccounts.balance, amount)))
        .returning({ balance: pettyCashAccounts.balance });

      const newBalance = updated[0]?.balance;
      if (newBalance === undefined) {
        throw AppError.businessRule('accounting.pettyCash.insufficientBalance', {
          balance: acct.balance.toString(),
          requested: amountStr,
        });
      }

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

      await auditRecord({
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
        ctx,
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

  return tryCatch(
    async () => {
      const txId = generateId();

      // Atomic increment guarded against breaching maxLimit. If two
      // replenishes race, only the one that still fits below the ceiling
      // succeeds; the other surfaces exceedsMaxLimit.
      const updated = await db
        .update(pettyCashAccounts)
        .set({
          balance: sql`${pettyCashAccounts.balance} + ${amount}`,
          lastReplenishAt: new Date(),
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(
          and(
            eq(pettyCashAccounts.id, acct.id),
            sql`${pettyCashAccounts.balance} + ${amount} <= ${pettyCashAccounts.maxLimit}`,
          ),
        )
        .returning({ balance: pettyCashAccounts.balance });

      const newBalance = updated[0]?.balance;
      if (newBalance === undefined) {
        throw AppError.businessRule('accounting.pettyCash.exceedsMaxLimit', {
          maxLimit: acct.maxLimit.toString(),
          currentBalance: acct.balance.toString(),
          topupAmount: amountStr,
        });
      }

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

      await auditRecord({
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
        ctx,
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
 * Deposit cash from the petty-cash account back into the outlet's bank
 * account. Decreases petty cash balance and posts a journal:
 *   DR Bank        <amount>
 *   CR Petty Cash  <amount>
 * The bank account used per outlet is read from posSettings.bankAccountCode
 * (falls back to the generic 1-1200 from the seeded CoA).
 */
export async function depositPettyCashToBank(
  input: DepositPettyCashToBankInput,
  ctx: AuditContext,
): Promise<Result<PettyCashTransactionResult>> {
  const parsed = DepositPettyCashToBankSchema.safeParse(input);
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

  return tryCatch(
    async () => {
      const txId = generateId();

      // Post the journal FIRST. If the period is closed or accounts are
      // missing this rejects without touching the petty-cash balance,
      // keeping the cash register and the General Ledger in sync.
      const journalRes = await postBankDepositJournal(
        { tenantId: ctx.tenantId, locationId, amount },
        ctx,
      );
      if (!journalRes.ok) {
        throw journalRes.error;
      }

      // Atomic decrement (see expense path note). Guards against
      // concurrent setor + expense draining the account below zero.
      const updated = await db
        .update(pettyCashAccounts)
        .set({
          balance: sql`${pettyCashAccounts.balance} - ${amount}`,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(and(eq(pettyCashAccounts.id, acct.id), gte(pettyCashAccounts.balance, amount)))
        .returning({ balance: pettyCashAccounts.balance });

      const newBalance = updated[0]?.balance;
      if (newBalance === undefined) {
        throw AppError.businessRule('accounting.pettyCash.insufficientBalance', {
          balance: acct.balance.toString(),
          requested: amountStr,
        });
      }

      const txRows = await db
        .insert(pettyCashTransactions)
        .values({
          id: txId,
          accountId: acct.id,
          kind: 'deposit_to_bank',
          amount,
          description,
          referenceType: 'bank_deposit',
          referenceId: journalRes.value.id,
          createdBy: ctx.userId,
        })
        .returning();

      await auditRecord({
        action: 'create',
        entityType: 'petty_cash_transaction',
        entityId: txId,
        before: null,
        after: {
          id: txId,
          kind: 'deposit_to_bank',
          amount: amountStr,
          description,
          locationId,
          balanceBefore: acct.balance.toString(),
          balanceAfter: newBalance.toString(),
          journalEntryId: journalRes.value.id,
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        ctx,
      });

      return toTransactionResult(txRows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.pettyCash.depositFailed', e);
    },
  );
}

async function postBankDepositJournal(
  args: { tenantId: string; locationId: string; amount: bigint },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const setting = await db
    .select({ bankCode: posSettings.bankAccountCode })
    .from(posSettings)
    .where(
      and(eq(posSettings.tenantId, args.tenantId), eq(posSettings.locationId, args.locationId)),
    )
    .limit(1)
    .then((rows) => rows[0]);
  const acctCodes = await getPostingAccountCodes(args.tenantId);
  const bankCode = setting?.bankCode ?? acctCodes.bank;
  const pettyCode = acctCodes.pettyCash;

  const accountRows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.tenantId, args.tenantId), eq(accounts.isActive, true)));
  const byCode = new Map(accountRows.map((a) => [a.code, a.id] as const));
  const bankId = byCode.get(bankCode);
  const pettyId = byCode.get(pettyCode);
  if (!bankId || !pettyId) {
    return err(
      AppError.businessRule('accounting.pettyCash.accountsMissing', {
        bankCode,
        pettyCode,
      }),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const journalRes = await createJournal(
    {
      postingDate: today,
      locationId: args.locationId,
      description: 'Setor kas kecil ke bank',
      referenceType: 'manual',
      lines: [
        {
          accountId: bankId,
          locationId: args.locationId,
          description: 'Bank — setoran dari kas kecil',
          debit: args.amount.toString(),
          credit: '0',
        },
        {
          accountId: pettyId,
          locationId: args.locationId,
          description: 'Kas Kecil — disetor ke bank',
          debit: '0',
          credit: args.amount.toString(),
        },
      ],
    },
    ctx,
  );
  if (!journalRes.ok) return journalRes;
  return ok({ id: journalRes.value.id });
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
  const { locationId, maxLimit: maxLimitStr, openingBalance: openingStr } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.petty_cash.manage', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  // Default opening balance to the max limit so cashier always has change
  // ready. A caller may still pass openingBalance: "0" to open empty.
  const openingBalance = BigInt(openingStr ?? maxLimitStr);
  if (openingBalance > BigInt(maxLimitStr)) {
    return err(
      AppError.businessRule('accounting.pettyCash.openingExceedsLimit', {
        maxLimit: maxLimitStr,
        openingBalance: openingBalance.toString(),
      }),
    );
  }

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

      // Auto-journal the cash transfer BEFORE creating the petty-cash
      // account. If the period is closed or the CoA is missing the
      // required accounts, fail fast and leave the books untouched —
      // otherwise the account would open with a balance that has no
      // matching journal entry in the GL.
      //   DR Petty Cash 1-1310
      //   CR Cash       1-1100
      let openingJournalId: string | null = null;
      if (openingBalance > 0n) {
        const journalRes = await postOpeningCashTransfer(
          { tenantId: ctx.tenantId, locationId, amount: openingBalance },
          ctx,
        );
        if (!journalRes.ok) {
          throw journalRes.error;
        }
        openingJournalId = journalRes.value.id;
      }

      const rows = await db
        .insert(pettyCashAccounts)
        .values({
          id: acctId,
          tenantId: ctx.tenantId,
          locationId,
          balance: openingBalance,
          maxLimit,
          lastReplenishAt: openingBalance > 0n ? new Date() : null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      if (openingBalance > 0n) {
        await db.insert(pettyCashTransactions).values({
          id: generateId(),
          accountId: acctId,
          kind: 'topup',
          amount: openingBalance,
          description: 'Pembukaan kas kecil — modal kembalian',
          referenceType: 'opening',
          referenceId: openingJournalId,
          createdBy: ctx.userId,
        });
      }

      await auditRecord({
        action: 'create',
        entityType: 'petty_cash_account',
        entityId: acctId,
        before: null,
        after: {
          id: acctId,
          locationId,
          maxLimit: maxLimitStr,
          balance: openingBalance.toString(),
        },
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        ctx,
      });

      return toAccountResult(rows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.pettyCash.createFailed', e);
    },
  );
}

/**
 * Helper — post a Kas → Kas Kecil journal entry. Resolves the account IDs
 * from the chart of accounts using their codes (default 1-1100 / 1-1310,
 * overridable via posSettings.cashAccountCode). Best-effort: if either
 * account is missing we log a warning but the petty-cash account still
 * opens so the cashier isn't blocked.
 */
async function postOpeningCashTransfer(
  args: { tenantId: string; locationId: string; amount: bigint },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const setting = await db
    .select({ cashCode: posSettings.cashAccountCode })
    .from(posSettings)
    .where(
      and(eq(posSettings.tenantId, args.tenantId), eq(posSettings.locationId, args.locationId)),
    )
    .limit(1)
    .then((rows) => rows[0]);

  const acctCodes = await getPostingAccountCodes(args.tenantId);
  const cashCode = setting?.cashCode ?? acctCodes.cash;
  const pettyCode = acctCodes.pettyCash;

  const accountRows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.tenantId, args.tenantId), eq(accounts.isActive, true)));
  const byCode = new Map(accountRows.map((a) => [a.code, a.id] as const));
  const cashId = byCode.get(cashCode);
  const pettyId = byCode.get(pettyCode);
  if (!cashId || !pettyId) {
    return err(
      AppError.businessRule('accounting.pettyCash.accountsMissing', {
        cashCode,
        pettyCode,
      }),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const journalRes = await createJournal(
    {
      postingDate: today,
      locationId: args.locationId,
      description: 'Pembukaan kas kecil — transfer kas ke kas kecil',
      referenceType: 'manual',
      lines: [
        {
          accountId: pettyId,
          locationId: args.locationId,
          description: 'Kas Kecil — modal kembalian',
          debit: args.amount.toString(),
          credit: '0',
        },
        {
          accountId: cashId,
          locationId: args.locationId,
          description: 'Kas — transfer ke kas kecil',
          debit: '0',
          credit: args.amount.toString(),
        },
      ],
    },
    ctx,
  );
  if (!journalRes.ok) return journalRes;
  return ok({ id: journalRes.value.id });
}
