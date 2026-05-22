/**
 * inventory.transfer — SD §9.3, §21.5, §12.3
 *
 * Stock transfer workflow:
 *   draft → in_transit → received | cancelled
 *
 * Transfer between locations (e.g., from warehouse to store).
 * Creates 2 stock_movements per line on ship:
 *   - transfer_out at source location
 *   - transfer_in at destination location
 *
 * On receive: marks as received and updates destination stock_levels.
 *
 * Business rules:
 * - fromLocation ≠ toLocation
 * - Only user with `inventory.transfer` permission can create/ship
 * - Products must exist and be active
 *
 * Permission: inventory.transfer (create + ship + receive)
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import {
  products,
  stockLevels,
  stockMovements,
  stockTransferLines,
  stockTransfers,
} from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';
import { generateTransferNumber } from './number-generator';
import {
  CreateTransferInputSchema,
  ReceiveTransferInputSchema,
  ShipTransferInputSchema,
} from './schemas';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface TransferResult {
  id: string;
  number: string;
  transferDate: string;
  fromLocationId: string;
  toLocationId: string;
  notes: string | null;
  status: string;
  lines: TransferLineResult[];
}

export interface TransferLineResult {
  id: string;
  productId: string;
  variantId: string | null;
  batchNo: string | null;
  qtySent: string;
  qtyReceived: string | null;
  uom: string;
}

// ─── Build result helper ─────────────────────────────────────────────────────

function buildTransferResult(
  trf: Partial<typeof stockTransfers.$inferSelect> & {
    id: string;
    number: string;
    transferDate: string;
    fromLocationId: string;
    toLocationId: string;
    status: string;
    version: number;
    notes: string | null;
  },
  lines: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    batchNo: string | null;
    qtySent: string;
    qtyReceived: string | null;
    uom: string;
  }>,
): TransferResult {
  return {
    id: trf.id,
    number: trf.number,
    transferDate: trf.transferDate,
    fromLocationId: trf.fromLocationId,
    toLocationId: trf.toLocationId,
    notes: trf.notes,
    status: trf.status,
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId ?? null,
      batchNo: l.batchNo ?? null,
      qtySent: l.qtySent,
      qtyReceived: l.qtyReceived ?? null,
      uom: l.uom,
    })),
  };
}

// ─── Create Draft ─────────────────────────────────────────────────────────────

/**
 * Create a new stock transfer in 'draft' status.
 */
