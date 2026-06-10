/**
 * Journal Entries Server Actions — fetches journal data for UI.
 * SD §21.1: Journal Entry editor (table-based).
 */

'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { getActiveLocationOptions } from '@/lib/location-options';
import { pickLocalized } from '@/lib/pick-localized';
import { and, asc, db, desc, eq, inArray, sql } from '@erp/db';
import {
  accountingPeriods,
  accounts,
  bankAccounts,
  journalEntries,
  journalLines,
  partners,
} from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import { cmsSettings } from '@erp/db/schema/cms';
import {
  createJournal,
  deleteJournal,
  postJournal,
  reverseJournal,
} from '@erp/services/accounting';
import { requirePermission } from '@erp/services/iam';
import type { AuditContext } from '@erp/shared/types';
import { getLocale, getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface JournalListItem {
  id: string;
  number: string;
  postingDate: string;
  status: string;
  description: string;
  referenceType: string | null;
  locationId: string;
  locationLabel: string;
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
  locationLabel: string;
  partnerName: string | null;
  dueDate: string | null;
  reminderDaysBefore: number | null;
}

export interface JournalDetail {
  id: string;
  number: string;
  postingDate: string;
  status: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  locationId: string;
  locationLabel: string;
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
  subtype: string;
}

export interface JournalFormLocation {
  id: string;
  code: string;
  label: string;
}

export interface JournalFormPartner {
  id: string;
  name: string;
  kind: string;
  address: string | null;
  npwp: string | null;
  paymentTermsDays: number | null;
}

export interface JournalFormData {
  accounts: JournalFormAccount[];
  locations: JournalFormLocation[];
  partners: JournalFormPartner[];
}

export interface JournalCreateState {
  ok?: boolean;
  error?: string;
  journalId?: string;
}

export interface JournalImportState {
  ok?: boolean;
  error?: string;
  importedCount?: number;
}

type CsvRow = Record<string, string>;

type JournalImportGroup = {
  postingDate: string;
  locationId: string;
  description: string;
  referenceId?: string;
  lines: Array<{
    accountId: string;
    locationId: string;
    description?: string;
    debit: string;
    credit: string;
    partnerId?: string;
    dueDate?: string;
    reminderDaysBefore?: number;
  }>;
};

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

async function postJournalErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'messageKey' in error) {
    const messageKey = String((error as { messageKey: unknown }).messageKey);
    if (messageKey === 'workflow.approvalGate.pending') {
      const t = await getTranslations('accounting.journals.errors');
      return t('approvalPending');
    }
  }

  return errorMessage(error);
}

function parseCsv(textValue: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < textValue.length; index++) {
    const char = textValue[index];
    const next = textValue[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index++;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  if (rows.length < 2) return [];

  const headerRow = rows[0];
  if (!headerRow) return [];
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((values) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = String(values[index] ?? '').trim();
    });
    return record;
  });
}

function parseRupiah(value: string): string {
  const raw = value.trim();
  if (!raw) return '0';
  const clean = raw.replace(/rp/gi, '').replace(/\s/g, '');
  let normalized = clean;
  if (clean.includes(',') && clean.includes('.')) {
    normalized = clean.replace(/\./g, '').split(',')[0] ?? '0';
  } else if (clean.includes(',')) {
    normalized = clean.split(',')[0] ?? '0';
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, '');
  } else if (clean.includes('.')) {
    normalized = clean.split('.')[0] ?? '0';
  }
  const digits = normalized.replace(/[^\d]/g, '');
  return digits || '0';
}

/**
 * Fetch journal entries list for a tenant, ordered by most recent.
 */
export interface JournalListPage {
  items: JournalListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchJournalList(page = 1, requestedPageSize = 20): Promise<JournalListPage> {
  const ctx = await getContext();
  const pageSize = Math.max(
    1,
    Math.min(100, Number.isFinite(requestedPageSize) ? requestedPageSize : 20),
  );
  if (!ctx) return { items: [], total: 0, page: 1, pageSize };
  const locationScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.view',
    ctx.tenantId,
  );
  if (!locationScope.global && locationScope.locationIds.length === 0) {
    return { items: [], total: 0, page: 1, pageSize };
  }
  const currentPage = Math.max(1, Number.isFinite(page) ? page : 1);
  const whereClause = and(
    eq(journalEntries.tenantId, ctx.tenantId),
    locationScope.global
      ? undefined
      : inArray(journalEntries.locationId, locationScope.locationIds),
  );

