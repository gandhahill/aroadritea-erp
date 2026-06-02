import { db } from '@erp/db';
import { outgoingShipmentLines, outgoingShipmentTrackingRequests, outgoingShipments } from '@erp/db/schema/logistics';
import { stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, count, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { fetchBinderByteTracking } from '../shared/binderbyte';

export const CreateOutgoingShipmentSchema = z.object({
  number: z.string().min(1),
  locationId: z.string().min(1),
  subject: z.string().min(1),
  notes: z.string().optional(),
  recipientName: z.string().min(1),
  recipientAddress: z.string().min(1),
  recipientPhone: z.string().optional(),
  shippingCourierCode: z.string().optional(),
  shippingAwb: z.string().optional(),
  shippingPhoneLast5: z.string().optional(),
  lines: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      qty: z.number().positive(),
      uom: z.string().min(1),
      notes: z.string().optional(),
    })
  ).default([]),
});
export type CreateOutgoingShipmentInput = z.infer<typeof CreateOutgoingShipmentSchema>;

export const UpdateOutgoingShipmentSchema = z.object({
  shipmentId: z.string().min(1),
  number: z.string().min(1),
  locationId: z.string().min(1),
  subject: z.string().min(1),
  notes: z.string().optional(),
  recipientName: z.string().min(1),
  recipientAddress: z.string().min(1),
  recipientPhone: z.string().optional(),
  shippingCourierCode: z.string().optional(),
  shippingAwb: z.string().optional(),
  shippingPhoneLast5: z.string().optional(),
});
export type UpdateOutgoingShipmentInput = z.infer<typeof UpdateOutgoingShipmentSchema>;

export async function createOutgoingShipment(
  input: CreateOutgoingShipmentInput,
  ctx: AuditContext,
): Promise<Result<string>> {
  const parsed = CreateOutgoingShipmentSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('logistics.outgoingShipment.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'logistics.shipments.create', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const id = generateId();

      await db.transaction(async (tx) => {
        await tx.insert(outgoingShipments).values({
          id,
          tenantId: ctx.tenantId,
          locationId: data.locationId,
          number: data.number,
          subject: data.subject,
          notes: data.notes || null,
          recipientName: data.recipientName,
          recipientAddress: data.recipientAddress,
          recipientPhone: data.recipientPhone || null,
          shippingCourierCode: data.shippingCourierCode || null,
          shippingAwb: data.shippingAwb || null,
          shippingPhoneLast5: data.shippingPhoneLast5 || null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });

        if (data.lines.length > 0) {
          for (const [index, line] of data.lines.entries()) {
            const lineId = generateId();
            await tx.insert(outgoingShipmentLines).values({
              id: lineId,
              tenantId: ctx.tenantId,
              shipmentId: id,
              lineNo: index + 1,
              productId: line.productId,
              variantId: line.variantId || null,
              qty: line.qty.toString(),
              uom: line.uom,
              notes: line.notes || null,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            });

            const variantFilter = line.variantId ? eq(stockLevels.variantId, line.variantId) : sql`variant_id IS NULL`;

            const [currentLevel] = await tx.select({
              id: stockLevels.id,
              qtyOnHand: stockLevels.qtyOnHand,
              stockLocationId: stockLevels.stockLocationId,
            }).from(stockLevels)
              .where(
                and(
                  eq(stockLevels.tenantId, ctx.tenantId),
                  eq(stockLevels.locationId, data.locationId),
                  eq(stockLevels.productId, line.productId),
                  variantFilter
                )
              ).limit(1);

            if (!currentLevel) {
              throw AppError.businessRule('logistics.outgoingShipment.insufficientStock', {
                productId: line.productId,
              });
            }

            if (Number(currentLevel.qtyOnHand) < line.qty) {
              throw AppError.businessRule('logistics.outgoingShipment.insufficientStock', {
                productId: line.productId,
                available: currentLevel.qtyOnHand,
                requested: line.qty,
              });
            }

            await tx.update(stockLevels).set({
              qtyOnHand: sql`${stockLevels.qtyOnHand} - ${line.qty.toString()}::numeric`,
              qtyAvailable: sql`${stockLevels.qtyAvailable} - ${line.qty.toString()}::numeric`,
              updatedBy: ctx.userId,
              lastMovementAt: new Date(),
            }).where(eq(stockLevels.id, currentLevel.id));

            await tx.insert(stockMovements).values({
              id: generateId(),
              tenantId: ctx.tenantId,
              locationId: data.locationId,
              occurredAt: new Date(),
              stockLocationId: currentLevel.stockLocationId,
              productId: line.productId,
              variantId: line.variantId || null,
              batchNo: null,
              qtyDelta: (-line.qty).toString(),
              uom: line.uom,
              reason: 'outgoing_shipment',
              referenceType: 'outgoing_shipment',
              referenceId: id,
              unitCost: null,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            });
          }
        }
      });

      await auditRecord({
        action: 'create',
        entityType: 'outgoing_shipment',
        entityId: id,
        before: null,
        after: data,
        ctx,
      });

      return id;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('logistics.outgoingShipment.createFailed', e);
    },
  );
}

