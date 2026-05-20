'use server';

import { getSession } from '@/lib/auth';
import { and, asc, desc, eq, inArray, isNull, auditLog, cmsSettings, db } from '@erp/db';
import { accounts, journalEntries, journalLines, partners } from '@erp/db/schema/accounting';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export type PartyLedgerKind = 'payables' | 'receivables';

export interface PartyLedgerAccountOption {
  id: string;
  code: string;
  name: Record<string, string>;
  type: string;
  subtype: string;
  selected: boolean;
}

export interface PartyLedgerRow {
  partnerId: string | null;
  partnerName: string;
  total: string;
  current: string;
  days1To30: string;
  days31To60: string;
  over60: string;
  accountBreakdown: Array<{
    accountId: string;
    accountCode: string;
    accountName: Record<string, string>;
    amount: string;
  }>;
  entries: PartyLedgerEntry[];
}

export interface PartyLedgerEntry {
  journalLineId: string;
  journalNumber: string;
  postingDate: string;
  dueDate: string | null;
  reminderDaysBefore: number | null;
  accountCode: string;
  amount: string;
  ageDays: number;
}

export interface PartyLedgerData {
  kind: PartyLedgerKind;
  accountOptions: PartyLedgerAccountOption[];
  selectedAccountIds: string[];
  rows: PartyLedgerRow[];
  totalOutstanding: string;
  allowanceRatesBps: {
    current: number;
    days1To30: number;
    days31To60: number;
    over60: number;
  };
  allowanceEstimate: {
    current: string;
    days1To30: string;
    days31To60: string;
    over60: string;
    total: string;
  } | null;
}

const SETTING_KEYS: Record<PartyLedgerKind, string> = {
  payables: 'accounting.payables.accountIds',
  receivables: 'accounting.receivables.accountIds',
};
const RECEIVABLE_ALLOWANCE_KEY = 'accounting.receivables.allowanceRatesBps';
const DEFAULT_ALLOWANCE_RATES = {
  current: 0,
  days1To30: 100,
  days31To60: 500,
  over60: 2500,
};

async function getAccountingContext(requiredPermission: string) {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');
  const userId = String(user.id ?? '');
  const perm = await requirePermission(userId, requiredPermission);
  if (!perm.ok) return null;
  return { tenantId, userId };
}

