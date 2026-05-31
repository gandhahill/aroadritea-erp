/**
 * CRM member-data service — T-0183.
 *
 * Management/admin can:
 *   - list members (filter by tier, search by name/email/phone)
 *   - read a single member's full profile + loyalty + last N points
 *     transactions
 *   - adjust loyalty points with reason (audit trail required)
 *
 * Members live in `partners` (kind='customer', is_member=true) so the
 * existing partner schema doesn't grow a parallel table. Loyalty data
 * lives in `member_loyalty`. Points history in
 * `member_points_transactions`.
 */

import { db } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { memberLoyalty, memberPointsTransactions } from '@erp/db/schema/member';
import { salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MemberSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tier: string;
  points: number;
  lifetimePoints: number;
  isActive: boolean;
  joinedAt: string;
}

export interface MemberPointsTransaction {
  id: string;
  type: string; // earn | redeem | expire | adjust
  delta: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
}

export interface MemberDetail extends MemberSummary {
  npwp: string | null;
  address: string | null;
  city: string | null;
  birthDate: string | null;
  lastEarnedAt: string | null;
  recentTransactions: MemberPointsTransaction[];
}

export interface ListMembersFilter {
  search?: string;
  tier?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

// ─── list ─────────────────────────────────────────────────────────────────

export async function listMembers(
  filter: ListMembersFilter,
  ctx: AuditContext,
): Promise<Result<{ items: MemberSummary[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'crm.member.view');
  if (!permCheck.ok) return permCheck;

  const conds = [eq(partners.tenantId, ctx.tenantId), eq(partners.isMember, true)];
  if (filter.activeOnly) conds.push(eq(partners.isActive, true));
  if (filter.search?.trim()) {
    const q = `%${filter.search.trim()}%`;
    // email + phone are encrypted at-rest — search by name only.
    conds.push(or(ilike(partners.name, q), ilike(partners.city, q))!);
  }

  // Join loyalty so we can filter by tier in one trip.
  const limit = Math.min(filter.limit ?? 50, 200);
  const offset = filter.offset ?? 0;

  const baseQuery = db
    .select({
      id: partners.id,
      name: partners.name,
      email: partners.email,
      phone: partners.phone,
      isActive: partners.isActive,
      createdAt: partners.createdAt,
      tier: memberLoyalty.tier,
      points: memberLoyalty.points,
      lifetimePoints: memberLoyalty.lifetimePoints,
    })
    .from(partners)
    .leftJoin(memberLoyalty, eq(memberLoyalty.memberId, partners.id));

  const finalConds = [...conds];
  if (filter.tier) finalConds.push(eq(memberLoyalty.tier, filter.tier));

  const rows = await baseQuery
    .where(and(...finalConds))
    .orderBy(desc(partners.createdAt))
    .limit(limit)
    .offset(offset);

  // total count for paginator
  const [totalRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(partners)
    .leftJoin(memberLoyalty, eq(memberLoyalty.memberId, partners.id))
    .where(and(...finalConds));

  return ok({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      tier: r.tier ?? 'bronze',
      points: Number(r.points ?? 0),
      lifetimePoints: Number(r.lifetimePoints ?? 0),
      isActive: r.isActive,
      joinedAt: r.createdAt.toISOString(),
    })),
    total: Number(totalRow?.count ?? 0),
  });
}

// ─── get detail ───────────────────────────────────────────────────────────