export async function updateOutgoingShipment(
  input: UpdateOutgoingShipmentInput,
  ctx: AuditContext,
): Promise<Result<string>> {
  const parsed = UpdateOutgoingShipmentSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('logistics.outgoingShipment.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const [shipment] = await db
    .select()
    .from(outgoingShipments)
    .where(
      and(
        eq(outgoingShipments.tenantId, ctx.tenantId),
        eq(outgoingShipments.id, data.shipmentId),
        isNull(outgoingShipments.deletedAt),
      ),
    )
    .limit(1);
  if (!shipment) return err(AppError.notFound('logistics.outgoingShipment.notFound'));

  const currentPerm = await requirePermission(ctx.userId, 'logistics.shipments.create', {
    locationId: shipment.locationId,
  });
  if (!currentPerm.ok) return currentPerm;

  if (data.locationId !== shipment.locationId) {
    const nextPerm = await requirePermission(ctx.userId, 'logistics.shipments.create', {
      locationId: data.locationId,
    });
    if (!nextPerm.ok) return nextPerm;

    const [lineCount] = await db
      .select({ c: count() })
      .from(outgoingShipmentLines)
      .where(
        and(
          eq(outgoingShipmentLines.tenantId, ctx.tenantId),
          eq(outgoingShipmentLines.shipmentId, shipment.id),
          isNull(outgoingShipmentLines.deletedAt),
        ),
      );
    if (Number(lineCount?.c ?? 0) > 0) {
      return err(
        AppError.businessRule('logistics.outgoingShipment.locationChangeWithLines', {
          shipmentId: shipment.id,
        }),
      );
    }
  }

  return tryCatch(
    async () => {
      const now = new Date();
      const [updated] = await db
        .update(outgoingShipments)
        .set({
          locationId: data.locationId,
          number: data.number,
          subject: data.subject,
          notes: data.notes || null,
          recipientName: data.recipientName,
          recipientAddress: data.recipientAddress,
          recipientPhone: data.recipientPhone || null,
          shippingCourierCode: data.shippingCourierCode || null,
          shippingAwb: data.shippingAwb || null,
          shippingPhoneLast5: data.shippingPhoneLast5 || null,
          updatedAt: now,
          updatedBy: ctx.userId,
          version: shipment.version + 1,
        })
        .where(
          and(
            eq(outgoingShipments.tenantId, ctx.tenantId),
            eq(outgoingShipments.id, shipment.id),
            isNull(outgoingShipments.deletedAt),
          ),
        )
        .returning({ id: outgoingShipments.id });

      if (!updated) throw AppError.conflict('logistics.outgoingShipment.updateConflict');

      await auditRecord({
        action: 'update',
        entityType: 'outgoing_shipment',
        entityId: shipment.id,
        before: {
          number: shipment.number,
          locationId: shipment.locationId,
          subject: shipment.subject,
          recipientName: shipment.recipientName,
          shippingCourierCode: shipment.shippingCourierCode,
          shippingAwb: shipment.shippingAwb,
        },
        after: {
          number: data.number,
          locationId: data.locationId,
          subject: data.subject,
          recipientName: data.recipientName,
          shippingCourierCode: data.shippingCourierCode || null,
          shippingAwb: data.shippingAwb || null,
        },
        ctx,
      });

      return shipment.id;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('logistics.outgoingShipment.updateFailed', e);
    },
  );
}

export async function deleteOutgoingShipment(
  shipmentId: string,
  ctx: AuditContext,
): Promise<Result<string>> {
  const [shipment] = await db
    .select()
    .from(outgoingShipments)
    .where(
      and(
        eq(outgoingShipments.tenantId, ctx.tenantId),
        eq(outgoingShipments.id, shipmentId),
        isNull(outgoingShipments.deletedAt),
      ),
    )
    .limit(1);
  if (!shipment) return err(AppError.notFound('logistics.outgoingShipment.notFound'));
  if (shipment.status === 'delivered') {
    return err(AppError.businessRule('logistics.outgoingShipment.deleteDeliveredBlocked'));
  }

  const permCheck = await requirePermission(ctx.userId, 'logistics.shipments.create', {
    locationId: shipment.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const now = new Date();
      await db.transaction(async (tx) => {
        const movements = await tx
          .select({
            id: stockMovements.id,
            locationId: stockMovements.locationId,
            stockLocationId: stockMovements.stockLocationId,
            productId: stockMovements.productId,
            variantId: stockMovements.variantId,
            batchNo: stockMovements.batchNo,
            qtyDelta: stockMovements.qtyDelta,
            uom: stockMovements.uom,
          })
          .from(stockMovements)
          .where(
            and(
              eq(stockMovements.tenantId, ctx.tenantId),
              eq(stockMovements.referenceType, 'outgoing_shipment'),
              eq(stockMovements.referenceId, shipment.id),
              eq(stockMovements.reason, 'outgoing_shipment'),
              isNull(stockMovements.deletedAt),
            ),
          );

        for (const movement of movements) {
          const qtyToRestore = Math.abs(Number.parseFloat(String(movement.qtyDelta))).toString();
          const stockWhere = [
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, movement.locationId),
            eq(stockLevels.productId, movement.productId),
            movement.variantId
              ? eq(stockLevels.variantId, movement.variantId)
              : isNull(stockLevels.variantId),
            movement.stockLocationId
              ? eq(stockLevels.stockLocationId, movement.stockLocationId)
              : isNull(stockLevels.stockLocationId),
            movement.batchNo ? eq(stockLevels.batchNo, movement.batchNo) : isNull(stockLevels.batchNo),
          ];

          await tx
            .update(stockLevels)
            .set({
              qtyOnHand: sql`${stockLevels.qtyOnHand} + ${qtyToRestore}::numeric`,
              qtyAvailable: sql`${stockLevels.qtyAvailable} + ${qtyToRestore}::numeric`,
              updatedAt: now,
              updatedBy: ctx.userId,
              lastMovementAt: now,
            })
            .where(and(...stockWhere));

          await tx.insert(stockMovements).values({
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: movement.locationId,
            occurredAt: now,
            stockLocationId: movement.stockLocationId,
            productId: movement.productId,
            variantId: movement.variantId,
            batchNo: movement.batchNo,
            qtyDelta: qtyToRestore,
            uom: movement.uom,
            reason: 'outgoing_shipment_rollback',
            referenceType: 'outgoing_shipment',
            referenceId: shipment.id,
            unitCost: null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
        }

        if (movements.length > 0) {
          await tx
            .update(stockMovements)
            .set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId })
            .where(
              and(
                eq(stockMovements.tenantId, ctx.tenantId),
                inArray(stockMovements.id, movements.map((movement) => movement.id)),
              ),
            );
        }

        await tx
          .update(outgoingShipmentLines)
          .set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId })
          .where(
            and(
              eq(outgoingShipmentLines.tenantId, ctx.tenantId),
              eq(outgoingShipmentLines.shipmentId, shipment.id),
              isNull(outgoingShipmentLines.deletedAt),
            ),
          );

        await tx
          .update(outgoingShipments)
          .set({
            status: 'cancelled',
            deletedAt: now,
            updatedAt: now,
            updatedBy: ctx.userId,
            version: shipment.version + 1,
          })
          .where(
            and(
              eq(outgoingShipments.tenantId, ctx.tenantId),
              eq(outgoingShipments.id, shipment.id),
              isNull(outgoingShipments.deletedAt),
            ),
          );
      });

      await auditRecord({
        action: 'delete',
        entityType: 'outgoing_shipment',
        entityId: shipment.id,
        before: {
          status: shipment.status,
          number: shipment.number,
          locationId: shipment.locationId,
        },
        after: { status: 'cancelled', deletedAt: now.toISOString() },
        ctx,
      });

      return shipment.id;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('logistics.outgoingShipment.deleteFailed', e);
    },
  );
}

