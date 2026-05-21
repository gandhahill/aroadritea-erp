import { db } from '@erp/db';
import { accounts, journalEntries, taxRates } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { posSettings } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';

const DEFAULT_PB1_TAX_CODE = 'PB1';
const DEFAULT_CASH_ACCOUNT_CODE = '1-1300';
const DEFAULT_REVENUE_ACCOUNT_CODE = '4-1100';
const DEFAULT_DONATION_TRUST_ACCOUNT_CODE = '2-2050';
const DEFAULT_DELIVERY_CHANNELS = [
  { id: 'gofood', label: 'GoFood', netBps: 8000, enabled: true },
  { id: 'grabfood', label: 'GrabFood', netBps: 8000, enabled: true },
  { id: 'shopeefood', label: 'ShopeeFood', netBps: 8000, enabled: true },
] as const;

export interface DeliveryChannelConfig {
  id: string;
  label: string;
  netBps: number;
  commissionBps: number;
  enabled: boolean;
}

export interface PosPostingConfig {
  taxCode: string;
  taxRateBps: number;
  taxAccountId: string;
  cashAccountId: string;
  revenueAccountId: string;
  donationTrustAccountId: string;
  deliveryChannels: Map<string, DeliveryChannelConfig>;
}

export function normalizeDeliveryChannelConfig(raw: unknown): DeliveryChannelConfig[] {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : [...DEFAULT_DELIVERY_CHANNELS];
  const channels = new Map<string, DeliveryChannelConfig>();

  for (const item of source) {
    const record =
      typeof item === 'string'
        ? { id: item, label: item, netBps: 8000, enabled: true }
        : item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
    if (!record) continue;

    const id = String(record.id ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_-]{2,32}$/.test(id)) continue;

    const rawNetBps = Number(record.netBps ?? 8000);
    const rawCommissionBps = Number(record.commissionBps ?? 10000 - rawNetBps);
    const netBps = Number.isFinite(rawNetBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawNetBps)))
      : 8000;
    const commissionBps = Number.isFinite(rawCommissionBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawCommissionBps)))
      : 10000 - netBps;

    channels.set(id, {
      id,
      label: String(record.label ?? id).trim() || id,
      netBps,
      commissionBps,
      enabled: record.enabled !== false,
    });
  }

  return [...channels.values()];
}

async function resolveAccountIdByCode(tenantId: string, code: string): Promise<Result<string>> {
  const account = await db
    .select({ id: accounts.id, isActive: accounts.isActive, isPostable: accounts.isPostable })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .then((rows) => rows[0]);

  if (!account) return err(AppError.notFound('pos.posting.accountNotFound', { code }));
  if (!account.isActive || !account.isPostable) {
    return err(AppError.businessRule('pos.posting.accountNotPostable', { code }));
  }
  return ok(account.id);
}

export async function resolvePosPostingConfig(
  tenantId: string,
  locationId: string,
  postingDate: string,
): Promise<Result<PosPostingConfig>> {
  const [setting] = await db
    .select({
      pb1TaxCode: posSettings.pb1TaxCode,
      cashAccountCode: posSettings.cashAccountCode,
      revenueAccountCode: posSettings.revenueAccountCode,
      donationTrustAccountCode: posSettings.donationTrustAccountCode,
      deliveryChannelsJson: posSettings.deliveryChannelsJson,
    })
    .from(posSettings)
    .where(and(eq(posSettings.tenantId, tenantId), eq(posSettings.locationId, locationId)))
    .limit(1);

  const taxCode = setting?.pb1TaxCode ?? DEFAULT_PB1_TAX_CODE;
  const [taxRate] = await db
    .select({
      code: taxRates.code,
      rateBps: taxRates.rateBps,
      calculation: taxRates.calculation,
      postingAccountId: taxRates.postingAccountId,
    })
    .from(taxRates)
    .where(
      and(
        eq(taxRates.code, taxCode),
        eq(taxRates.isActive, true),
        sql`${taxRates.effectiveFrom} <= ${postingDate}`,
        sql`(${taxRates.effectiveUntil} IS NULL OR ${taxRates.effectiveUntil} >= ${postingDate})`,
      ),
    )
    .limit(1);

  if (!taxRate) return err(AppError.notFound('pos.posting.taxRateNotFound', { taxCode }));
  if (taxRate.calculation !== 'inclusive') {
    return err(AppError.businessRule('pos.posting.taxRateMustBeInclusive', { taxCode }));
  }

  const cashAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.cashAccountCode ?? DEFAULT_CASH_ACCOUNT_CODE,
  );
  if (!cashAccount.ok) return cashAccount;

  const revenueAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.revenueAccountCode ?? DEFAULT_REVENUE_ACCOUNT_CODE,
  );
  if (!revenueAccount.ok) return revenueAccount;

  const donationTrustAccount = await resolveAccountIdByCode(
    tenantId,
    setting?.donationTrustAccountCode ?? DEFAULT_DONATION_TRUST_ACCOUNT_CODE,
  );
  if (!donationTrustAccount.ok) return donationTrustAccount;

  return ok({
    taxCode: taxRate.code,
    taxRateBps: taxRate.rateBps,
    taxAccountId: taxRate.postingAccountId,
    cashAccountId: cashAccount.value,
    revenueAccountId: revenueAccount.value,
    donationTrustAccountId: donationTrustAccount.value,
    deliveryChannels: new Map(
      normalizeDeliveryChannelConfig(setting?.deliveryChannelsJson)
        .filter((channel) => channel.enabled)
        .map((channel) => [channel.id, channel]),
    ),
  });
}

export async function autoPostJournalEntry(
  journalEntryId: string,
  ctx: AuditContext,
  source: string,
): Promise<Result<void>> {
  const postedAt = new Date();
  const updated = await db
    .update(journalEntries)
    .set({
      status: 'posted',
      postedAt,
      postedBy: ctx.userId,
      updatedBy: ctx.userId,
      updatedAt: postedAt,
      version: sql`${journalEntries.version} + 1`,
    })
    .where(
      and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.tenantId, ctx.tenantId),
        eq(journalEntries.status, 'draft'),
      ),
    )
    .returning({ id: journalEntries.id });

  if (updated.length === 0) {
    return err(AppError.conflict('pos.posting.journalAutoPostFailed', { journalEntryId }));
  }

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: 'post',
    entityType: 'journal_entry',
    entityId: journalEntryId,
    before: { status: 'draft' },
    after: {
      status: 'posted',
      postedAt: postedAt.toISOString(),
      postedBy: ctx.userId,
    },
    metadata: {
      ip: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      source,
    },
  });

  return ok(undefined);
}

/** Extract inclusive tax from a gross price and return net + tax. */
export function extractInclusiveTax(
  inclusivePrice: bigint,
  rateBps: number,
): { net: bigint; tax: bigint } {
  const price10k = BigInt(inclusivePrice) * BigInt(10000);
  const net = price10k / BigInt(10000 + rateBps);
  const tax = inclusivePrice - net;
  return { net, tax };
}

/** Map POS channel code to a user-friendly label for journal descriptions. */
export function humanizeChannel(channel: string): string {
  switch (channel) {
    case 'walk_in':
      return 'Walk-in';
    case 'gofood':
      return 'GoFood';
    case 'grabfood':
      return 'GrabFood';
    case 'shopeefood':
      return 'ShopeeFood';
    default:
      return channel
        .split(/[_-]+/)
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
        .join(' ');
  }
}
