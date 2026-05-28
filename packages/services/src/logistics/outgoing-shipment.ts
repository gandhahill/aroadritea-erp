import { db } from '@erp/db';
import { outgoingShipmentTrackingRequests, outgoingShipments } from '@erp/db/schema/logistics';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, count, eq, gte } from 'drizzle-orm';
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
});
export type CreateOutgoingShipmentInput = z.infer<typeof CreateOutgoingShipmentSchema>;

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
      await db.insert(outgoingShipments).values({
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
      return AppError.internal('logistics.outgoingShipment.createFailed', e);
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