export async function getPartyLedgerData(kind: PartyLedgerKind): Promise<PartyLedgerData> {
  const ctx = await getAccountingContext('accounting.view');
  if (!ctx) {
    return {
      kind,
      accountOptions: [],
      selectedAccountIds: [],
      rows: [],
      totalOutstanding: '0',
      allowanceRatesBps: DEFAULT_ALLOWANCE_RATES,
      allowanceEstimate: null,
    };
  }

  const accountType = kind === 'receivables' ? 'asset' : 'liability';
  const fallbackSubtype = kind === 'receivables' ? 'receivable' : 'payable';

  const [setting] = await db
    .select({ value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, ctx.tenantId), eq(cmsSettings.key, SETTING_KEYS[kind])))
    .limit(1);
  const [allowanceSetting] =
    kind === 'receivables'
      ? await db
          .select({ value: cmsSettings.value })
          .from(cmsSettings)
          .where(
            and(eq(cmsSettings.tenantId, ctx.tenantId), eq(cmsSettings.key, RECEIVABLE_ALLOWANCE_KEY)),
          )
          .limit(1)
      : [undefined];
  const allowanceRatesBps = parseAllowanceRates(allowanceSetting?.value);

  const storedIds = Array.isArray(setting?.value)
    ? setting.value.filter((value): value is string => typeof value === 'string')
    : [];

  const accountRows = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      subtype: accounts.subtype,
      isActive: accounts.isActive,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.type, accountType),
        eq(accounts.isPostable, true),
        eq(accounts.isActive, true),
        isNull(accounts.deletedAt),
      ),
    )
    .orderBy(asc(accounts.code));

  const fallbackIds = accountRows
    .filter((account) => account.subtype === fallbackSubtype)
    .map((account) => account.id);
  const selectedAccountIds = storedIds.length > 0 ? storedIds : fallbackIds;
  const selectedSet = new Set(selectedAccountIds);

  const accountOptions = accountRows.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name as Record<string, string>,
    type: account.type,
    subtype: account.subtype,
    selected: selectedSet.has(account.id),
  }));

  if (selectedAccountIds.length === 0) {
    return {
      kind,
      accountOptions,
      selectedAccountIds,
      rows: [],
      totalOutstanding: '0',
      allowanceRatesBps,
      allowanceEstimate: kind === 'receivables' ? emptyAllowanceEstimate() : null,
    };
  }

  const lineRows = await db
    .select({
      journalLineId: journalLines.id,
      journalNumber: journalEntries.number,
      partnerId: journalLines.partnerId,
      partnerName: partners.name,
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      postingDate: journalEntries.postingDate,
      dueDate: journalLines.dueDate,
      reminderDaysBefore: journalLines.reminderDaysBefore,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .leftJoin(
      partners,
      and(eq(partners.id, journalLines.partnerId), eq(partners.tenantId, ctx.tenantId)),
    )
    .where(
      and(
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'posted'),
        inArray(journalLines.accountId, selectedAccountIds),
      ),
    )
    .orderBy(desc(journalEntries.postingDate), asc(accounts.code));

  const byPartner = new Map<string, PartyLedgerRow>();
  const positiveByPartner = new Map<string, PartyLedgerEntry[]>();
  const negativeByPartner = new Map<string, bigint>();
  const today = new Date();

  for (const line of lineRows) {
    const amount =
      kind === 'receivables' ? line.debit - line.credit : line.credit - line.debit;
    if (amount === 0n) continue;

    const key = line.partnerId ?? '__no_partner__';
    const existing =
      byPartner.get(key) ??
      ({
        partnerId: line.partnerId,
        partnerName: line.partnerName ?? 'Tanpa partner',
        total: '0',
        current: '0',
        days1To30: '0',
        days31To60: '0',
        over60: '0',
        accountBreakdown: [],
        entries: [],
      } satisfies PartyLedgerRow);

    const signedTotal = BigInt(existing.total) + amount;
    existing.total = signedTotal.toString();

    if (amount > 0n) {
      const basisDate = String(line.dueDate ?? line.postingDate);
      const entry: PartyLedgerEntry = {
        journalLineId: line.journalLineId,
        journalNumber: line.journalNumber,
        postingDate: String(line.postingDate),
        dueDate: line.dueDate ? String(line.dueDate) : null,
        reminderDaysBefore: line.reminderDaysBefore,
        accountCode: line.accountCode,
        amount: amount.toString(),
        ageDays: daysBetween(basisDate, today),
      };
      const entries = positiveByPartner.get(key) ?? [];
      entries.push(entry);
      positiveByPartner.set(key, entries);
    } else if (amount < 0n) {
      negativeByPartner.set(key, (negativeByPartner.get(key) ?? 0n) + -amount);
    }

    const breakdown = existing.accountBreakdown.find((entry) => entry.accountId === line.accountId);
    if (breakdown) {
      breakdown.amount = (BigInt(breakdown.amount) + amount).toString();
    } else {
      existing.accountBreakdown.push({
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName as Record<string, string>,
        amount: amount.toString(),
      });
    }
    byPartner.set(key, existing);
  }

  for (const [key, row] of byPartner.entries()) {
    let unappliedCredit = negativeByPartner.get(key) ?? 0n;
    const entries = (positiveByPartner.get(key) ?? []).sort((a, b) => {
      const aDate = a.dueDate ?? a.postingDate;
      const bDate = b.dueDate ?? b.postingDate;
      return aDate.localeCompare(bDate);
    });

    for (const entry of entries) {
      let remaining = BigInt(entry.amount);
      if (unappliedCredit > 0n) {
        const applied = remaining > unappliedCredit ? unappliedCredit : remaining;
        remaining -= applied;
        unappliedCredit -= applied;
      }
      if (remaining <= 0n) continue;
      const remainingEntry = { ...entry, amount: remaining.toString() };
      row.entries.push(remainingEntry);
      if (remainingEntry.ageDays <= 0) row.current = (BigInt(row.current) + remaining).toString();
      else if (remainingEntry.ageDays <= 30) {
        row.days1To30 = (BigInt(row.days1To30) + remaining).toString();
      } else if (remainingEntry.ageDays <= 60) {
        row.days31To60 = (BigInt(row.days31To60) + remaining).toString();
      } else row.over60 = (BigInt(row.over60) + remaining).toString();
    }
  }

  const rows = [...byPartner.values()]
    .filter((row) => BigInt(row.total) !== 0n)
    .sort((a, b) => Number(BigInt(b.total) - BigInt(a.total)));
  const totalOutstanding = rows.reduce((sum, row) => sum + BigInt(row.total), 0n).toString();
  const allowanceEstimate =
    kind === 'receivables' ? calculateAllowanceEstimate(rows, allowanceRatesBps) : null;

  return {
    kind,
    accountOptions,
    selectedAccountIds,
    rows,
    totalOutstanding,
    allowanceRatesBps,
    allowanceEstimate,
  };
}

export async function savePartyLedgerSettingsAction(formData: FormData) {
  const kind = String(formData.get('kind') ?? '') as PartyLedgerKind;
  if (kind !== 'payables' && kind !== 'receivables') return;

  const ctx = await getAccountingContext('accounting.coa.manage');
  if (!ctx) return;

  const accountIds = formData
    .getAll('accountIds')
    .map((value) => String(value))
    .filter(Boolean);

  await db
    .insert(cmsSettings)
    .values({
      id: generateId(),
      tenantId: ctx.tenantId,
      key: SETTING_KEYS[kind],
      value: accountIds,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .onConflictDoUpdate({
      target: [cmsSettings.tenantId, cmsSettings.key],
      set: { value: accountIds, updatedAt: new Date(), updatedBy: ctx.userId },
    });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'accounting_party_ledger_settings',
    entityId: SETTING_KEYS[kind],
    before: null,
    after: { kind, accountIds },
  });

  revalidatePath(kind === 'payables' ? '/accounting/payables' : '/accounting/receivables');
}

