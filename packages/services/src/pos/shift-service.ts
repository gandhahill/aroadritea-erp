/**
 * POS shift service — SD §21.4, §9.5
 *
 * Opens and closes cashier shifts.
 * Tracks opening cash, calculates expected cash, records variance.
 *
 * Permission: pos.shift.open, pos.shift.close
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { payments, salesOrders, shifts } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { CloseShiftInputSchema, OpenShiftInputSchema } from './schemas';
import type { ShiftResult } from './schemas';

type ShiftRow = {
  id: string;
  tenantId: string;
  locationId: string;
  openedBy: string;
  openedAt: Date;
  openingCash: bigint;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
};

// ─── Open Shift ─────────────────────────────────────────────────────────────

/**
 * Open a new cashier shift at a location.
 * Only one open shift per location is allowed at any time.
 */
export async function openShift(input: unknown, ctx: AuditContext): Promise<Result<ShiftResult>> {
  const parsed = OpenShiftInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.shift.open.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'pos.shift.open', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    // Check no open shift exists for this location
    const existing = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.tenantId, ctx.tenantId),
          eq(shifts.locationId, data.locationId),
          eq(shifts.status, 'open'),
        ),
      )
      .then((r) => r[0]);

    if (existing) {
      return err(AppError.businessRule('pos.shift.alreadyOpen', { locationId: data.locationId }));
    }

    const shiftId = generateId();

    await db.insert(shifts).values({
      id: shiftId,
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      openedBy: ctx.userId,
      openedAt: new Date(),
      openingCash: BigInt(data.openingCash),
      status: 'open',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'shift',
      entityId: shiftId,
      before: null,
      after: { status: 'open', openingCash: data.openingCash },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok({
      id: shiftId,
      locationId: data.locationId,
      status: 'open',
      openingCash: data.openingCash,
      openedBy: ctx.userId,
      openedAt: new Date().toISOString(),
      expectedCash: null,
      actualCash: null,
      variance: null,
      closedBy: null,
      closedAt: null,
    });
  } catch (e) {
    return err(AppError.internal('pos.shift.openFailed', e));
  }
}

// ─── Close Shift ─────────────────────────────────────────────────────────────

/**
 * Close a cashier shift.
 * Calculates expected cash = opening + sum(cash payments) - sum(cash refunds)
 * Records actualCash from cashier input and variance.
 *
 * Permission: pos.shift.close
 */
export async function closeShift(input: unknown, ctx: AuditContext): Promise<Result<ShiftResult>> {
  const parsed = CloseShiftInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.shift.close.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const rawShift = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.tenantId, ctx.tenantId), eq(shifts.id, data.shiftId)))
      .then((r) => r[0]);

    if (!rawShift) {
      return err(AppError.notFound('pos.shift.notFound', { shiftId: data.shiftId }));
    }
    const shift = rawShift as unknown as ShiftRow;
    const permCheck = await requirePermission(ctx.userId, 'pos.shift.close', {
      locationId: shift.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (shift.status !== 'open') {
      return err(AppError.businessRule('pos.shift.notOpen', { currentStatus: shift.status }));
    }
    if (shift.version !== data.version) {
      return err(AppError.conflict('pos.shift.versionMismatch'));
    }

    // Calculate expected cash from all cash payments in this shift
    const allPayments = await db
      .select({ amount: payments.amount })
      .from(payments)
      .innerJoin(salesOrders, eq(payments.salesOrderId, salesOrders.id))
      .where(
        and(
          eq(salesOrders.tenantId, ctx.tenantId),
          eq(salesOrders.shiftId, data.shiftId),
          eq(salesOrders.status, 'paid'),
          eq(payments.method, 'cash'),
        ),
      );

    const cashTotal = allPayments.reduce((sum, p) => sum + p.amount, BigInt(0));

    // Expected cash = opening + retained cash payments received.
    const expectedCash = shift.openingCash + cashTotal;
    const actualCash = BigInt(data.actualCash);
    const variance = actualCash - expectedCash;

    await db
      .update(shifts)
      .set({
        status: 'closed',
        closedBy: ctx.userId,
        closedAt: new Date(),
        actualCash: BigInt(data.actualCash),
        expectedCash,
        variance,
        updatedBy: ctx.userId,
      } as typeof shifts.$inferInsert)
      .where(and(eq(shifts.id, data.shiftId)));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'shift',
      entityId: data.shiftId,
      before: { status: 'open' },
      after: {
        status: 'closed',
        expectedCash: expectedCash.toString(),
        actualCash: data.actualCash,
        variance: variance.toString(),
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok({
      id: shift.id,
      locationId: shift.locationId,
      status: 'closed',
      openingCash: shift.openingCash.toString(),
      openedBy: shift.openedBy,
      openedAt: shift.openedAt.toISOString(),
      expectedCash: expectedCash.toString(),
      actualCash: data.actualCash,
      variance: variance.toString(),
      closedBy: ctx.userId,
      closedAt: new Date().toISOString(),
    });
  } catch (e) {
    return err(AppError.internal('pos.shift.closeFailed', e));
  }
}

// ─── Get Active Shift ─────────────────────────────────────────────────────────

/**
 * Returns the currently open shift for a location, if any.
 * Used by POS UI to pre-fill shift context.
 */
export async function getOpenShift(
  locationId: string,
  ctx: AuditContext,
): Promise<Result<ShiftResult | null>> {
  try {
    const shift = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.tenantId, ctx.tenantId),
          eq(shifts.locationId, locationId),
          eq(shifts.status, 'open'),
        ),
      )
      .then((r) => r[0]);

    if (!shift) return ok(null);

    const cashPayments = await db
      .select({ amount: payments.amount })
      .from(payments)
      .innerJoin(salesOrders, eq(payments.salesOrderId, salesOrders.id))
      .where(
        and(
          eq(salesOrders.tenantId, ctx.tenantId),
          eq(salesOrders.shiftId, shift.id),
          eq(salesOrders.status, 'paid'),
          eq(payments.method, 'cash'),
        ),
      );
    const cashTotal = cashPayments.reduce((sum, payment) => sum + payment.amount, BigInt(0));
    const expectedCash = shift.openingCash + cashTotal;

    return ok({
      id: shift.id,
      locationId: shift.locationId,
      status: shift.status,
      openingCash: shift.openingCash.toString(),
      openedBy: shift.openedBy,
      openedAt: shift.openedAt.toISOString(),
      expectedCash: expectedCash.toString(),
      actualCash: null,
      variance: null,
      closedBy: null,
      closedAt: null,
    });
  } catch (e) {
    return err(AppError.internal('pos.shift.getFailed', e));
  }
}
