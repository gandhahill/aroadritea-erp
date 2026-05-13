/**
 * CRM Service — SD §21.9, §9.7, §31.5
 *
 * - Complaints log with status workflow
 * - Compensation tracking (product replacement, voucher, refund)
 * - Loyalty earn/redeem integrated with POS sale
 * - Tier upgrade logic (bronze → silver → gold)
 */

import { eq, and, desc, gte, asc } from 'drizzle-orm';
import { db } from '@erp/db';
import { complaints, complaintCompensations } from '@erp/db/schema/crm';
import { memberLoyalty, memberVouchers, memberPointsTransactions } from '@erp/db/schema/member';
import { partners } from '@erp/db/schema/accounting';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { createJournal } from '../accounting/create-journal';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_THRESHOLDS = { bronze: 0, silver: 50_000, gold: 150_000 };
const POINTS_PER_RP10K = 1; // 1 point per Rp 10,000

const VOUCHER_KIND_MAP: Record<string, string> = {
  product_replacement: 'free_item',
  voucher: 'discount_fixed',
  refund_cash: 'discount_fixed',
  discount: 'discount_percent',
};

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
      customerPhone: input.customerPhone ?? null,
      orderId: input.orderId ?? null,
      orderNumber: input.orderNumber ?? null,
      occurredAt: new Date(input.occurredAt),
      category: input.category,
      description: input.description,
      priority: input.priority ?? 'medium',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
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
  const permCheck = await requirePermission(ctx.userId, 'crm.listComplaints', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const rows = await db
      .select()
      .from(complaints)
      .where(
        and(
          eq(complaints.tenantId, ctx.tenantId),
          input.locationId ? eq(complaints.locationId, input.locationId) : undefined,
          input.status ? eq(complaints.status, input.status) : undefined,
          input.from ? gte(complaints.occurredAt, new Date(input.from)) : undefined,
        ),
      )
      .orderBy(desc(complaints.reportedAt))
      .limit((input.limit ?? 50) + 1);

    const hasMore = rows.length > (input.limit ?? 50);
    const items = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id as string) : undefined;

    return ok({ items: items as Record<string, unknown>[], nextCursor });
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
  const permCheck = await requirePermission(ctx.userId, 'crm.resolveComplaint', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const existing = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, input.complaintId))
      .then((r) => r[0]);

    if (!existing) return err(AppError.notFound('crm.complaintNotFound', { id: input.complaintId }));

    await db
      .update(complaints)
      .set({
        status: input.status,
        resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
        assignedTo: input.assignedTo ?? existing.assignedTo,
        resolvedAt: ['resolved', 'closed'].includes(input.status) ? new Date() : null,
        updatedBy: ctx.userId,
      })
      .where(eq(complaints.id, input.complaintId));

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
  const permCheck = await requirePermission(ctx.userId, 'crm.awardCompensation', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    // Verify complaint exists
    const complaint = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, input.complaintId))
      .then((r) => r[0]);

    if (!complaint) return err(AppError.notFound('crm.complaintNotFound', { id: input.complaintId }));

    // For cash/refund → create journal entry
    let jeId: string | undefined;
    if (input.kind === 'refund_cash' && input.value > 0) {
      const postingDate = new Date().toISOString().slice(0, 10);
      const jeResult = await createJournal(
        {
          postingDate,
          locationId: ctx.locationId,
          description: `Compensation refund — complaint ${input.complaintId}`,
          referenceType: 'manual',
          referenceId: input.complaintId,
          lines: [
            {
              accountId: '6-1050', // Beban Comp / Biaya Compensasi
              locationId: ctx.locationId,
              description: `Compensation ${input.description ?? input.kind}`,
              debit: String(input.value),
              credit: '0',
            },
            {
              accountId: '1-1030', // Kas
              locationId: ctx.locationId,
              description: `Compensation refund`,
              debit: '0',
              credit: String(input.value),
            },
          ],
        },
        ctx,
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
      locationId: ctx.locationId,
      complaintId: input.complaintId,
      kind: input.kind,
      value: input.value,
      description: input.description,
      journalEntryId: jeId,
      approvedBy: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
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
    const pointsEarned = Math.floor(Number(amountCents) / 10_000_000); // amountCents is in IDR cents (100x rupiah)

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
      loyaltyRows = await db.select().from(memberLoyalty).where(eq(memberLoyalty.memberId, memberId)).limit(1);
    }

    const record = loyaltyRows[0];
    if (!record) return err(AppError.internal('crm.loyalty.recordNotFound'));

    const newPoints = record.points + pointsEarned;
    const newLifetime = record.lifetimePoints + pointsEarned;
    const newTier = computeTier(newLifetime);

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

/** Compute tier based on lifetime points. */
export function computeTier(lifetimePoints: number): string {
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return 'gold';
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
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
    const loyaltyRows = await db
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, input.memberId))
      .limit(1);

    const record = loyaltyRows[0];
    if (!record) return err(AppError.notFound('crm.memberLoyaltyNotFound', { memberId: input.memberId }));

    if (record.points < input.pointsToRedeem) {
      return err(AppError.businessRule('crm.insufficientPoints', {
        available: record.points,
        required: input.pointsToRedeem,
      }));
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