export const TrackOutgoingShipmentSchema = z.object({
  shipmentId: z.string().min(1),
  courierCode: z.string().min(1),
  awb: z.string().min(1),
  phoneLast5: z.string().optional(),
});
export type TrackOutgoingShipmentInput = z.infer<typeof TrackOutgoingShipmentSchema>;

export async function trackOutgoingShipment(
  input: TrackOutgoingShipmentInput,
  ctx: AuditContext,
): Promise<Result<{ status: string | null; history: any[] }>> {
  const parsed = TrackOutgoingShipmentSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('logistics.outgoingShipmentTracking.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const [shipment] = await db
    .select()
    .from(outgoingShipments)
    .where(and(eq(outgoingShipments.tenantId, ctx.tenantId), eq(outgoingShipments.id, data.shipmentId)))
    .limit(1);
  if (!shipment) return err(AppError.notFound('logistics.outgoingShipment.notFound'));

  const permCheck = await requirePermission(ctx.userId, 'logistics.shipments.view', {
    locationId: shipment.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const MONTHLY_REQUEST_LIMIT = 500;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  // We should ideally count tracking requests globally across purchasing & logistics.
  // But for now, we'll just check logistics' usage table.
  const [requestCount] = await db
    .select({ c: count() })
    .from(outgoingShipmentTrackingRequests)
    .where(
      and(
        eq(outgoingShipmentTrackingRequests.tenantId, ctx.tenantId),
        gte(outgoingShipmentTrackingRequests.requestedAt, monthStart),
      ),
    );
  if (Number(requestCount?.c ?? 0) >= MONTHLY_REQUEST_LIMIT) {
    return err(
      AppError.businessRule('logistics.outgoingShipmentTracking.monthlyQuotaReached', {
        monthlyLimit: MONTHLY_REQUEST_LIMIT,
      }),
    );
  }

  return tryCatch(
    async () => {
      const { success, httpStatus, errorMessage, payload } = await fetchBinderByteTracking(
        data.courierCode,
        data.awb,
        data.phoneLast5,
      );

      const summary = payload?.data?.summary ?? null;
      const history = payload?.data?.history ?? [];
      const syncedAt = new Date();

      await db.insert(outgoingShipmentTrackingRequests).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        shipmentId: shipment.id,
        courierCode: data.courierCode,
        awb: data.awb,
        phoneLast5: data.phoneLast5 || null,
        requestedAt: syncedAt,
        success,
        httpStatus,
        responseJson: payload,
        errorMessage,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      const trackingStatus =
        typeof summary?.status === 'string' ? summary.status : success ? 'TRACKED' : 'ERROR';

      await db
        .update(outgoingShipments)
        .set({
          shippingCourierCode: data.courierCode,
          shippingAwb: data.awb,
          shippingPhoneLast5: data.phoneLast5 || null,
          shippingTrackingStatus: trackingStatus,
          shippingTrackingSummary: summary,
          shippingTrackingHistory: history,
          shippingTrackingSyncedAt: syncedAt,
          shippingTrackingError: errorMessage,
          updatedAt: syncedAt,
          updatedBy: ctx.userId,
          version: shipment.version + 1,
        })
        .where(and(eq(outgoingShipments.tenantId, ctx.tenantId), eq(outgoingShipments.id, shipment.id)));

      await auditRecord({
        action: 'update',
        entityType: 'outgoing_shipment',
        entityId: shipment.id,
        before: {
          courierCode: shipment.shippingCourierCode,
          awb: shipment.shippingAwb,
          trackingStatus: shipment.shippingTrackingStatus,
        },
        after: {
          courierCode: data.courierCode,
          awb: data.awb,
          trackingStatus,
          success,
        },
        ctx,
      });

      if (!success) {
        throw AppError.external('logistics.outgoingShipmentTracking.providerFailed', {
          message: errorMessage,
          httpStatus,
        });
      }

      return {
        status: typeof summary?.status === 'string' ? summary.status : null,
        history,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('logistics.outgoingShipmentTracking.failed', e);
    },
  );
}