export async function updatePartyLedgerDueDateAction(formData: FormData) {
  const kind = String(formData.get('kind') ?? '') as PartyLedgerKind;
  if (kind !== 'payables' && kind !== 'receivables') return;
  const ctx = await getAccountingContext('accounting.journal.create');
  if (!ctx) return;

  const journalLineId = String(formData.get('journalLineId') ?? '').trim();
  const dueDate = String(formData.get('dueDate') ?? '').trim();
  const reminderRaw = String(formData.get('reminderDaysBefore') ?? '').trim();
  const reminderDaysBefore = reminderRaw ? Number.parseInt(reminderRaw, 10) : null;
  if (!journalLineId) return;

  const [line] = await db
    .select({
      id: journalLines.id,
      previousDueDate: journalLines.dueDate,
      previousReminderDaysBefore: journalLines.reminderDaysBefore,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(eq(journalEntries.tenantId, ctx.tenantId), eq(journalLines.id, journalLineId)))
    .limit(1);
  if (!line) return;

  const nextDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;
  const nextReminderDaysBefore =
    reminderDaysBefore !== null && Number.isFinite(reminderDaysBefore)
      ? Math.max(0, Math.min(365, reminderDaysBefore))
      : null;

  await db
    .update(journalLines)
    .set({
      dueDate: nextDueDate,
      reminderDaysBefore: nextReminderDaysBefore,
      reminderSentAt: null,
    })
    .where(eq(journalLines.id, journalLineId));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'journal_line',
    entityId: journalLineId,
    before: {
      dueDate: line.previousDueDate,
      reminderDaysBefore: line.previousReminderDaysBefore,
    },
    after: { dueDate: nextDueDate, reminderDaysBefore: nextReminderDaysBefore },
  });

  revalidatePath(kind === 'payables' ? '/accounting/payables' : '/accounting/receivables');
}

export async function saveReceivableAllowanceRatesAction(formData: FormData) {
  const ctx = await getAccountingContext('accounting.coa.manage');
  if (!ctx) return;
  const value = {
    current: clampBps(formData.get('current')),
    days1To30: clampBps(formData.get('days1To30')),
    days31To60: clampBps(formData.get('days31To60')),
    over60: clampBps(formData.get('over60')),
  };

  await db
    .insert(cmsSettings)
    .values({
      id: generateId(),
      tenantId: ctx.tenantId,
      key: RECEIVABLE_ALLOWANCE_KEY,
      value,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .onConflictDoUpdate({
      target: [cmsSettings.tenantId, cmsSettings.key],
      set: { value, updatedAt: new Date(), updatedBy: ctx.userId },
    });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'update',
    entityType: 'receivable_allowance_rates',
    entityId: RECEIVABLE_ALLOWANCE_KEY,
    before: null,
    after: value,
  });

  revalidatePath('/accounting/receivables');
}

function daysBetween(postingDate: string, today: Date) {
  const posted = new Date(`${postingDate.slice(0, 10)}T00:00:00.000Z`);
  const current = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return Math.floor((current.getTime() - posted.getTime()) / 86_400_000);
}

function parseAllowanceRates(value: unknown) {
  if (!value || typeof value !== 'object') return DEFAULT_ALLOWANCE_RATES;
  const raw = value as Partial<Record<keyof typeof DEFAULT_ALLOWANCE_RATES, unknown>>;
  return {
    current: clampBps(raw.current ?? DEFAULT_ALLOWANCE_RATES.current),
    days1To30: clampBps(raw.days1To30 ?? DEFAULT_ALLOWANCE_RATES.days1To30),
    days31To60: clampBps(raw.days31To60 ?? DEFAULT_ALLOWANCE_RATES.days31To60),
    over60: clampBps(raw.over60 ?? DEFAULT_ALLOWANCE_RATES.over60),
  };
}

function clampBps(value: FormDataEntryValue | unknown) {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(10000, parsed));
}

function emptyAllowanceEstimate() {
  return { current: '0', days1To30: '0', days31To60: '0', over60: '0', total: '0' };
}

function calculateAllowanceEstimate(
  rows: PartyLedgerRow[],
  rates: PartyLedgerData['allowanceRatesBps'],
) {
  const currentBase = rows.reduce((sum, row) => sum + BigInt(row.current), 0n);
  const days1To30Base = rows.reduce((sum, row) => sum + BigInt(row.days1To30), 0n);
  const days31To60Base = rows.reduce((sum, row) => sum + BigInt(row.days31To60), 0n);
  const over60Base = rows.reduce((sum, row) => sum + BigInt(row.over60), 0n);
  const current = (currentBase * BigInt(rates.current)) / 10000n;
  const days1To30 = (days1To30Base * BigInt(rates.days1To30)) / 10000n;
  const days31To60 = (days31To60Base * BigInt(rates.days31To60)) / 10000n;
  const over60 = (over60Base * BigInt(rates.over60)) / 10000n;
  return {
    current: current.toString(),
    days1To30: days1To30.toString(),
    days31To60: days31To60.toString(),
    over60: over60.toString(),
    total: (current + days1To30 + days31To60 + over60).toString(),
  };
}
