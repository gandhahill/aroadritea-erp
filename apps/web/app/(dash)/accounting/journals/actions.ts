/**
 * Journal Entries Server Actions — fetches journal data for UI.
 * SD §21.1: Journal Entry editor (table-based).
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, db, desc, eq } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
} from '@erp/db/schema/accounting';
import { requirePermission } from '@erp/services/iam';

export interface JournalListItem {
  id: string;
  number: string;
  postingDate: string;
  status: string;
  description: string;
  referenceType: string | null;
  locationId: string;
  totalDebit: string;
  createdAt: Date;
}

export interface JournalLineDetail {
  id: string;
  accountCode: string;
  accountName: Record<string, string>;
  description: string | null;
  debit: string;
  credit: string;
  locationId: string;
}

export interface JournalDetail {
  id: string;
  number: string;
  postingDate: string;
  status: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  locationId: string;
  totalDebit: string;
  totalCredit: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lines: JournalLineDetail[];
}

async function getContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: String(user.tenantId ?? 'default'),
    userId: String(user.id ?? ''),
  };
}

/**
 * Fetch journal entries list for a tenant, ordered by most recent.
 */
export async function fetchJournalList(): Promise<JournalListItem[]> {
  const ctx = await getContext();
  if (!ctx) return [];
  const perm = await requirePermission(ctx.userId, 'accounting.view');
  if (!perm.ok) return [];

  const rows = await db
    .select({
      id: journalEntries.id,
      number: journalEntries.number,
      postingDate: journalEntries.postingDate,
      status: journalEntries.status,
      description: journalEntries.description,
      referenceType: journalEntries.referenceType,
      locationId: journalEntries.locationId,
      totalDebit: journalEntries.totalDebit,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .where(eq(journalEntries.tenantId, ctx.tenantId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(100);

  return rows.map((r) => ({
    ...r,
    totalDebit: String(r.totalDebit),
    createdAt: r.createdAt ?? new Date(0),
  }));
}

/**
 * Fetch a single journal entry with all its lines.
 */
export async function fetchJournalDetail(journalId: string): Promise<JournalDetail | null> {
  const ctx = await getContext();
  if (!ctx) return null;

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.tenantId, ctx.tenantId), eq(journalEntries.id, journalId)))
    .limit(1);

  if (!entry) return null;

  const perm = await requirePermission(ctx.userId, 'accounting.view', {
    locationId: entry.locationId,
  });
  if (!perm.ok) return null;

  const lines = await db
    .select({
      id: journalLines.id,
      accountId: journalLines.accountId,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      locationId: journalLines.locationId,
    })
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, journalId));

  // Fetch account details for display
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const acctRows =
    accountIds.length > 0
      ? await db
          .select({ id: accounts.id, code: accounts.code, name: accounts.name })
          .from(accounts)
          .where(eq(accounts.tenantId, ctx.tenantId))
      : [];

  const acctMap = new Map(acctRows.map((a) => [a.id, a]));

  return {
    id: entry.id,
    number: entry.number,
    postingDate: entry.postingDate,
    status: entry.status,
    description: entry.description,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    locationId: entry.locationId,
    totalDebit: String(entry.totalDebit),
    totalCredit: String(entry.totalCredit),
    version: entry.version,
    createdAt: entry.createdAt ?? new Date(0),
    updatedAt: entry.updatedAt ?? new Date(0),
    lines: lines.map((l) => {
      const acct = acctMap.get(l.accountId);
      return {
        id: l.id,
        accountCode: acct?.code ?? l.accountId,
        accountName: (acct?.name ?? { id: 'Unknown', en: 'Unknown' }) as Record<string, string>,
        description: l.description,
        debit: String(l.debit),
        credit: String(l.credit),
        locationId: l.locationId,
      };
    }),
  };
}