export async function createTransferDraft(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.transfer.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  if (data.fromLocationId === data.toLocationId) {
    return err(AppError.businessRule('inventory.transfer.sameLocation'));
  }

  // Validate product IDs
  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  const foundProducts = await db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));
  const productMap = new Map(foundProducts.map((p) => [p.id, p]));

  for (const line of data.lines) {
    const p = productMap.get(line.productId);
    if (!p) {
      return err(
        AppError.notFound('inventory.transfer.productNotFound', { productId: line.productId }),
      );
    }
    if (!p.isActive) {
      return err(
        AppError.businessRule('inventory.transfer.productInactive', { productId: line.productId }),
      );
    }
  }

  const trfId = generateId();
  const trfNumber = await generateTransferNumber(ctx.tenantId, data.transferDate);

  try {
    await db.insert(stockTransfers).values({
      id: trfId,
      tenantId: ctx.tenantId,
      number: trfNumber,
      transferDate: data.transferDate,
      fromLocationId: data.fromLocationId,
      toLocationId: data.toLocationId,
      notes: data.notes ?? null,
      status: 'draft',
      version: 1,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    const lineValues = data.lines.map((line, idx) => ({
      id: generateId(),
      transferId: trfId,
      lineNo: idx + 1,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      qtySent: line.qty,
      qtyReceived: null,
      uom: line.uom,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    await db.insert(stockTransferLines).values(lineValues);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'stock_transfer',
      entityId: trfId,
      before: null,
      after: { number: trfNumber, lineCount: lineValues.length },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok(
      buildTransferResult(
        {
          id: trfId,
          number: trfNumber,
          transferDate: data.transferDate,
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          notes: data.notes ?? null,
          status: 'draft',
          version: 1,
        },
        lineValues,
      ),
    );
  } catch (e) {
    return err(AppError.internal('inventory.transfer.createFailed', e));
  }
}

// ─── Ship (in_transit) ───────────────────────────────────────────────────────

/**
 * Ship a draft transfer — marks it as in_transit and creates stock movements.
 * Transitions: draft → in_transit.
 *
 * Creates 2 movements per line:
 *   - transfer_out at source location
 *   - transfer_in at destination location
 *
 * Also deducts from source stock_levels.
 */
export async function shipTransfer(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  const parsed = ShipTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.transfer.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const trf = await db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.tenantId, ctx.tenantId), eq(stockTransfers.id, data.transferId)))
      .then((r) => r[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId: data.transferId }));
    }

    // Permission scoped to the SOURCE outlet — operator at outlet C
    // cannot ship outlet A's stock to outlet B by abusing ctx.locationId.
    const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
      locationId: trf.fromLocationId,
    });
    if (!permCheck.ok) return permCheck;

    if (trf.status !== 'draft') {
      return err(
        AppError.businessRule('inventory.transfer.notDraft', { currentStatus: trf.status }),
      );
    }
    if (trf.version !== data.version) {
      return err(AppError.conflict('inventory.transfer.versionMismatch'));
    }

    const lines = await db
      .select()
      .from(stockTransferLines)
      .where(eq(stockTransferLines.transferId, data.transferId))
      .orderBy(stockTransferLines.lineNo);

    if (lines.length === 0) {
      return err(AppError.businessRule('inventory.transfer.noLines'));
    }

    const now = new Date();

    // CLAIM the transfer first via atomic optimistic UPDATE so two
    // concurrent shippers can't both run the deduction loop below.
    const claimed = await db
      .update(stockTransfers)
      .set({
        status: 'in_transit',
        shippedAt: now,
        shippedBy: ctx.userId,
        updatedBy: ctx.userId,
        version: trf.version + 1,
      })
      .where(
        and(
          eq(stockTransfers.id, data.transferId),
          eq(stockTransfers.version, trf.version),
          eq(stockTransfers.status, 'draft'),
        ),
      )
      .returning({ id: stockTransfers.id });
    if (!claimed || claimed.length === 0) {
      return err(AppError.conflict('inventory.transfer.versionMismatch'));
    }

    // Deduct from source stock_levels with a strict atomic guard.
    // Previous code silently clamped to zero — letting you ship more
    // than on-hand and creating phantom stock at the destination.
    // Now the UPDATE only succeeds when `qty_on_hand >= sent`, and on
    // failure we roll the claim back to 'draft' so the transfer can
    // be edited or cancelled cleanly.
    const deducted: Array<{ stockLevelId: string; qtySent: string }> = [];
    let insufficientLine: { productId: string; sent: string } | null = null;

    for (const line of lines) {
      const variantCondition = line.variantId
        ? eq(stockLevels.variantId, line.variantId)
        : eq(stockLevels.variantId, '' as unknown as string);

      const result = await db
        .update(stockLevels)
        .set({
          qtyOnHand: sql`${stockLevels.qtyOnHand} - ${line.qtySent}::numeric`,
          qtyAvailable: sql`${stockLevels.qtyAvailable} - ${line.qtySent}::numeric`,
          updatedBy: ctx.userId,
          lastMovementAt: now,
        })
        .where(
          and(
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, trf.fromLocationId),
            eq(stockLevels.productId, line.productId),
            variantCondition,
            gte(stockLevels.qtyOnHand, line.qtySent),
          ),
        )
        .returning({ id: stockLevels.id });

      if (!result || result.length === 0) {
        insufficientLine = { productId: line.productId, sent: line.qtySent };
        break;
      }
      deducted.push({ stockLevelId: result[0]!.id, qtySent: line.qtySent });
    }

    if (insufficientLine) {
      // Compensate: add back what we already deducted, then roll the
      // status back to 'draft' so the user can adjust quantities.
      for (const d of deducted) {
        await db
          .update(stockLevels)
          .set({
            qtyOnHand: sql`${stockLevels.qtyOnHand} + ${d.qtySent}::numeric`,
            qtyAvailable: sql`${stockLevels.qtyAvailable} + ${d.qtySent}::numeric`,
            updatedBy: ctx.userId,
          })
          .where(eq(stockLevels.id, d.stockLevelId));
      }
      await db
        .update(stockTransfers)
        .set({
          status: 'draft',
          shippedAt: null,
          shippedBy: null,
          updatedBy: ctx.userId,
          version: trf.version,
        })
        .where(eq(stockTransfers.id, data.transferId));
      return err(
        AppError.businessRule('inventory.transfer.insufficientStock', {
          productId: insufficientLine.productId,
          requested: insufficientLine.sent,
        }),
      );
    }

    // Now record movements — same atomic transfer_out + transfer_in pair.
    const outMovements = lines.map((line) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: trf.fromLocationId,
      occurredAt: now,
      stockLocationId: null as unknown as string,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      qtyDelta: `-${line.qtySent}` as unknown as ReturnType<typeof String>,
      uom: line.uom,
      reason: 'transfer_out' as const,
      referenceType: 'stock_transfer' as const,
      referenceId: trf.id,
      unitCost: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    const inMovements = lines.map((line) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: trf.toLocationId,
      occurredAt: now,
      stockLocationId: null as unknown as string,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      qtyDelta: line.qtySent,
      uom: line.uom,
      reason: 'transfer_in' as const,
      referenceType: 'stock_transfer' as const,
      referenceId: trf.id,
      unitCost: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    await db.insert(stockMovements).values([...outMovements, ...inMovements]);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'ship',
      entityType: 'stock_transfer',
      entityId: data.transferId,
      before: { status: 'draft' },
      after: { status: 'in_transit', movementCount: lines.length * 2 },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok(
      buildTransferResult(
        {
          ...trf,
          status: 'in_transit',
          shippedAt: now,
          shippedBy: ctx.userId,
          version: trf.version + 1,
        },
        lines,
      ),
    );
  } catch (e) {
    return err(AppError.internal('inventory.transfer.shipFailed', e));
  }
}

