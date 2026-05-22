/**
 * kitchen/kds-service.ts — KDS production status tracking (SD §21.7)
 *
 * Tracks order line items through: queued → making → ready → served
 * Separate from Naixer — this is Aroadri's internal kitchen workflow.
 */

import { db } from '@erp/db';
import { kdsOrderItems } from '@erp/db/schema/kitchen';
import { salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

// ─── Types ──────────────────────────────────────────────────────────────────

export type KdsStatus = 'queued' | 'making' | 'ready' | 'served' | 'cancelled';

export interface QueueOrderItemsInput {
  salesOrderId: string;
  pickupNumber: number;
}

export interface UpdateKdsStatusInput {
  kdsItemId: string;
  newStatus: KdsStatus;
}

export interface ListKdsItemsInput {
  locationId: string;
  status?: KdsStatus;
  limit?: number;
}

export interface KdsItemResult {
  id: string;
  salesOrderId: string;
  salesOrderLineId: string;
  status: KdsStatus;
  pickupNumber: number;
  productSummary: string;
  qrPayload: string | null;
  queuedAt: Date;
  makingAt: Date | null;
  readyAt: Date | null;
  servedAt: Date | null;
  preparedBy: string | null;
}

export interface KdsStatsResult {
  queued: number;
  making: number;
  ready: number;
  served: number;
  cancelled: number;
}

// ─── Status transitions ─────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<KdsStatus, KdsStatus[]> = {
  queued: ['making', 'cancelled'],
  making: ['ready', 'queued', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: [],
  cancelled: [],
};

export function isValidTransition(from: KdsStatus, to: KdsStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Queue order items ──────────────────────────────────────────────────────

export async function queueOrderItems(
  input: QueueOrderItemsInput,
  ctx: AuditContext,
): Promise<Result<KdsItemResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // Tenant-scope the order lookup. Without it a caller from tenant A
  // could queue lines from tenant B's order into A's kitchen display.
  const [order] = await db
    .select()
    .from(salesOrders)
    .where(and(eq(salesOrders.id, input.salesOrderId), eq(salesOrders.tenantId, ctx.tenantId)))
    .limit(1);

  if (!order) {
    return err(
      AppError.notFound('kitchen.errors.order_not_found', {
        salesOrderId: input.salesOrderId,
      }),
    );
  }

  const lines = await db
    .select()
    .from(salesOrderLines)
    .where(eq(salesOrderLines.salesOrderId, input.salesOrderId));

  if (lines.length === 0) {
    return err(
      AppError.validation('kitchen.errors.no_order_lines', {
        salesOrderId: input.salesOrderId,
      }),
    );
  }

  const now = new Date();
  const results: KdsItemResult[] = [];

  for (const line of lines) {
    const productSummary = buildProductSummary(line);
    const id = generateId();

    await db.insert(kdsOrderItems).values({
      id,
      tenantId: ctx.tenantId,
      locationId: ctx.locationId,
      salesOrderId: input.salesOrderId,
      salesOrderLineId: line.id,
      status: 'queued',
      pickupNumber: input.pickupNumber,
      productSummary,
      qrPayload: line.kdsQrPayload,
      queuedAt: now,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    results.push({
      id,
      salesOrderId: input.salesOrderId,
      salesOrderLineId: line.id,
      status: 'queued',
      pickupNumber: input.pickupNumber,
      productSummary,
      qrPayload: line.kdsQrPayload,
      queuedAt: now,
      makingAt: null,
      readyAt: null,
      servedAt: null,
      preparedBy: null,
    });
  }

  await auditRecord({
    action: 'create',
    entityType: 'kds_order_item',
    entityId: input.salesOrderId,
    after: {
      salesOrderId: input.salesOrderId,
      pickupNumber: input.pickupNumber,
      itemCount: results.length,
    },
    ctx,
  });

  return ok(results);
}

// ─── Update status ──────────────────────────────────────────────────────────

export async function updateKdsStatus(
  input: UpdateKdsStatusInput,
  ctx: AuditContext,
): Promise<Result<KdsItemResult>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const [item] = await db
    .select()
    .from(kdsOrderItems)
    .where(and(eq(kdsOrderItems.id, input.kdsItemId), eq(kdsOrderItems.tenantId, ctx.tenantId)))
    .limit(1);

  if (!item) {
    return err(
      AppError.notFound('kitchen.errors.kds_item_not_found', {
        kdsItemId: input.kdsItemId,
      }),
    );
  }

  const currentStatus = item.status as KdsStatus;
  if (!isValidTransition(currentStatus, input.newStatus)) {
    return err(
      AppError.businessRule('kitchen.errors.invalid_status_transition', {
        from: currentStatus,
        to: input.newStatus,
      }),
    );
  }

  const now = new Date();
  const updateFields: Record<string, unknown> = {
    status: input.newStatus,
    updatedAt: now,
    updatedBy: ctx.userId,
  };

  if (input.newStatus === 'making') {
    updateFields.makingAt = now;
    updateFields.preparedBy = ctx.userId;
  } else if (input.newStatus === 'ready') {
    updateFields.readyAt = now;
  } else if (input.newStatus === 'served') {
    updateFields.servedAt = now;
  }

  await db.update(kdsOrderItems).set(updateFields).where(eq(kdsOrderItems.id, input.kdsItemId));

  await auditRecord({
    action: 'update',
    entityType: 'kds_order_item',
    entityId: input.kdsItemId,
    before: { status: currentStatus },
    after: { status: input.newStatus },
    ctx,
  });

  return ok({
    id: item.id,
    salesOrderId: item.salesOrderId,
    salesOrderLineId: item.salesOrderLineId,
    status: input.newStatus,
    pickupNumber: item.pickupNumber,
    productSummary: item.productSummary,
    qrPayload: item.qrPayload,
    queuedAt: item.queuedAt,
    makingAt: input.newStatus === 'making' ? now : item.makingAt,
    readyAt: input.newStatus === 'ready' ? now : item.readyAt,
    servedAt: input.newStatus === 'served' ? now : item.servedAt,
    preparedBy: input.newStatus === 'making' ? ctx.userId : item.preparedBy,
  });
}

// ─── List KDS items ─────────────────────────────────────────────────────────

export async function listKdsItems(
  input: ListKdsItemsInput,
  ctx: AuditContext,
): Promise<Result<KdsItemResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const conditions = [
    eq(kdsOrderItems.tenantId, ctx.tenantId),
    eq(kdsOrderItems.locationId, input.locationId),
  ];
  if (input.status) {
    conditions.push(eq(kdsOrderItems.status, input.status));
  }

  const rows = await db
    .select()
    .from(kdsOrderItems)
    .where(and(...conditions))
    .orderBy(desc(kdsOrderItems.queuedAt))
    .limit(input.limit ?? 50);

  return ok(
    rows.map((r) => ({
      id: r.id,
      salesOrderId: r.salesOrderId,
      salesOrderLineId: r.salesOrderLineId,
      status: r.status as KdsStatus,
      pickupNumber: r.pickupNumber,
      productSummary: r.productSummary,
      qrPayload: r.qrPayload,
      queuedAt: r.queuedAt,
      makingAt: r.makingAt,
      readyAt: r.readyAt,
      servedAt: r.servedAt,
      preparedBy: r.preparedBy,
    })),
  );
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getKdsStats(
  locationId: string,
  ctx: AuditContext,
): Promise<Result<KdsStatsResult>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  const rows = await db
    .select({
      status: kdsOrderItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(kdsOrderItems)
    .where(and(eq(kdsOrderItems.tenantId, ctx.tenantId), eq(kdsOrderItems.locationId, locationId)))
    .groupBy(kdsOrderItems.status);

  const stats: KdsStatsResult = {
    queued: 0,
    making: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    const s = row.status as KdsStatus;
    if (s in stats) {
      stats[s] = row.count;
    }
  }

  return ok(stats);
}

// ─── Cancel all items for an order ──────────────────────────────────────────

export async function cancelOrderItems(
  salesOrderId: string,
  ctx: AuditContext,
): Promise<Result<number>> {
  const permCheck = await requirePermission(ctx.userId, 'kitchen.view', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const items = await db
    .select({ id: kdsOrderItems.id, status: kdsOrderItems.status })
    .from(kdsOrderItems)
    .where(
      and(eq(kdsOrderItems.tenantId, ctx.tenantId), eq(kdsOrderItems.salesOrderId, salesOrderId)),
    );

  let cancelled = 0;
  for (const item of items) {
    const status = item.status as KdsStatus;
    if (status === 'served' || status === 'cancelled') continue;

    await db
      .update(kdsOrderItems)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(and(eq(kdsOrderItems.id, item.id), eq(kdsOrderItems.tenantId, ctx.tenantId)));
    cancelled++;
  }

  if (cancelled > 0) {
    await auditRecord({
      action: 'cancel',
      entityType: 'kds_order_item',
      entityId: salesOrderId,
      after: { cancelledCount: cancelled },
      ctx,
    });
  }

  return ok(cancelled);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildProductSummary(line: typeof salesOrderLines.$inferSelect): string {
  const parts: string[] = [`Product: ${line.productId}`];
  if (line.modifierJson) {
    const mods = line.modifierJson as {
      sugar?: string;
      ice?: string;
      toppings?: Array<{ name: string }>;
    };
    if (mods.sugar) parts.push(`Sugar: ${mods.sugar}`);
    if (mods.ice) parts.push(`Ice: ${mods.ice}`);
    if (mods.toppings?.length) {
      parts.push(`Toppings: ${mods.toppings.map((t) => t.name).join(', ')}`);
    }
  }
  return parts.join(' | ');
}
