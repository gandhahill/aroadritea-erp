'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant, requirePermissionAtLocation } from '@/lib/authz';
import { and, asc, db, desc, eq, inArray, isNull } from '@erp/db';
import {
  auditLog,
  bankAccounts,
  bankStatementLines,
  bankStatements,
  journalEntries,
  journalLines,
  locations,
} from '@erp/db';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  return { tenantId, userId };
}

async function requireLocationPermission(
  userId: string,
  permission: string,
  locationId: string,
): Promise<boolean> {
  return requirePermissionAtLocation(userId, permission, locationId);
}

async function getStatementForAccess(ctx: { tenantId: string; userId: string }, id: string) {
  const [statement] = await db
    .select({
      id: bankStatements.id,
      locationId: bankStatements.locationId,
      bankAccountId: bankStatements.bankAccountId,
      status: bankStatements.status,
    })
    .from(bankStatements)
    .where(
      and(
        eq(bankStatements.tenantId, ctx.tenantId),
        eq(bankStatements.id, id),
        isNull(bankStatements.deletedAt),
      ),
    )
    .limit(1);
  return statement ?? null;
}

async function getLineForAccess(ctx: { tenantId: string; userId: string }, lineId: string) {
  const [line] = await db
    .select({
      id: bankStatementLines.id,
      statementId: bankStatementLines.statementId,
      transactionDate: bankStatementLines.transactionDate,
      debit: bankStatementLines.debit,
      credit: bankStatementLines.credit,
      locationId: bankStatements.locationId,
      bankAccountId: bankStatements.bankAccountId,
      coaId: bankAccounts.accountId,
    })
    .from(bankStatementLines)
    .innerJoin(bankStatements, eq(bankStatementLines.statementId, bankStatements.id))
    .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
    .where(
      and(
        eq(bankStatementLines.id, lineId),
        eq(bankStatements.tenantId, ctx.tenantId),
        eq(bankAccounts.tenantId, ctx.tenantId),
        isNull(bankStatements.deletedAt),
      ),
    )
    .limit(1);
  return line ?? null;
}

export async function fetchStatements() {
  const ctx = await getContext();
  if (!ctx) return [];
  const scope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.bank_recon.view',
    ctx.tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) return [];

  const rows = await db
    .select({
      id: bankStatements.id,
      date: bankStatements.statementDate,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      status: bankStatements.status,
      openingBalance: bankStatements.openingBalance,
      closingBalance: bankStatements.closingBalance,
      createdAt: bankStatements.createdAt,
    })
    .from(bankStatements)
    .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
    .where(
      and(
        eq(bankStatements.tenantId, ctx.tenantId),
        isNull(bankStatements.deletedAt),
        scope.global ? undefined : inArray(bankStatements.locationId, scope.locationIds),
      ),
    )
    .orderBy(desc(bankStatements.statementDate));

  return rows;
}

export async function fetchStatementDetails(id: string) {
  const ctx = await getContext();
  if (!ctx) return null;

  const [statement] = await db
    .select({
      id: bankStatements.id,
      date: bankStatements.statementDate,
      bankAccountId: bankStatements.bankAccountId,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      coaId: bankAccounts.accountId,
      status: bankStatements.status,
      openingBalance: bankStatements.openingBalance,
      closingBalance: bankStatements.closingBalance,
      notes: bankStatements.notes,
      locationId: bankStatements.locationId,
    })
    .from(bankStatements)
    .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
    .where(
      and(
        eq(bankStatements.tenantId, ctx.tenantId),
        eq(bankStatements.id, id),
        isNull(bankStatements.deletedAt),
      ),
    )
    .limit(1);

  if (!statement) return null;
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.view',
    statement.locationId,
  );
  if (!allowed) return null;

  const lines = await db
    .select({
      id: bankStatementLines.id,
      date: bankStatementLines.transactionDate,
      description: bankStatementLines.description,
      debit: bankStatementLines.debit,
      credit: bankStatementLines.credit,
      balance: bankStatementLines.runningBalance,
      matchStatus: bankStatementLines.matchStatus,
      matchedJournalEntryId: bankStatementLines.matchedJournalEntryId,
    })
    .from(bankStatementLines)
    .where(eq(bankStatementLines.statementId, id))
    .orderBy(asc(bankStatementLines.transactionDate), asc(bankStatementLines.id));

  return { statement, lines };
}