// ─── Receive ─────────────────────────────────────────────────────────────────

/**
 * Receive a transfer that is in_transit.
 * Transitions: in_transit → received.
 *
 * Updates stock_levels at destination location based on qty_received.
 * If qty_received < qty_sent, the difference stays as a waste movement.
 */
export async function receiveTransfer(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  const parsed = ReceiveTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.transfer.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const trf = await db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.tenantId, ctx.tenantId), eq(stockTransfers.id, data.transferId)))
      .then((r) => r[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId: data.transferId }));
    }

    // Permission scoped to DESTINATION outlet: only an operator at the
    // receiving location can mark a transfer received and credit its
    // stock_levels.
    const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
      locationId: trf.toLocationId,
    });
    if (!permCheck.ok) return permCheck;

    if (trf.status !== 'in_transit') {
      return err(
        AppError.businessRule('inventory.transfer.notInTransit', { currentStatus: trf.status }),
      );
    }

    const lines = await db
      .select()
      .from(stockTransferLines)
      .where(eq(stockTransferLines.transferId, data.transferId))
      .orderBy(stockTransferLines.lineNo);

    const now = new Date();

    // CLAIM the transfer first. Two concurrent receivers would otherwise
    // both credit destination stock, doubling on-hand quantity.
    const claimedReceive = await db
      .update(stockTransfers)
      .set({
        status: 'received',
        receivedAt: now,
        receivedBy: ctx.userId,
        updatedBy: ctx.userId,
        version: trf.version + 1,
      })
      .where(and(eq(stockTransfers.id, data.transferId), eq(stockTransfers.status, 'in_transit')))
      .returning({ id: stockTransfers.id });
    if (!claimedReceive || claimedReceive.length === 0) {
      return err(AppError.conflict('inventory.transfer.versionMismatch'));
    }

    // Map line updates by lineId
    const lineUpdateMap = new Map((data.lines ?? []).map((l) => [l.lineId, l.qtyReceived]));

    // Credit destination stock_levels atomically. Using SQL string math
    // keeps the original numeric precision and avoids float drift on
    // large qtys.
    for (const line of lines) {
      const qtyReceived = lineUpdateMap.get(line.id) ?? line.qtySent;

      await db
        .update(stockTransferLines)
        .set({ qtyReceived })
        .where(eq(stockTransferLines.id, line.id));

      const variantCondition = line.variantId
        ? eq(stockLevels.variantId, line.variantId)
        : eq(stockLevels.variantId, '' as unknown as string);

      const incremented = await db
        .update(stockLevels)
        .set({
          qtyOnHand: sql`${stockLevels.qtyOnHand} + ${qtyReceived}::numeric`,
          qtyAvailable: sql`${stockLevels.qtyAvailable} + ${qtyReceived}::numeric`,
          updatedBy: ctx.userId,
          lastMovementAt: now,
        })
        .where(
          and(
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, trf.toLocationId),
            eq(stockLevels.productId, line.productId),
            variantCondition,
          ),
        )
        .returning({ id: stockLevels.id });

      if (!incremented || incremented.length === 0) {
        await db.insert(stockLevels).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          locationId: trf.toLocationId,
          stockLocationId: null,
          productId: line.productId,
          variantId: line.variantId ?? null,
          batchNo: line.batchNo ?? null,
          qtyOnHand: qtyReceived,
          qtyReserved: '0',
          qtyAvailable: qtyReceived,
          uom: line.uom,
          avgUnitCost: null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }
    }

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'receive',
      entityType: 'stock_transfer',
      entityId: data.transferId,
      before: { status: 'in_transit' },
      after: { status: 'received' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    const updatedLines = await db
      .select()
      .from(stockTransferLines)
      .where(eq(stockTransferLines.transferId, data.transferId))
      .orderBy(stockTransferLines.lineNo);

    return ok(
      buildTransferResult(
        {
          ...trf,
          status: 'received',
          receivedAt: now,
          receivedBy: ctx.userId,
          version: trf.version + 1,
        },
        updatedLines,
      ),
    );
  } catch (e) {
    return err(AppError.internal('inventory.transfer.receiveFailed', e));
  }
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