  const [{ count = 0 } = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(journalEntries)
    .where(whereClause);

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
    .where(whereClause)
    .orderBy(desc(journalEntries.createdAt))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  if (rows.length === 0) return { items: [], total: count, page: currentPage, pageSize };

  const ids = rows.map((r) => r.id);
  const locationIds = [...new Set(rows.map((r) => r.locationId))];
  const [lines, locationRows] = await Promise.all([
    db
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
      .orderBy(asc(journalLines.lineNo)),
    locationIds.length > 0
      ? db
          .select({ id: locations.id, code: locations.code, name: locations.name })
          .from(locations)
          .where(and(eq(locations.tenantId, ctx.tenantId), inArray(locations.id, locationIds)))
      : Promise.resolve([]),
  ]);

  const linesByJournal = new Map<
    string,
    Array<{ accountCode: string; accountName: string; debit: string; credit: string }>
  >();
  const locale = await getLocale();
  const locationById = new Map(
    locationRows.map((location) => [
      location.id,
      `${location.code} - ${pickLocalized(location.name, locale, location.code)}`,
    ]),
  );
  for (const line of lines) {
    const arr = linesByJournal.get(line.journalEntryId) ?? [];
    const accountLabel = pickLocalized(line.accountName, locale, line.accountCode ?? '—');
    arr.push({
      accountCode: line.accountCode ?? '—',
      accountName: accountLabel,
      debit: String(line.debit ?? '0'),
      credit: String(line.credit ?? '0'),
    });
    linesByJournal.set(line.journalEntryId, arr);
  }

  return {
    items: rows.map((r) => ({
      ...r,
      locationLabel: locationById.get(r.locationId) ?? r.locationId,
      totalDebit: String(r.totalDebit),
      createdAt: r.createdAt ?? new Date(0),
      linesPreview: linesByJournal.get(r.id) ?? [],
    })),
    total: count,
    page: currentPage,
    pageSize,
  };
}

export async function fetchJournalFormData(): Promise<JournalFormData> {
  const ctx = await getContext();
  if (!ctx) return { accounts: [], locations: [], partners: [] };

  const viewScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.view',
    ctx.tenantId,
  );
  if (!viewScope.global && viewScope.locationIds.length === 0) {
    return { accounts: [], locations: [], partners: [] };
  }
  const createScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.journal.create',
    ctx.tenantId,
  );

  const [accountRows, partnerRows, locations] = await Promise.all([
    db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        normalBalance: accounts.normalBalance,
        subtype: accounts.subtype,
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
    db
      .select({
        id: partners.id,
        name: partners.name,
        kind: partners.kind,
        address: partners.address,
        npwp: partners.npwp,
        paymentTermsDays: partners.paymentTermsDays,
      })
      .from(partners)
      .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.isActive, true)))
      .orderBy(asc(partners.name)),
    (async () => {
      const raw = await getLocale().catch(() => 'id');
      const locale: 'id' | 'en' | 'zh' = raw === 'en' || raw === 'zh' ? raw : 'id';
      const options = await getActiveLocationOptions({ tenantId: ctx.tenantId, locale });
      if (createScope.global) return options;
      const allowedIds = new Set(createScope.locationIds);
      return options.filter((option) => allowedIds.has(option.id));
    })(),
  ]);

  return {
    accounts: accountRows.map((account) => ({
      ...account,
      name: account.name as Record<string, string>,
    })),
    partners: partnerRows,
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
    const partnerId = optionalText(formData, `partnerId-${index}`);
    const dueDate = optionalText(formData, `dueDate-${index}`);
    const reminderRaw = optionalText(formData, `reminderDaysBefore-${index}`);
    const reminderDaysBefore =
      reminderRaw === undefined ? undefined : Number.parseInt(reminderRaw, 10);

    if (!accountId && debit === '0' && credit === '0' && !description) continue;
    lines.push({
      accountId,
      locationId: lineLocationId,
      description,
      debit,
      credit,
      partnerId,
      dueDate,
      reminderDaysBefore:
        typeof reminderDaysBefore === 'number' && Number.isFinite(reminderDaysBefore)
          ? Math.max(0, Math.min(365, reminderDaysBefore))
          : undefined,
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

export async function postJournalAction(
  _prev: JournalCreateState | null,
  formData: FormData,
): Promise<JournalCreateState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const journalId = text(formData, 'journalId');
  if (!journalId) return { error: 'Journal ID required' };

  const result = await postJournal({ journalId }, ctx);
  if (!result.ok) return { error: await postJournalErrorMessage(result.error) };

  revalidatePath('/accounting/journals');
  revalidatePath(`/accounting/journals/${journalId}`);
  return { ok: true, journalId: result.value.id };
}

export async function reverseJournalAction(
  _prev: JournalCreateState | null,
  formData: FormData,
): Promise<JournalCreateState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const journalId = text(formData, 'journalId');
  const postingDate = text(formData, 'postingDate');

  if (!journalId) return { error: 'Journal ID required' };
  if (!postingDate) return { error: 'Posting Date required' };

  const result = await reverseJournal({ journalId, postingDate }, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/accounting/journals');
  revalidatePath(`/accounting/journals/${journalId}`);
  revalidatePath(`/accounting/journals/${result.value.id}`);
  return { ok: true, journalId: result.value.id };
}

export async function deleteJournalAction(
  _prev: JournalCreateState | null,
  formData: FormData,
): Promise<JournalCreateState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const journalId = text(formData, 'journalId');
  if (!journalId) return { error: 'Journal ID required' };

  const result = await deleteJournal(journalId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/accounting/journals');
  return { ok: true };
}

export async function importJournalCsvAction(
  _prev: JournalImportState | null,
  formData: FormData,
): Promise<JournalImportState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'CSV file is required.' };
  }
  if (file.size > 1024 * 1024) {
    return { error: 'CSV file is too large. Maximum size is 1 MB.' };
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { error: 'CSV has no data rows.' };

  const [accountRows, locationRows] = await Promise.all([
    db
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, ctx.tenantId),
          eq(accounts.isActive, true),
          eq(accounts.isPostable, true),
        ),
      ),
    db
      .select({ id: locations.id, code: locations.code })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active'))),
  ]);

  const accountByCode = new Map(accountRows.map((account) => [account.code, account.id]));
  const locationByKey = new Map<string, string>();
  for (const location of locationRows) {
    locationByKey.set(location.id, location.id);
    locationByKey.set(location.code, location.id);
  }

  const groups = new Map<string, JournalImportGroup>();

  for (const [index, row] of rows.entries()) {
    const lineNumber = index + 2;
    const postingDate = row.posting_date ?? '';
    const locationKey = row.location_id || row.location_code || '';
    const accountCode = row.account_code ?? '';
    const locationId = locationByKey.get(locationKey);
    const accountId = accountByCode.get(accountCode);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) {
      return { error: `Row ${lineNumber}: posting_date must be YYYY-MM-DD.` };
    }
    if (!locationId) return { error: `Row ${lineNumber}: location not found.` };
    if (!accountId) return { error: `Row ${lineNumber}: account_code not found.` };

    const description = row.description || `Imported journal ${postingDate}`;
    const referenceId = row.reference_id || undefined;
    const key = [postingDate, locationId, description, referenceId ?? ''].join('::');
    const group = groups.get(key) ?? {
      postingDate,
      locationId,
      description,
      referenceId,
      lines: [],
    };

    group.lines.push({
      accountId,
      locationId,
      description: row.line_description || undefined,
      debit: parseRupiah(row.debit ?? ''),
      credit: parseRupiah(row.credit ?? ''),
    });
    groups.set(key, group);
  }

  let importedCount = 0;
  for (const group of groups.values()) {
    const result = await createJournal(
      {
        postingDate: group.postingDate,
        locationId: group.locationId,
        description: group.description,
        referenceType: 'manual',
        referenceId: group.referenceId,
        lines: group.lines,
      },
      { ...ctx, locationId: group.locationId },
    );
    if (!result.ok) return { error: errorMessage(result.error) };
    importedCount++;
  }

  revalidatePath('/accounting/journals');
  return { ok: true, importedCount };
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
      partnerName: partners.name,
      dueDate: journalLines.dueDate,
      reminderDaysBefore: journalLines.reminderDaysBefore,
    })
    .from(journalLines)
    .leftJoin(
      partners,
      and(eq(partners.id, journalLines.partnerId), eq(partners.tenantId, ctx.tenantId)),
    )
    .where(eq(journalLines.journalEntryId, journalId));

  const locale = await getLocale();
  const lineLocationIds = [...new Set([entry.locationId, ...lines.map((line) => line.locationId)])];
  const locationRows =
    lineLocationIds.length > 0
      ? await db
          .select({ id: locations.id, code: locations.code, name: locations.name })
          .from(locations)
          .where(and(eq(locations.tenantId, ctx.tenantId), inArray(locations.id, lineLocationIds)))
      : [];
  const locationById = new Map(
    locationRows.map((location) => [
      location.id,
      `${location.code} - ${pickLocalized(location.name, locale, location.code)}`,
    ]),
  );

  // Fetch account details for display — filter by the specific IDs to avoid
  // returning the entire chart of accounts for the tenant on every detail load.
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const acctRows =
    accountIds.length > 0
      ? await db
          .select({ id: accounts.id, code: accounts.code, name: accounts.name })
          .from(accounts)
          .where(and(eq(accounts.tenantId, ctx.tenantId), inArray(accounts.id, accountIds)))
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
    notes: null,
    locationId: entry.locationId,
    locationLabel: locationById.get(entry.locationId) ?? entry.locationId,
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
        locationLabel: locationById.get(l.locationId) ?? l.locationId,
        partnerName: l.partnerName,
        dueDate: l.dueDate ? String(l.dueDate) : null,
        reminderDaysBefore: l.reminderDaysBefore,
      };
    }),
  };
}

