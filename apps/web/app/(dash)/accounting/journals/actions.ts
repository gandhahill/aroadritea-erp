/**
 * Journal Entries Server Actions — fetches journal data for UI.
 * SD §21.1: Journal Entry editor (table-based).
 */

'use server';

import { getSession } from '@/lib/auth';
import { getActiveLocationOptions } from '@/lib/location-options';
import { and, asc, db, desc, eq, inArray } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
} from '@erp/db/schema/accounting';
import { createJournal } from '@erp/services/accounting';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

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
  /** Preview of the journal lines (account code/name + debit/credit). */
  linesPreview: Array<{
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
  }>;
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

export interface JournalFormAccount {
  id: string;
  code: string;
  name: Record<string, string>;
  normalBalance: string;
}

export interface JournalFormLocation {
  id: string;
  code: string;
  label: string;
}

export interface JournalFormData {
  accounts: JournalFormAccount[];
  locations: JournalFormLocation[];
}

export interface JournalCreateState {
  ok?: boolean;
  error?: string;
  journalId?: string;
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

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: String(user.tenantId ?? 'default'),
    userId: String(user.id ?? ''),
    locationId: String(user.locationId ?? ''),
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : undefined;
}

function money(formData: FormData, key: string) {
  const value = text(formData, key).replace(/[^\d]/g, '');
  return value.length > 0 ? value : '0';
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
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

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const lines = await db
    .select({
      journalEntryId: journalLines.journalEntryId,
      accountCode: accounts.code,
      accountName: accounts.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
      lineNumber: journalLines.lineNo,
    })
    .from(journalLines)
    .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(inArray(journalLines.journalEntryId, ids))
    .orderBy(asc(journalLines.lineNo));

  const linesByJournal = new Map<
    string,
    Array<{ accountCode: string; accountName: string; debit: string; credit: string }>
  >();
  for (const line of lines) {
    const arr = linesByJournal.get(line.journalEntryId) ?? [];
    const nameField = line.accountName as Record<string, string> | null;
    const accountLabel = nameField?.id ?? nameField?.en ?? line.accountCode ?? '—';
    arr.push({
      accountCode: line.accountCode ?? '—',
      accountName: accountLabel,
      debit: String(line.debit ?? '0'),
      credit: String(line.credit ?? '0'),
    });
    linesByJournal.set(line.journalEntryId, arr);
  }

  return rows.map((r) => ({
    ...r,
    totalDebit: String(r.totalDebit),
    createdAt: r.createdAt ?? new Date(0),
    linesPreview: linesByJournal.get(r.id) ?? [],
  }));
}

export async function fetchJournalFormData(): Promise<JournalFormData> {
  const ctx = await getContext();
  if (!ctx) return { accounts: [], locations: [] };

  const perm = await requirePermission(ctx.userId, 'accounting.view');
  if (!perm.ok) return { accounts: [], locations: [] };

  const [accountRows, locations] = await Promise.all([
    db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        normalBalance: accounts.normalBalance,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, ctx.tenantId),
          eq(accounts.isActive, true),
          eq(accounts.isPostable, true),
        ),
      )
      .orderBy(asc(accounts.code)),
    getActiveLocationOptions({ tenantId: ctx.tenantId, locale: 'id' }),
  ]);

  return {
    accounts: accountRows.map((account) => ({
      ...account,
      name: account.name as Record<string, string>,
    })),
    locations,
  };
}

export async function createJournalAction(
  _prev: JournalCreateState | null,
  formData: FormData,
): Promise<JournalCreateState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const locationId = text(formData, 'locationId');
  const lineCount = Number.parseInt(text(formData, 'lineCount'), 10);
  const lines = [];

  for (let index = 0; index < lineCount; index++) {
    const accountId = text(formData, `accountId-${index}`);
    const debit = money(formData, `debit-${index}`);
    const credit = money(formData, `credit-${index}`);
    const description = optionalText(formData, `lineDescription-${index}`);
    const lineLocationId = text(formData, `lineLocationId-${index}`) || locationId;

    if (!accountId && debit === '0' && credit === '0' && !description) continue;
    lines.push({
      accountId,
      locationId: lineLocationId,
      description,
      debit,
      credit,
    });
  }

  const result = await createJournal(
    {
      postingDate: text(formData, 'postingDate'),
      locationId,
      description: text(formData, 'description'),
      referenceType: 'manual',
      referenceId: optionalText(formData, 'referenceId'),
      lines,
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/accounting/journals');
  return { ok: true, journalId: result.value.id };
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
