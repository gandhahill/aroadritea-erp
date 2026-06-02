import { db } from '@erp/db';
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
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { generateTransferNumber } from '../shared/number-generator';
import {
  CreateTransferInputSchema,
  ReceiveTransferInputSchema,
  ShipTransferInputSchema,
} from './schemas';

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
  expiryDate: string | null;
  qtySent: string;
  qtyReceived: string | null;
  uom: string;
}

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
    expiryDate: string | null;
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
    lines: lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      qtySent: line.qtySent,
      qtyReceived: line.qtyReceived ?? null,
      uom: line.uom,
    })),
  };
}

function stockLevelIdentityWhere(input: {
  tenantId: string;
  locationId: string;
  productId: string;
  variantId: string | null | undefined;
  batchNo: string | null | undefined;
  expiryDate: string | null | undefined;
}) {
  return and(
    eq(stockLevels.tenantId, input.tenantId),
    eq(stockLevels.locationId, input.locationId),
    eq(stockLevels.productId, input.productId),
    input.variantId ? eq(stockLevels.variantId, input.variantId) : isNull(stockLevels.variantId),
    input.batchNo ? eq(stockLevels.batchNo, input.batchNo) : isNull(stockLevels.batchNo),
    input.expiryDate ? eq(stockLevels.expiryDate, input.expiryDate) : isNull(stockLevels.expiryDate),
  );
}

function qtyToScaledBigInt(qty: string): bigint {
  return BigInt(Math.round(Number.parseFloat(qty) * 1000));
}