export async function serverExportJournals() {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };
  const locationScope = await authorizedLocationIdsForTenant(
    ctx.userId,
    'accounting.view',
    ctx.tenantId,
  );
  if (!locationScope.global && locationScope.locationIds.length === 0) {
    return { ok: false, error: 'Unauthorized' };
  }

  const list = await fetchJournalList(1, 1000);

  const headers = ['Number', 'Posting Date', 'Status', 'Description', 'Total Debit'];
  const rows = list.items.map((j) => [
    j.number,
    j.postingDate,
    j.status,
    j.description,
    j.totalDebit,
  ]);

  return {
    ok: true,
    value: {
      sheets: [
        {
          name: 'Journal Entries',
          rows: [headers, ...rows],
        },
      ],
    },
  };
}

export interface BankAccountDetail {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  npwp: string;
  phone: string;
}

export interface PrintJournalData {
  journal: JournalDetail;
  bankAccounts: BankAccountDetail[];
  companyInfo: CompanyInfo;
}

export async function fetchPrintJournalData(journalId: string): Promise<PrintJournalData | null> {
  const ctx = await getContext();
  if (!ctx) return null;

  const journal = await fetchJournalDetail(journalId);
  if (!journal) return null;

  const activeBanks = await db
    .select({
      id: bankAccounts.id,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      accountHolder: bankAccounts.accountHolder,
    })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.tenantId, ctx.tenantId), eq(bankAccounts.isActive, true)))
    .orderBy(asc(bankAccounts.bankName));

  // Fetch company info from cms_settings
  const companyRows = await db
    .select({ key: cmsSettings.key, value: cmsSettings.value })
    .from(cmsSettings)
    .where(
      and(
        eq(cmsSettings.tenantId, ctx.tenantId),
        inArray(cmsSettings.key, [
          'company.name',
          'company.address',
          'company.npwp',
          'company.phone',
        ]),
      ),
    );

  const companyMap = new Map<string, unknown>();
  for (const row of companyRows) {
    companyMap.set(row.key, row.value);
  }

  const companyInfo: CompanyInfo = {
    name:
      (companyMap.get('company.name') as string) ?? 'PT. Gandha Hill Catering Management Indonesia',
    address: (companyMap.get('company.address') as string) ?? '',
    npwp: (companyMap.get('company.npwp') as string) ?? '',
    phone: (companyMap.get('company.phone') as string) ?? '',
  };

  return {
    journal,
    bankAccounts: activeBanks,
    companyInfo,
  };
}