/**
 * Cancel a draft transfer.
 * Transitions: draft → cancelled.
 * Only draft transfers can be cancelled (no movements created yet).
 */
export async function cancelTransfer(
  transferId: string,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const trf = await db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.tenantId, ctx.tenantId), eq(stockTransfers.id, transferId)))
      .then((r) => r[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId }));
    }
    if (trf.status !== 'draft') {
      return err(
        AppError.businessRule('inventory.transfer.notDraft', { currentStatus: trf.status }),
      );
    }

    await db
      .update(stockTransfers)
      .set({
        status: 'cancelled',
        updatedBy: ctx.userId,
        version: trf.version + 1,
      })
      .where(eq(stockTransfers.id, transferId));

    const lines = await db
      .select()
      .from(stockTransferLines)
      .where(eq(stockTransferLines.transferId, transferId))
      .orderBy(stockTransferLines.lineNo);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'cancel',
      entityType: 'stock_transfer',
      entityId: transferId,
      before: { status: trf.status },
      after: { status: 'cancelled' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok(
      buildTransferResult(
        {
          ...trf,
          status: 'cancelled',
          version: trf.version + 1,
        },
        lines,
      ),
    );
  } catch (e) {
    return err(AppError.internal('inventory.transfer.cancelFailed', e));
  }
}
