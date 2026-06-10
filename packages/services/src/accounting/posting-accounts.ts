/**
 * accounting/posting-accounts.ts — Configurable posting-account mapping.
 *
 * Every auto-journal call site (POS, purchasing, inventory, payroll, petty
 * cash, reimbursement, refund, period close, fixed assets) used to hardcode COA
 * code constants. After the COA was renumbered (see packages/db/seed/coa.ts)
 * several of those constants went stale and pointed at deactivated/nonexistent
 * accounts, silently breaking auto-posting.
 *
 * This module is the single source of truth for those codes. Defaults track the
 * active COA seed; operators override any of them per-tenant from
 * Settings → Accounting → Account Mapping (stored in `cms_settings` under
 * `accounting.accountMap` as `{ purpose: code }`). Behaviour is unchanged unless
 * an override is set — the defaults below are the corrected codes.
 *
 * INVARIANT: every default code MUST exist and be postable in COA_SEED.
 */
import { db } from '@erp/db';
import { cmsSettings } from '@erp/db/schema/cms';
import type { Result } from '@erp/shared/result';
import { and, eq } from 'drizzle-orm';
import { requireAccountIdByCode } from './account-resolver';

export const ACCOUNT_MAP_SETTING_KEY = 'accounting.accountMap';

/**
 * Canonical posting purposes → default COA code (active COA, coa.ts).
 * `group` is purely for the settings UI layout.
 */
export const POSTING_ACCOUNT_DEFAULTS = {
  // POS / sales
  'pos.cash': '1-1300', // Kas di Bank — POS settlement
  'pos.revenue': '4-1100', // Penjualan
  'pos.donationTrust': '2-2050', // Utang Titipan Donasi
  // Cost of sales & stock (shared by POS, purchasing, inventory)
  cogs: '5-1100', // Pembelian (HPP)
  inventory: '1-1600', // Persediaan Barang Dagangan  (was stale 1-1210)
  // Purchasing
  'purchasing.grni': '2-1110', // Penerimaan Belum Ditagih (GRNI)
  'purchasing.ap': '2-1100', // Utang Usaha
  'purchasing.vatIn': '1-4100', // PPN Masukan
  // Inventory adjustment / opname offsets
  'adjustment.expense': '6-2100', // Beban Operasional Lainnya (selisih kurang)  (was stale 6-1110)
  'adjustment.income': '7-1200', // Pendapatan Lainnya (selisih lebih)           (was stale 4-2020)
  // Cash family
  pettyCash: '1-1100', // Kas Kecil  (was stale 1-1310)
  cash: '1-1200', // Kas        (was stale 1-1100)
  bank: '1-1300', // Kas di Bank
  // Refund (CRM)
  'refund.expense': '6-2100', // Beban Operasional Lainnya
  // Payroll  (were nonexistent BS-/LS-/AS- codes)
  'payroll.salaryExpense': '6-2000', // Beban Gaji dan Upah
  'payroll.taxPayable': '2-1300', // Utang Pajak Penghasilan (PPh 21)
  'payroll.bpjsPayable': '2-1200', // Utang Beban (BPJS)
  'payroll.netPay': '1-1300', // Kas di Bank (pembayaran gaji bersih)
  // Fixed assets
  'fixedAsset.gainOnDisposal': '7-1200', // Pendapatan Lainnya
  // Period close
  'period.incomeSummary': '3-1300', // Ikhtisar Laba Rugi
  'period.retainedEarnings': '3-1400', // Laba Ditahan
  // Initial balances
  'equity.opening': '3-1100', // Modal Saham (Opening Balance Equity)
} as const;

export type PostingAccountPurpose = keyof typeof POSTING_ACCOUNT_DEFAULTS;

export const POSTING_ACCOUNT_PURPOSES = Object.keys(
  POSTING_ACCOUNT_DEFAULTS,
) as PostingAccountPurpose[];

export type PostingAccountCodes = Record<PostingAccountPurpose, string>;

function sanitizeOverrides(raw: unknown): Partial<Record<PostingAccountPurpose, string>> {
  const out: Partial<Record<PostingAccountPurpose, string>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const map = raw as Record<string, unknown>;
  for (const purpose of POSTING_ACCOUNT_PURPOSES) {
    const value = map[purpose];
    if (typeof value === 'string' && value.trim()) out[purpose] = value.trim();
  }
  return out;
}

/** Read the tenant's saved overrides (only valid, non-empty entries). */
export async function getPostingAccountOverrides(
  tenantId: string,
): Promise<Partial<Record<PostingAccountPurpose, string>>> {
  const [row] = await db
    .select({ value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, ACCOUNT_MAP_SETTING_KEY)))
    .limit(1);
  return sanitizeOverrides(row?.value);
}

/** Full resolved map: corrected defaults with tenant overrides applied. */
export async function getPostingAccountCodes(tenantId: string): Promise<PostingAccountCodes> {
  const overrides = await getPostingAccountOverrides(tenantId);
  return { ...POSTING_ACCOUNT_DEFAULTS, ...overrides };
}

/** Resolve a single purpose to its configured (or default) COA code. */
export async function resolvePostingCode(
  tenantId: string,
  purpose: PostingAccountPurpose,
): Promise<string> {
  const overrides = await getPostingAccountOverrides(tenantId);
  return overrides[purpose] ?? POSTING_ACCOUNT_DEFAULTS[purpose];
}

/** Resolve a purpose straight to its `accounts.id` UUID (Result). */
export async function resolvePostingAccountId(
  tenantId: string,
  purpose: PostingAccountPurpose,
  context = 'accounting.account.resolveFailed',
): Promise<Result<string>> {
  const code = await resolvePostingCode(tenantId, purpose);
  return requireAccountIdByCode(tenantId, code, context);
}