export async function getMemberDetail(
  memberId: string,
  ctx: AuditContext,
): Promise<Result<MemberDetail>> {
  const permCheck = await requirePermission(ctx.userId, 'crm.member.view');
  if (!permCheck.ok) return permCheck;

  const [row] = await db
    .select()
    .from(partners)
    .where(
      and(
        eq(partners.tenantId, ctx.tenantId),
        eq(partners.id, memberId),
        eq(partners.isMember, true),
      ),
    )
    .limit(1);
  if (!row) return err(AppError.notFound('crm.member.notFound'));

  const [loyalty] = await db
    .select()
    .from(memberLoyalty)
    .where(eq(memberLoyalty.memberId, memberId))
    .limit(1);

  const recentTx = await db
    .select()
    .from(memberPointsTransactions)
    .where(eq(memberPointsTransactions.memberId, memberId))
    .orderBy(desc(memberPointsTransactions.createdAt))
    .limit(30);

  return ok({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    npwp: row.npwp,
    address: row.address,
    city: row.city,
    birthDate: row.birthDate?.toISOString() ?? null,
    tier: loyalty?.tier ?? 'bronze',
    points: Number(loyalty?.points ?? 0),
    lifetimePoints: Number(loyalty?.lifetimePoints ?? 0),
    isActive: row.isActive,
    joinedAt: row.createdAt.toISOString(),
    lastEarnedAt: loyalty?.lastEarnedAt?.toISOString() ?? null,
    recentTransactions: recentTx.map((t) => {
      const descObj = t.description as Record<string, string> | null;
      const reason = descObj?.id ?? descObj?.en ?? descObj?.zh ?? null;
      return {
        id: t.id,
        type: t.type,
        delta: Number(t.points),
        balanceAfter: Number(t.balanceAfter),
        reason,
        createdAt: t.createdAt.toISOString(),
      };
    }),
  });
}

// ─── adjust points ────────────────────────────────────────────────────────

export async function adjustMemberPoints(
  input: { memberId: string; delta: number; reason: string },
  ctx: AuditContext,
): Promise<Result<{ balanceAfter: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'crm.member.adjustPoints');
  if (!permCheck.ok) return permCheck;

  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return err(AppError.validation('crm.member.invalidDelta'));
  }
  if (!input.reason?.trim() || input.reason.trim().length < 3) {
    return err(AppError.validation('crm.member.reasonRequired'));
  }

  return await db.transaction(async (tx) => {
    const loyaltyRows = await tx
      .select()
      .from(memberLoyalty)
      .where(eq(memberLoyalty.memberId, input.memberId))
      .limit(1)
      .for('update');
      
    const loyalty = loyaltyRows[0];
    if (!loyalty) return err(AppError.notFound('crm.member.loyaltyNotFound'));

    const newBalance = loyalty.points + input.delta;
    if (newBalance < 0) {
      return err(
        AppError.businessRule('crm.member.wouldGoNegative', {
          current: loyalty.points,
          delta: input.delta,
        }),
      );
    }

    await tx
      .update(memberLoyalty)
      .set({
        points: newBalance,
        // Lifetime never decreases — only earning grows it.
        lifetimePoints:
          input.delta > 0 ? loyalty.lifetimePoints + input.delta : loyalty.lifetimePoints,
        updatedBy: ctx.userId,
      })
      .where(eq(memberLoyalty.id, loyalty.id));

    await tx.insert(memberPointsTransactions).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      memberId: input.memberId,
      loyaltyId: loyalty.id,
      type: 'adjust',
      points: input.delta,
      balanceAfter: newBalance,
      referenceType: 'manual_adjust',
      referenceId: null,
      description: {
        id: input.reason.trim(),
        en: input.reason.trim(),
        zh: input.reason.trim(),
      },
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await auditRecord({
      action: 'update',
      entityType: 'member',
      entityId: input.memberId,
      before: { points: loyalty.points },
      after: { points: newBalance, delta: input.delta, reason: input.reason.trim() },
      ctx,
    });

    return ok({ balanceAfter: newBalance });
  });
}

// ─── purchase history ─────────────────────────────────────────────────────

export async function getMemberPurchaseHistory(
  memberId: string,
  ctx: AuditContext,
): Promise<Result<{ items: Record<string, unknown>[] }>> {
  const permCheck = await requirePermission(ctx.userId, 'crm.member.view');
  if (!permCheck.ok) return permCheck;

  try {
    const rows = await db
      .select({
        id: salesOrders.id,
        number: salesOrders.number,
        placedAt: salesOrders.placedAt,
        channel: salesOrders.channel,
        grandTotal: salesOrders.grandTotal,
        status: salesOrders.status,
      })
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenantId), eq(salesOrders.customerId, memberId)))
      .orderBy(desc(salesOrders.placedAt))
      .limit(50);

    return ok({
      items: rows.map(r => ({
        ...r,
        grandTotal: r.grandTotal.toString(),
        placedAt: r.placedAt.toISOString(),
      }))
    });
  } catch (e) {
    return err(AppError.internal('crm.member.historyFailed', e));
  }
}