export async function createTransferDraft(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  const parsed = CreateTransferInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.transfer.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
    locationId: data.fromLocationId,
  });
  if (!permCheck.ok) return permCheck;

  if (data.fromLocationId === data.toLocationId) {
    return err(AppError.businessRule('inventory.transfer.sameLocation'));
  }

  const productIds = [...new Set(data.lines.map((line) => line.productId))];
  const foundProducts = await db
    .select({
      id: products.id,
      isActive: products.isActive,
      trackBatch: products.trackBatch,
      trackExpiry: products.trackExpiry,
    })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));
  const productMap = new Map(foundProducts.map((product) => [product.id, product]));

  for (const line of data.lines) {
    const product = productMap.get(line.productId);
    if (!product) {
      return err(
        AppError.notFound('inventory.transfer.productNotFound', { productId: line.productId }),
      );
    }
    if (!product.isActive) {
      return err(
        AppError.businessRule('inventory.transfer.productInactive', { productId: line.productId }),
      );
    }
    if (product.trackBatch && !line.batchNo) {
      return err(
        AppError.validation('inventory.transfer.missingBatchNo', {
          productId: line.productId,
        }),
      );
    }
    if (product.trackExpiry && !line.expiryDate) {
      return err(
        AppError.validation('inventory.transfer.missingExpiryDate', {
          productId: line.productId,
        }),
      );
    }
  }

  const trfId = generateId();
  const trfNumber = await generateTransferNumber(ctx.tenantId, data.transferDate);

  try {
    const result = await db.transaction(async (tx) => {
      await tx.insert(stockTransfers).values({
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
        expiryDate: line.expiryDate ?? null,
        qtySent: line.qty,
        qtyReceived: null,
        uom: line.uom,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      }));

      await tx.insert(stockTransferLines).values(lineValues);

      await auditRecord({
        action: 'create',
        entityType: 'stock_transfer',
        entityId: trfId,
        before: null,
        after: { number: trfNumber, lineCount: lineValues.length },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
        tx,
      });

      return buildTransferResult(
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
      );
    });

    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('inventory.transfer.createFailed', e));
  }
}

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
      .then((rows) => rows[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId: data.transferId }));
    }

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

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const claimedShip = await tx
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
            eq(stockTransfers.tenantId, ctx.tenantId),
            eq(stockTransfers.id, data.transferId),
            eq(stockTransfers.version, trf.version),
            eq(stockTransfers.status, 'draft'),
          ),
        )
        .returning({ id: stockTransfers.id });

      if (claimedShip.length === 0) {
        throw AppError.conflict('inventory.transfer.versionMismatch');
      }

      const movementValues: Array<typeof stockMovements.$inferInsert> = [];
      for (const line of lines) {
        const updatedStock = await tx
          .update(stockLevels)
          .set({
            qtyOnHand: sql`${stockLevels.qtyOnHand} - ${line.qtySent}::numeric`,
            qtyAvailable: sql`${stockLevels.qtyAvailable} - ${line.qtySent}::numeric`,
            updatedBy: ctx.userId,
            lastMovementAt: now,
          })
          .where(
            and(
              stockLevelIdentityWhere({
                tenantId: ctx.tenantId,
                locationId: trf.fromLocationId,
                productId: line.productId,
                variantId: line.variantId,
                batchNo: line.batchNo,
                expiryDate: line.expiryDate,
              }),
              sql`${stockLevels.qtyOnHand} >= ${line.qtySent}::numeric`,
              sql`${stockLevels.qtyAvailable} >= ${line.qtySent}::numeric`,
            ),
          )
          .returning({ id: stockLevels.id });

        if (updatedStock.length === 0) {
          throw AppError.businessRule('inventory.transfer.insufficientStock', {
            productId: line.productId,
            variantId: line.variantId,
            batchNo: line.batchNo,
            required: line.qtySent,
          });
        }

        movementValues.push(
          {
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: trf.fromLocationId,
            occurredAt: now,
            stockLocationId: null,
            productId: line.productId,
            variantId: line.variantId ?? null,
            batchNo: line.batchNo ?? null,
            expiryDate: line.expiryDate ?? null,
            qtyDelta: `-${line.qtySent}`,
            uom: line.uom,
            reason: 'transfer_out',
            referenceType: 'stock_transfer',
            referenceId: trf.id,
            unitCost: null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
          {
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: trf.toLocationId,
            occurredAt: now,
            stockLocationId: null,
            productId: line.productId,
            variantId: line.variantId ?? null,
            batchNo: line.batchNo ?? null,
            expiryDate: line.expiryDate ?? null,
            qtyDelta: line.qtySent,
            uom: line.uom,
            reason: 'transfer_in',
            referenceType: 'stock_transfer',
            referenceId: trf.id,
            unitCost: null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          },
        );
      }

      await tx.insert(stockMovements).values(movementValues);
      await auditRecord({
        action: 'ship',
        entityType: 'stock_transfer',
        entityId: data.transferId,
        before: { status: 'draft' },
        after: { status: 'in_transit', movementCount: movementValues.length },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
        tx,
      });

      return buildTransferResult(
        {
          ...trf,
          status: 'in_transit',
          shippedAt: now,
          shippedBy: ctx.userId,
          version: trf.version + 1,
        },
        lines,
      );
    });

    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    if (
      e &&
      typeof e === 'object' &&
      ('code' in e || 'message' in e) &&
      ((e as { code?: string }).code === '23514' ||
        String((e as { message?: string }).message ?? '').includes('stock_levels_qty_check'))
    ) {
      return err(AppError.businessRule('inventory.transfer.insufficientStock'));
    }
    return err(AppError.internal('inventory.transfer.shipFailed', e));
  }
}

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
      .then((rows) => rows[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId: data.transferId }));
    }

    const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
      locationId: trf.toLocationId,
    });
    if (!permCheck.ok) return permCheck;

    if (trf.status !== 'in_transit') {
      return err(
        AppError.businessRule('inventory.transfer.notInTransit', { currentStatus: trf.status }),
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
    const lineById = new Map(lines.map((line) => [line.id, line]));
    const lineUpdateMap = new Map((data.lines ?? []).map((line) => [line.lineId, line.qtyReceived]));

    for (const [lineId, qtyReceived] of lineUpdateMap.entries()) {
      const line = lineById.get(lineId);
      if (!line) {
        return err(AppError.validation('inventory.transfer.lineNotFound', { lineId }));
      }
      if (Number.parseFloat(qtyReceived) > Number.parseFloat(line.qtySent) + 0.001) {
        return err(
          AppError.businessRule('inventory.transfer.receivedExceedsSent', {
            lineId,
            qtySent: line.qtySent,
            qtyReceived,
          }),
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const claimedReceive = await tx
        .update(stockTransfers)
        .set({
          status: 'received',
          receivedAt: now,
          receivedBy: ctx.userId,
          updatedBy: ctx.userId,
          version: trf.version + 1,
        })
        .where(
          and(
            eq(stockTransfers.tenantId, ctx.tenantId),
            eq(stockTransfers.id, data.transferId),
            eq(stockTransfers.status, 'in_transit'),
            eq(stockTransfers.version, trf.version),
          ),
        )
        .returning({ id: stockTransfers.id });
      if (claimedReceive.length === 0) {
        throw AppError.conflict('inventory.transfer.versionMismatch');
      }

      for (const line of lines) {
        const qtyReceived = lineUpdateMap.get(line.id) ?? line.qtySent;
        const qtyReceivedScaled = qtyToScaledBigInt(qtyReceived);

        await tx
          .update(stockTransferLines)
          .set({ qtyReceived, updatedBy: ctx.userId })
          .where(and(eq(stockTransferLines.id, line.id), eq(stockTransferLines.transferId, trf.id)));

        const sourceStock = await tx
          .select({ avgUnitCost: stockLevels.avgUnitCost })
          .from(stockLevels)
          .where(
            stockLevelIdentityWhere({
              tenantId: ctx.tenantId,
              locationId: trf.fromLocationId,
              productId: line.productId,
              variantId: line.variantId,
              batchNo: line.batchNo,
              expiryDate: line.expiryDate,
            }),
          )
          .limit(1)
          .then((rows: Array<{ avgUnitCost: bigint | null }>) => rows[0]);

        const sourceAvgCost = sourceStock?.avgUnitCost ?? 0n;
        const existingDest = await tx
          .select({
            id: stockLevels.id,
            qtyOnHand: stockLevels.qtyOnHand,
            avgUnitCost: stockLevels.avgUnitCost,
          })
          .from(stockLevels)
          .where(
            stockLevelIdentityWhere({
              tenantId: ctx.tenantId,
              locationId: trf.toLocationId,
              productId: line.productId,
              variantId: line.variantId,
              batchNo: line.batchNo,
              expiryDate: line.expiryDate,
            }),
          )
          .limit(1)
          .then(
            (rows: Array<{ id: string; qtyOnHand: string; avgUnitCost: bigint | null }>) =>
              rows[0],
          );

        if (existingDest) {
          const oldQty = Number.parseFloat(existingDest.qtyOnHand || '0');
          const recQty = Number.parseFloat(qtyReceived);
          const newQty = oldQty + recQty;
          const oldAvgCost = existingDest.avgUnitCost ?? 0n;
          const newAvgCost =
            newQty > 0.001
              ? (BigInt(Math.round(oldQty * 1000)) * oldAvgCost +
                  qtyReceivedScaled * sourceAvgCost) /
                BigInt(Math.round(newQty * 1000))
              : sourceAvgCost;

          await tx
            .update(stockLevels)
            .set({
              qtyOnHand: sql`${stockLevels.qtyOnHand} + ${qtyReceived}::numeric`,
              qtyAvailable: sql`${stockLevels.qtyAvailable} + ${qtyReceived}::numeric`,
              avgUnitCost: newAvgCost,
              updatedBy: ctx.userId,
              lastMovementAt: now,
            })
            .where(eq(stockLevels.id, existingDest.id));
        } else {
          await tx.insert(stockLevels).values({
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: trf.toLocationId,
            stockLocationId: null,
            productId: line.productId,
            variantId: line.variantId ?? null,
            batchNo: line.batchNo ?? null,
            expiryDate: line.expiryDate ?? null,
            qtyOnHand: qtyReceived,
            qtyReserved: '0',
            qtyAvailable: qtyReceived,
            uom: line.uom,
            avgUnitCost: sourceAvgCost,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
            lastMovementAt: now,
          });
        }
      }

      await auditRecord({
        action: 'receive',
        entityType: 'stock_transfer',
        entityId: data.transferId,
        before: { status: 'in_transit' },
        after: { status: 'received' },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
        tx,
      });

      const updatedLines = await tx
        .select()
        .from(stockTransferLines)
        .where(eq(stockTransferLines.transferId, data.transferId))
        .orderBy(stockTransferLines.lineNo);

      return buildTransferResult(
        {
          ...trf,
          status: 'received',
          receivedAt: now,
          receivedBy: ctx.userId,
          version: trf.version + 1,
        },
        updatedLines,
      );
    });

    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('inventory.transfer.receiveFailed', e));
  }
}

