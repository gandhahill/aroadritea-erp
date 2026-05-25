/**
 * CRM Service — SD §21.9, §9.7, §31.5
 *
 * - Complaints log with status workflow
 * - Compensation tracking (product replacement, voucher, refund)
 * - Loyalty earn/redeem integrated with POS sale
 * - Tier upgrade logic (bronze → silver → gold)
 */

import { db } from '@erp/db';
import { accounts, partners } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { complaintCompensations, complaints } from '@erp/db/schema/crm';
import { memberLoyalty, memberPointsTransactions, memberVouchers } from '@erp/db/schema/member';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { requirePermission } from '../iam';
import { decryptPii, encryptPii, encryptPiiForLookup } from '../security/pii';
import { auditRecord } from "../audit";

// ─── Loyalty configuration ──────────────────────────────────────────────────

/**
 * Loyalty config can be customized per-tenant via cmsSettings (key
 * `loyalty.config`) so admins can tune earn rate / thresholds / tier list
 * without redeploying. These are the safe defaults if no setting exists.
 *
 * - `rupiahPerPoint`: how many rupiah of net spend earn one point.
 * - `tiers`: ordered list of tiers; `minLifetimePoints` defines the cutoff.
 *   First tier with `minLifetimePoints: 0` is the entry tier.
 */
export interface LoyaltyConfig {
  rupiahPerPoint: number;
  tiers: Array<{ code: string; minLifetimePoints: number }>;
}

export const LOYALTY_SETTING_KEY = 'loyalty.config';

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  rupiahPerPoint: 100_000,
  tiers: [
    { code: 'bronze', minLifetimePoints: 0 },
    { code: 'silver', minLifetimePoints: 50 },
    { code: 'gold', minLifetimePoints: 150 },
  ],
};

function normalizeLoyaltyConfig(value: unknown): LoyaltyConfig {
  const fallback = DEFAULT_LOYALTY_CONFIG;
  if (!value || typeof value !== 'object') return fallback;
  const obj = value as Record<string, unknown>;
  const rupiahPerPoint =
    typeof obj.rupiahPerPoint === 'number' && obj.rupiahPerPoint > 0
      ? obj.rupiahPerPoint
      : fallback.rupiahPerPoint;
  const rawTiers = Array.isArray(obj.tiers) ? obj.tiers : [];
  const tiers = rawTiers
    .map((t) => {
      if (!t || typeof t !== 'object') return null;
      const tier = t as Record<string, unknown>;
      const code = typeof tier.code === 'string' ? tier.code : null;
      const minLifetimePoints =
        typeof tier.minLifetimePoints === 'number' ? tier.minLifetimePoints : null;
      if (!code || minLifetimePoints === null || minLifetimePoints < 0) return null;
      return { code, minLifetimePoints };
    })
    .filter((t): t is { code: string; minLifetimePoints: number } => Boolean(t))
    .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  if (tiers.length === 0) return fallback;
  // Ensure the lowest tier starts at 0 (entry tier required).
  if ((tiers[0]?.minLifetimePoints ?? 1) > 0) {
    tiers.unshift({ code: 'bronze', minLifetimePoints: 0 });
  }
  return { rupiahPerPoint, tiers };
}

export async function getLoyaltyConfig(tenantId: string): Promise<LoyaltyConfig> {
  try {
    const row = await db
      .select({ value: cmsSettings.value })
      .from(cmsSettings)
      .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, LOYALTY_SETTING_KEY)))
      .limit(1);
    return normalizeLoyaltyConfig(row[0]?.value ?? null);
  } catch {
    return DEFAULT_LOYALTY_CONFIG;
  }
}

const VOUCHER_KIND_MAP: Record<string, string> = {
  product_replacement: 'free_item',
  voucher: 'discount_fixed',
  refund_cash: 'discount_fixed',
  discount: 'discount_percent',
};

async function resolveAccountIdByCode(tenantId: string, code: string): Promise<Result<string>> {
  const row = await db
    .select({ id: accounts.id, isActive: accounts.isActive, isPostable: accounts.isPostable })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) return err(AppError.notFound('crm.accountNotFound', { code }));
  if (!row.isActive || !row.isPostable) {
    return err(AppError.businessRule('crm.accountNotPostable', { code }));
  }
  return ok(row.id);
}

// ─── Members ────────────────────────────────────────────────────────────────

/**
 * Create a customer partner (member or guest).
 * Used by CRM MCP tool and signup flow.
 */
