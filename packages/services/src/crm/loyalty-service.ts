import { db } from '@erp/db';
import { partners } from '@erp/db/schema/accounting';
import { salesOrders } from '@erp/db/schema/pos';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { eq, and, sql } from 'drizzle-orm';
import type { AuditContext } from '@erp/shared/types';

export const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500_000,
  gold: 2_000_000,
  platinum: 5_000_000,
};

export async function evaluateLoyaltyTier(
  customerId: string,
  ctx: AuditContext,
): Promise<Result<{ oldTier: string; newTier: string }>> {
  const [customer] = await db
    .select({
      id: partners.id,
      lifetimeSpend: partners.lifetimeSpend,
      loyaltyTier: partners.loyaltyTier,
    })
    .from(partners)
    .where(and(eq(partners.id, customerId), eq(partners.tenantId, ctx.tenantId)));

  if (!customer) return err(AppError.notFound('crm.errors.customer_not_found'));

  const spend = Number(customer.lifetimeSpend);
  let newTier = 'bronze';

  if (spend >= TIER_THRESHOLDS.platinum) {
    newTier = 'platinum';
  } else if (spend >= TIER_THRESHOLDS.gold) {
    newTier = 'gold';
  } else if (spend >= TIER_THRESHOLDS.silver) {
    newTier = 'silver';
  }

  if (customer.loyaltyTier !== newTier) {
    await db
      .update(partners)
      .set({ loyaltyTier: newTier, updatedBy: ctx.userId })
      .where(eq(partners.id, customer.id));
  }

  return ok({ oldTier: customer.loyaltyTier ?? 'bronze', newTier });
}

export async function addLifetimeSpend(
  customerId: string,
  amount: bigint,
  ctx: AuditContext,
): Promise<Result<{ newTotal: bigint }>> {
  const [updated] = await db
    .update(partners)
    .set({
      lifetimeSpend: sql`${partners.lifetimeSpend} + ${amount}`,
      updatedBy: ctx.userId,
    })
    .where(and(eq(partners.id, customerId), eq(partners.tenantId, ctx.tenantId)))
    .returning({ lifetimeSpend: partners.lifetimeSpend });

  if (!updated) return err(AppError.notFound('crm.errors.customer_not_found'));

  // Fire and forget tier evaluation
  evaluateLoyaltyTier(customerId, ctx).catch(console.error);

  return ok({ newTotal: updated.lifetimeSpend });
}