export async function cancelTransfer(
  transferId: string,
  ctx: AuditContext,
): Promise<Result<TransferResult>> {
  try {
    const trf = await db
      .select()
      .from(stockTransfers)
      .where(and(eq(stockTransfers.tenantId, ctx.tenantId), eq(stockTransfers.id, transferId)))
      .then((rows) => rows[0]);

    if (!trf) {
      return err(AppError.notFound('inventory.transfer.notFound', { transferId }));
    }

    const permCheck = await requirePermission(ctx.userId, 'inventory.transfer', {
      locationId: trf.fromLocationId,
    });
    if (!permCheck.ok) return permCheck;

    if (trf.status !== 'draft') {
      return err(
        AppError.businessRule('inventory.transfer.notDraft', { currentStatus: trf.status }),
      );
    }

    const result = await db.transaction(async (tx) => {
      const cancelled = await tx
        .update(stockTransfers)
        .set({
          status: 'cancelled',
          updatedBy: ctx.userId,
          version: trf.version + 1,
        })
        .where(
          and(
            eq(stockTransfers.tenantId, ctx.tenantId),
            eq(stockTransfers.id, transferId),
            eq(stockTransfers.status, 'draft'),
            eq(stockTransfers.version, trf.version),
          ),
        )
        .returning({ id: stockTransfers.id });

      if (cancelled.length === 0) {
        throw AppError.conflict('inventory.transfer.versionMismatch');
      }

      const lines = await tx
        .select()
        .from(stockTransferLines)
        .where(eq(stockTransferLines.transferId, transferId))
        .orderBy(stockTransferLines.lineNo);

      await auditRecord({
        action: 'cancel',
        entityType: 'stock_transfer',
        entityId: transferId,
        before: { status: trf.status },
        after: { status: 'cancelled' },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
        tx,
      });

      return buildTransferResult(
        {
          ...trf,
          status: 'cancelled',
          version: trf.version + 1,
        },
        lines,
      );
    });

    return ok(result);
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('inventory.transfer.cancelFailed', e));
  }
}
