'use server';

import { getSession } from '@/lib/auth';
import { and, asc, db, desc, eq, inArray, isNull, sql } from '@erp/db';
import {
  accounts,
  auditLog,
  bankAccounts,
  bankStatementLines,
  bankStatements,
  journalEntries,
  journalLines,
  locations,
} from '@erp/db';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

async function requireContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const perm = await requirePermission(userId, 'accounting.bank_recon.manage');
  if (perm.ok) return { tenantId, userId };
  return null;
}

export async function fetchStatements() {
  const ctx = await requireContext();
  if (!ctx) return [];

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
    .where(and(eq(bankStatements.tenantId, ctx.tenantId), isNull(bankStatements.deletedAt)))
    .orderBy(desc(bankStatements.statementDate));

  return rows;
}

export async function fetchStatementDetails(id: string) {
  const ctx = await requireContext();
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
    .where(and(eq(bankStatements.tenantId, ctx.tenantId), eq(bankStatements.id, id), isNull(bankStatements.deletedAt)))
    .limit(1);

  if (!statement) return null;

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
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  if (!input.bankAccountId || !input.locationId || !input.statementDate) {
    return { success: false, error: 'Informasi utama tidak lengkap.' };
  }

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
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  try {
    await db
      .update(bankStatementLines)
      .set({
        matchStatus: 'matched',
        matchedJournalEntryId: journalId,
        matchedAt: new Date(),
        matchedBy: ctx.userId,
      })
      .where(eq(bankStatementLines.id, lineId));

    // Mark statement as in_progress if not already
    const [line] = await db.select({ statementId: bankStatementLines.statementId }).from(bankStatementLines).where(eq(bankStatementLines.id, lineId));
    if (line) {
       await db.update(bankStatements).set({ status: 'in_progress' }).where(eq(bankStatements.id, line.statementId));
    }

    revalidatePath('/accounting/bank-recon');
    revalidatePath(`/accounting/bank-recon/${line?.statementId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal melakukan matching.' };
  }
}

export async function unmatchLine(lineId: string) {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  try {
    await db
      .update(bankStatementLines)
      .set({
        matchStatus: 'unmatched',
        matchedJournalEntryId: null,
        matchedAt: null,
        matchedBy: null,
      })
      .where(eq(bankStatementLines.id, lineId));

    revalidatePath('/accounting/bank-recon');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal membatalkan matching.' };
  }
}

export async function finalizeStatement(id: string) {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  try {
    await db
      .update(bankStatements)
      .set({ status: 'reconciled', updatedAt: new Date(), updatedBy: ctx.userId })
      .where(and(eq(bankStatements.id, id), eq(bankStatements.tenantId, ctx.tenantId)));

    revalidatePath('/accounting/bank-recon');
    revalidatePath(`/accounting/bank-recon/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menyelesaikan rekonsiliasi.' };
  }
}

export async function deleteStatement(id: string) {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Forbidden' };

  try {
    const deletedAt = new Date();
    await db
      .update(bankStatements)
      .set({ deletedAt, updatedAt: deletedAt, updatedBy: ctx.userId })
      .where(and(eq(bankStatements.id, id), eq(bankStatements.tenantId, ctx.tenantId)));
    revalidatePath('/accounting/bank-recon');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus rekonsiliasi.' };
  }
}

// Simple fetcher for Active bank accounts + locations to populate the import form
export async function fetchImportMasterData() {
  const ctx = await requireContext();
  if (!ctx) return { bankAccounts: [], locations: [] };

  const activeAccounts = await db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.bankName,
      number: bankAccounts.accountNumber,
    })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, ctx.tenantId), eq(bankAccounts.isActive, true), isNull(bankAccounts.deletedAt)));

  const activeLocationsRaw = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active'), isNull(locations.deletedAt)));

  const activeLocations = activeLocationsRaw.map((l) => ({
    ...l,
    name: l.name as { id: string; en: string; zh: string },
  }));

  return { bankAccounts: activeAccounts, locations: activeLocations };
}

export async function fetchJournalSuggestions(lineId: string) {
  const ctx = await requireContext();
  if (!ctx) return [];

  const [line] = await db
    .select({
      date: bankStatementLines.transactionDate,
      debit: bankStatementLines.debit,
      credit: bankStatementLines.credit,
      statementId: bankStatementLines.statementId,
    })
    .from(bankStatementLines)
    .where(eq(bankStatementLines.id, lineId))
    .limit(1);

  if (!line) return [];

  const [statement] = await db
    .select({ coaId: bankAccounts.accountId })
    .from(bankStatements)
    .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
    .where(eq(bankStatements.id, line.statementId))
    .limit(1);

  if (!statement) return [];

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
        eq(journalLines.accountId, statement.coaId),
        eq(isDebit ? journalLines.debit : journalLines.credit, amountToMatch),
        isNull(journalEntries.deletedAt)
      )
    )
    .orderBy(desc(journalEntries.postingDate))
    .limit(10);

  return suggestions;
}