export async function importBankStatement(input: {
  bankAccountId: string;
  locationId: string;
  statementDate: string;
  openingBalance: string | number;
  closingBalance: string | number;
  notes: string;
  lines: Array<{
    transactionDate: string;
    description: string;
    debitAmount: string | number;
    creditAmount: string | number;
    runningBalance: string | number;
  }>;
}) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  if (!input.bankAccountId || !input.locationId || !input.statementDate) {
    return { success: false, error: 'Informasi utama tidak lengkap.' };
  }
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    input.locationId,
  );
  if (!allowed) return { success: false, error: 'Forbidden' };

  const [[location], [bankAccount]] = await Promise.all([
    db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, ctx.tenantId),
          eq(locations.id, input.locationId),
          eq(locations.status, 'active'),
          isNull(locations.deletedAt),
        ),
      )
      .limit(1),
    db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.tenantId, ctx.tenantId),
          eq(bankAccounts.id, input.bankAccountId),
          eq(bankAccounts.isActive, true),
          isNull(bankAccounts.deletedAt),
        ),
      )
      .limit(1),
  ]);
  if (!location || !bankAccount) return { success: false, error: 'Forbidden' };

  const id = generateId();
  const statementValues = {
    id,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    bankAccountId: input.bankAccountId,
    statementDate: input.statementDate,
    openingBalance: BigInt(input.openingBalance || 0),
    closingBalance: BigInt(input.closingBalance || 0),
    status: 'draft' as const,
    notes: input.notes || null,
    createdBy: ctx.userId,
  };

  const lineValues = input.lines.map((line, idx) => ({
    id: `bsl_${generateId()}`,
    statementId: id,
    lineNo: idx + 1,
    transactionDate: line.transactionDate,
    description: line.description,
    debit: BigInt(line.debitAmount || 0),
    credit: BigInt(line.creditAmount || 0),
    runningBalance: BigInt(line.runningBalance || 0),
    matchStatus: 'unmatched',
  }));

  try {
    await db.transaction(async (tx) => {
      await tx.insert(bankStatements).values(statementValues);
      if (lineValues.length > 0) {
        await tx.insert(bankStatementLines).values(lineValues);
      }
      await tx.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'create',
        entityType: 'bank_statement',
        entityId: id,
        before: null,
        after: { statement: statementValues, linesCount: lineValues.length } as never,
      });
    });
    revalidatePath('/accounting/bank-recon');
    return { success: true, id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan bank statement',
    };
  }
}

export async function matchLine(lineId: string, journalId: string) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  const line = await getLineForAccess(ctx, lineId);
  if (!line) return { success: false, error: 'Forbidden' };
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    line.locationId,
  );
  if (!allowed) return { success: false, error: 'Forbidden' };

  const [journal] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .innerJoin(journalLines, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.id, journalId),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.locationId, line.locationId),
        eq(journalLines.accountId, line.coaId),
        isNull(journalEntries.deletedAt),
      ),
    )
    .limit(1);
  if (!journal) return { success: false, error: 'Forbidden' };

  try {
    const matchedAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(bankStatementLines)
        .set({
          matchStatus: 'matched',
          matchedJournalEntryId: journalId,
          matchedAt,
          matchedBy: ctx.userId,
          updatedAt: matchedAt,
          updatedBy: ctx.userId,
        })
        .where(
          and(
            eq(bankStatementLines.id, lineId),
            eq(bankStatementLines.statementId, line.statementId),
          ),
        );

      await tx
        .update(bankStatements)
        .set({ status: 'in_progress', updatedAt: matchedAt, updatedBy: ctx.userId })
        .where(
          and(eq(bankStatements.id, line.statementId), eq(bankStatements.tenantId, ctx.tenantId)),
        );

      await tx.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'match',
        entityType: 'bank_statement_line',
        entityId: lineId,
        before: { matchStatus: 'unmatched' } as never,
        after: { matchStatus: 'matched', journalId, statementId: line.statementId } as never,
      });
    });

    revalidatePath('/accounting/bank-recon');
    revalidatePath(`/accounting/bank-recon/${line.statementId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal melakukan matching.' };
  }
}

export async function unmatchLine(lineId: string) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Forbidden' };
  const line = await getLineForAccess(ctx, lineId);
  if (!line) return { success: false, error: 'Forbidden' };
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    line.locationId,
  );
  if (!allowed) return { success: false, error: 'Forbidden' };

  try {
    const unmatchedAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(bankStatementLines)
        .set({
          matchStatus: 'unmatched',
          matchedJournalEntryId: null,
          matchedAt: null,
          matchedBy: null,
          updatedAt: unmatchedAt,
          updatedBy: ctx.userId,
        })
        .where(
          and(
            eq(bankStatementLines.id, lineId),
            eq(bankStatementLines.statementId, line.statementId),
          ),
        );

      await tx.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'unmatch',
        entityType: 'bank_statement_line',
        entityId: lineId,
        before: { statementId: line.statementId } as never,
        after: { matchStatus: 'unmatched', statementId: line.statementId } as never,
      });
    });

    revalidatePath('/accounting/bank-recon');
    revalidatePath(`/accounting/bank-recon/${line.statementId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal membatalkan matching.' };
  }
}