export async function createPartner(
  input: {
    name: string;
    phone: string;
    email?: string;
    kind?: string;
    isMember?: boolean;
    birthDate?: string;
    city?: string;
    loyaltyTier?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  try {
    const id = generateId();
    await db.insert(partners).values({
      id,
      tenantId: ctx.tenantId,
      name: input.name,
      // partners.phone is mandated encrypted at rest by SD §25.1 / UU PDP.
      // email is encrypted alongside it — the public site reads partners
      // back via crm.findByPhone (which uses encryptPiiForLookup), so the
      // application never needs cleartext storage.
      email: encryptPii(input.email ?? null, 'partners.email'),
      phone: encryptPii(input.phone, 'partners.phone'),
      kind: input.kind ?? 'customer',
      isMember: input.isMember ?? false,
      loyaltyTier: input.loyaltyTier ?? 'bronze',
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      city: input.city ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    return ok({ id });
  } catch (e) {
    return err(AppError.internal('crm.createPartner.failed', e));
  }
}

// ─── Complaints ─────────────────────────────────────────────────────────────

export async function logComplaint(
  input: {
    memberId?: string;
    customerName?: string;
    customerPhone?: string;
    orderId?: string;
    orderNumber?: string;
    occurredAt: string;
    category: string;
    description: string;
    priority?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'crm.logComplaint', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const id = crypto.randomUUID();
    await db.insert(complaints).values({
      id,
      tenantId: ctx.tenantId,
      locationId: ctx.locationId,
      memberId: input.memberId ?? null,
      customerName: input.customerName ?? null,
      customerPhone: encryptPii(input.customerPhone, 'complaints.customerPhone'),
      orderId: input.orderId ?? null,
      orderNumber: input.orderNumber ?? null,
      occurredAt: new Date(input.occurredAt),
      category: input.category,
      description: input.description,
      priority: input.priority ?? 'medium',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    await auditRecord({
        action: 'create',
        entityType: 'complaint',
        entityId: id,
        before: null,
        after: {
              memberId: input.memberId ?? null,
              customerName: input.customerName ?? null,
              orderNumber: input.orderNumber ?? null,
              category: input.category,
              priority: input.priority ?? 'medium',
              status: 'open',
              piiFields: input.customerPhone ? ['customerPhone'] : [],
            },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });
    return ok({ id });
  } catch (e) {
    return err(AppError.internal('crm.logComplaint.failed', e));
  }
}

export async function listComplaints(
  input: {
    status?: string;
    locationId?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ items: Record<string, unknown>[]; nextCursor?: string }>> {
  const requestedLocationId = input.locationId ?? ctx.locationId;
  const permCheck = await requirePermission(ctx.userId, 'crm.listComplaints', {
    locationId: requestedLocationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const rows = await db
      .select()
      .from(complaints)
      .where(
        and(
          eq(complaints.tenantId, ctx.tenantId),
          requestedLocationId ? eq(complaints.locationId, requestedLocationId) : undefined,
          input.status ? eq(complaints.status, input.status) : undefined,
          input.from ? gte(complaints.occurredAt, new Date(input.from)) : undefined,
        ),
      )
      .orderBy(desc(complaints.reportedAt))
      .limit((input.limit ?? 50) + 1);

    const hasMore = rows.length > (input.limit ?? 50);
    const items = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id as string) : undefined;

    return ok({
      items: items.map((item) => ({
        ...item,
        customerPhone: decryptPii(item.customerPhone, 'complaints.customerPhone'),
      })) as Record<string, unknown>[],
      nextCursor,
    });
  } catch (e) {
    return err(AppError.internal('crm.listComplaints.failed', e));
  }
}

export async function resolveComplaint(
  input: {
    complaintId: string;
    status: string;
    resolutionNotes?: string;
    assignedTo?: string;
  },
  ctx: AuditContext,
): Promise<Result<void>> {
  try {
    const existing = await db
      .select()
      .from(complaints)
      .where(and(eq(complaints.tenantId, ctx.tenantId), eq(complaints.id, input.complaintId)))
      .then((r) => r[0]);

    if (!existing)
      return err(AppError.notFound('crm.complaintNotFound', { id: input.complaintId }));

    const permCheck = await requirePermission(ctx.userId, 'crm.resolveComplaint', {
      locationId: existing.locationId,
    });
    if (!permCheck.ok) return permCheck;

    await db
      .update(complaints)
      .set({
        status: input.status,
        resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
        assignedTo: input.assignedTo ?? existing.assignedTo,
        resolvedAt: ['resolved', 'closed'].includes(input.status) ? new Date() : null,
        updatedBy: ctx.userId,
      })
      .where(and(eq(complaints.tenantId, ctx.tenantId), eq(complaints.id, input.complaintId)));

    await auditRecord({
        action: 'update',
        entityType: 'complaint',
        entityId: input.complaintId,
        before: {
              status: existing.status,
              assignedTo: existing.assignedTo,
              resolutionNotes: existing.resolutionNotes,
            },
        after: {
              status: input.status,
              assignedTo: input.assignedTo ?? existing.assignedTo,
              resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
            },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('crm.resolveComplaint.failed', e));
  }
}

// ─── Compensations ─────────────────────────────────────────────────────────

/**
 * Award compensation for a resolved complaint.
 * Creates journal entry for cash/refund compensations.
 */
export async function awardCompensation(
  input: {
    complaintId: string;
    kind: string;
    value: number;
    description?: string;
    journalEntryId?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ id: string; journalEntryId?: string }>> {
  try {
    if (input.value <= 0) {
      return err(
        AppError.validation('crm.invalidCompensationValue', {
          issues: [{ message: 'Compensation value must be strictly positive.' }],
        }),
      );
    }

    // Verify complaint exists
    const complaint = await db
      .select()
      .from(complaints)
      .where(and(eq(complaints.tenantId, ctx.tenantId), eq(complaints.id, input.complaintId)))
      .then((r) => r[0]);

    if (!complaint)
      return err(AppError.notFound('crm.complaintNotFound', { id: input.complaintId }));

    const locationId = complaint.locationId ?? ctx.locationId;
    const scopedCtx = { ...ctx, locationId };
    const permCheck = await requirePermission(ctx.userId, 'crm.awardCompensation', {
      locationId,
    });
    if (!permCheck.ok) return permCheck;

    // For cash/refund → create journal entry
    let jeId: string | undefined;
    if (input.kind === 'refund_cash' && input.value > 0) {
      const expenseAccount = await resolveAccountIdByCode(ctx.tenantId, '6-2100');
      if (!expenseAccount.ok) return expenseAccount;
      const cashAccount = await resolveAccountIdByCode(ctx.tenantId, '1-1300');
      if (!cashAccount.ok) return cashAccount;
      const postingDate = new Date().toISOString().slice(0, 10);
      const jeResult = await createJournal(
        {
          postingDate,
          locationId,
          description: `Compensation refund — complaint ${input.complaintId}`,
          referenceType: 'manual',
          referenceId: input.complaintId,
          lines: [
            {
              accountId: expenseAccount.value,
              locationId,
              description: `Compensation ${input.description ?? input.kind}`,
              debit: String(input.value),
              credit: '0',
            },
            {
              accountId: cashAccount.value,
              locationId,
              description: `Compensation refund`,
              debit: '0',
              credit: String(input.value),
            },
          ],
        },
        scopedCtx,
      );
      if (jeResult.ok) jeId = jeResult.value.id;
    }

    // For voucher compensation → create member voucher
    if (input.kind === 'voucher' && complaint.memberId) {
      const voucherCode = `CMP-${Date.now().toString(36).toUpperCase()}`;
      const validFrom = new Date();
      const validUntil = new Date(validFrom);
      validUntil.setDate(validUntil.getDate() + 30); // 30-day validity

      await db.insert(memberVouchers).values({
        id: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        memberId: complaint.memberId,
        code: voucherCode,
        kind: 'discount_fixed',
        value: input.value,
        minOrderValue: 0,
        validFrom,
        validUntil,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    const compId = crypto.randomUUID();
    await db.insert(complaintCompensations).values({
      id: compId,
      tenantId: ctx.tenantId,
      locationId,
      complaintId: input.complaintId,
      kind: input.kind,
      value: input.value,
      description: input.description,
      journalEntryId: jeId,
      approvedBy: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await auditRecord({
        action: 'create',
        entityType: 'complaint_compensation',
        entityId: compId,
        before: null,
        after: {
              complaintId: input.complaintId,
              kind: input.kind,
              value: input.value,
              journalEntryId: jeId ?? null,
            },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

    return ok({ id: compId, journalEntryId: jeId });
  } catch (e) {
    return err(AppError.internal('crm.awardCompensation.failed', e));
  }
}

// ─── Loyalty earn (POS integration) ─────────────────────────────────────────

/**
 * Earn points for a member after a sale.
 * Called from pos.createSale when customerId is a member.
 * SD §21.9 — 1 point per Rp 10,000; auto-upgrade tier.
 */
export async function earnLoyaltyPoints(
  memberId: string,
  amountCents: bigint,
  saleId: string,
  ctx: AuditContext,
): Promise<Result<{ pointsEarned: number; newBalance: number; tier: string }>> {
  try {
    const config = await getLoyaltyConfig(ctx.tenantId);
    // amountCents is in IDR cents (rupiah × 100); divide by (rupiahPerPoint × 100)
    const divisorCents = config.rupiahPerPoint * 100;
    const pointsEarned = divisorCents > 0 ? Math.floor(Number(amountCents) / divisorCents) : 0;

    // Fetch loyalty record
    let loyaltyRows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, memberId))
      .limit(1);

    if (!loyaltyRows[0]) {
      // Auto-create loyalty account on first purchase
      await db.insert(memberLoyalty).values({
        id: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        memberId,
        points: 0,
        lifetimePoints: 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      loyaltyRows = await db
        .select()
        .from(memberLoyalty)
        .where(eq(memberLoyalty.memberId, memberId))
        .limit(1);
    }

    const record = loyaltyRows[0];
    if (!record) return err(AppError.internal('crm.loyalty.recordNotFound'));

    const newPoints = record.points + pointsEarned;
    const newLifetime = record.lifetimePoints + pointsEarned;
    const newTier = computeTierFromConfig(newLifetime, config);

    await db
      .update(memberLoyalty)
      .set({
        points: newPoints,
        lifetimePoints: newLifetime,
        tier: newTier,
        lastEarnedAt: new Date(),
        tierUpgradedAt: newTier !== record.tier ? new Date() : record.tierUpgradedAt,
        updatedBy: ctx.userId,
      })
      .where(eq(memberLoyalty.id, record.id));

    // Transaction log
    await db.insert(memberPointsTransactions).values({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      memberId,
      loyaltyId: record.id,
      type: 'earn',
      points: pointsEarned,
      balanceAfter: newPoints,
      referenceType: 'sales_order',
      referenceId: saleId,
      description: { id: 'Pembelian', en: 'Purchase', zh: '购买' },
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return ok({ pointsEarned, newBalance: newPoints, tier: newTier });
  } catch (e) {
    return err(AppError.internal('crm.earnLoyaltyPoints.failed', e));
  }
}

/** Compute tier from a loyalty config: highest tier whose threshold is met. */
export function computeTierFromConfig(
  lifetimePoints: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG,
): string {
  let resolved = config.tiers[0]?.code ?? 'bronze';
  for (const tier of config.tiers) {
    if (lifetimePoints >= tier.minLifetimePoints) resolved = tier.code;
  }
  return resolved;
}

/** Legacy helper kept for callers; uses the default config (synchronous). */
export function computeTier(lifetimePoints: number): string {
  return computeTierFromConfig(lifetimePoints, DEFAULT_LOYALTY_CONFIG);
}

// ─── Loyalty redeem ──────────────────────────────────────────────────────────

/**
 * Redeem points for a voucher.
 * SD §21.9 — configurable redemption rate.
 */
export async function redeemLoyaltyPoints(
  input: {
    memberId: string;
    pointsToRedeem: number;
    voucherKind: 'discount_percent' | 'discount_fixed' | 'free_delivery';
    voucherValue: number;
    description?: Record<string, string>;
  },
  ctx: AuditContext,
): Promise<Result<{ voucherCode: string; pointsRemaining: number }>> {
  try {
    if (input.pointsToRedeem <= 0) {
      return err(
        AppError.validation('crm.invalidPoints', {
          issues: [{ message: 'Points to redeem must be strictly positive.' }],
        }),
      );
    }

    const loyaltyRows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, input.memberId))
      .limit(1);

    const record = loyaltyRows[0];
    if (!record)
      return err(AppError.notFound('crm.memberLoyaltyNotFound', { memberId: input.memberId }));

    if (record.points < input.pointsToRedeem) {
      return err(
        AppError.businessRule('crm.insufficientPoints', {
          available: record.points,
          required: input.pointsToRedeem,
        }),
      );
    }

    // Deduct points
    const newBalance = record.points - input.pointsToRedeem;
    await db
      .update(memberLoyalty)
      .set({ points: newBalance, updatedBy: ctx.userId })
      .where(eq(memberLoyalty.id, record.id));

    // Generate voucher code
    const voucherCode = `PTS-${Date.now().toString(36).toUpperCase()}`;
    const validFrom = new Date();
    const validUntil = new Date(validFrom);
    validUntil.setDate(validUntil.getDate() + 30);

    await db.insert(memberVouchers).values({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      memberId: input.memberId,
      code: voucherCode,
      kind: input.voucherKind,
      value: input.voucherValue,
      minOrderValue: 0,
      validFrom,
      validUntil,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Log transaction
    await db.insert(memberPointsTransactions).values({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      memberId: input.memberId,
      loyaltyId: record.id,
      type: 'redeem',
      points: -input.pointsToRedeem,
      balanceAfter: newBalance,
      referenceType: 'voucher_redeem',
      referenceId: voucherCode,
      description: input.description ?? { id: 'Tukar poin', en: 'Redeem points', zh: '兑换积分' },
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return ok({ voucherCode, pointsRemaining: newBalance });
  } catch (e) {
    return err(AppError.internal('crm.redeemLoyaltyPoints.failed', e));
  }
}


// Re-export the member-data service (T-0183).
export * from './member-service';