export async function finalizeStatement(id: string) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Forbidden' };
  const statement = await getStatementForAccess(ctx, id);
  if (!statement) return { success: false, error: 'Forbidden' };
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    statement.locationId,
  );
  if (!allowed) return { success: false, error: 'Forbidden' };

  try {
    const reconciledAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(bankStatements)
        .set({
          status: 'reconciled',
          reconciledAt,
          reconciledBy: ctx.userId,
          updatedAt: reconciledAt,
          updatedBy: ctx.userId,
        })
        .where(and(eq(bankStatements.id, id), eq(bankStatements.tenantId, ctx.tenantId)));

      await tx.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'finalize',
        entityType: 'bank_statement',
        entityId: id,
        before: { status: statement.status } as never,
        after: { status: 'reconciled', locationId: statement.locationId } as never,
      });
    });

    revalidatePath('/accounting/bank-recon');
    revalidatePath(`/accounting/bank-recon/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menyelesaikan rekonsiliasi.' };
  }
}

export async function deleteStatement(id: string) {
  const ctx = await getContext();
  if (!ctx) return { success: false, error: 'Forbidden' };
  const statement = await getStatementForAccess(ctx, id);
  if (!statement) return { success: false, error: 'Forbidden' };
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    statement.locationId,
  );
  if (!allowed) return { success: false, error: 'Forbidden' };

  try {
    const deletedAt = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(bankStatements)
        .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
        .where(and(eq(bankStatements.id, id), eq(bankStatements.tenantId, ctx.tenantId)));

      await tx.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'delete',
        entityType: 'bank_statement',
        entityId: id,
        before: { status: statement.status, locationId: statement.locationId } as never,
        after: { deletedAt } as never,
      });
    });
    revalidatePath('/accounting/bank-recon');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus rekonsiliasi.' };
  }
}

// Simple fetcher for Active bank accounts + locations to populate the import form
export async function fetchImportMasterData() {
  const ctx = await getContext();
  if (!ctx) return { bankAccounts: [], locations: [] };
  const scope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.bank_recon.manage',
    ctx.tenantId,
  );
  if (!scope.global && scope.locationIds.length === 0) {
    return { bankAccounts: [], locations: [] };
  }

  const activeAccounts = await db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.bankName,
      number: bankAccounts.accountNumber,
    })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.tenantId, ctx.tenantId),
        eq(bankAccounts.isActive, true),
        isNull(bankAccounts.deletedAt),
      ),
    );

  const activeLocationsRaw = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, ctx.tenantId),
        eq(locations.status, 'active'),
        scope.global ? undefined : inArray(locations.id, scope.locationIds),
        isNull(locations.deletedAt),
      ),
    );

  const activeLocations = activeLocationsRaw.map((l) => ({
    ...l,
    name: l.name as { id: string; en: string; zh: string },
  }));

  return { bankAccounts: activeAccounts, locations: activeLocations };
}

export async function fetchJournalSuggestions(lineId: string) {
  const ctx = await getContext();
  if (!ctx) return [];

  const line = await getLineForAccess(ctx, lineId);
  if (!line) return [];
  const allowed = await requireLocationPermission(
    ctx.userId,
    'accounting.bank_recon.manage',
    line.locationId,
  );
  if (!allowed) return [];

  // Match logic: If Bank Statement line is Credit (out), the journal should have Credit on Bank COA.
  // We'll search journalLines where accountId = statement.coaId, amount matches, and date is nearby.
  const isDebit = Number(line.debit) > 0;
  const amountToMatch = isDebit ? line.debit : line.credit;

  // We look for journal entries around that date. Simplified: match by exact amount and coaId.
  const suggestions = await db
    .select({
      id: journalEntries.id,
      date: journalEntries.postingDate,
      description: journalEntries.description,
      amount: isDebit ? journalLines.debit : journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.locationId, line.locationId),
        eq(journalLines.accountId, line.coaId),
        eq(isDebit ? journalLines.debit : journalLines.credit, amountToMatch),
        isNull(journalEntries.deletedAt),
      ),
    )
    .orderBy(desc(journalEntries.postingDate))
    .limit(10);

  return suggestions;
}
