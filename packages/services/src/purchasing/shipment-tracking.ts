import { db } from '@erp/db';
import { purchaseOrders, shipmentTrackingRequests } from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, count, eq, gte } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { type TrackShipmentInput, TrackShipmentInputSchema } from './schemas';

import { type BinderByteResult, fetchBinderByteTracking } from '../shared/binderbyte';

const MONTHLY_REQUEST_LIMIT = 500;

export interface ShipmentTrackingResult {
  poId: string;
  courierCode: string;
  awb: string;
  status: string | null;
  syncedAt: string;
  summary: Record<string, unknown> | null;
  history: Array<Record<string, unknown>>;
}

export async function trackPurchaseOrderShipment(
  input: TrackShipmentInput,
  ctx: AuditContext,
): Promise<Result<ShipmentTrackingResult>> {
  const parsed = TrackShipmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.shipmentTracking.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, data.poId)))
    .limit(1);
  if (!po) return err(AppError.notFound('purchasing.shipmentTracking.poNotFound'));

  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: po.locationId,
  });
  if (!permCheck.ok) return permCheck;


  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const monthStart = new Date(`${year}-${month}-01T00:00:00+07:00`);
  const [requestCount] = await db
    .select({ c: count() })
    .from(shipmentTrackingRequests)
    .where(
      and(
        eq(shipmentTrackingRequests.tenantId, ctx.tenantId),
        gte(shipmentTrackingRequests.requestedAt, monthStart),
      ),
    );
  if (Number(requestCount?.c ?? 0) >= MONTHLY_REQUEST_LIMIT) {
    return err(
      AppError.businessRule('purchasing.shipmentTracking.monthlyQuotaReached', {
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

      await db.insert(shipmentTrackingRequests).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        purchaseOrderId: po.id,
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

      await db
        .update(purchaseOrders)
        .set({
          shippingCourierCode: data.courierCode,
          shippingAwb: data.awb,
          shippingPhoneLast5: data.phoneLast5 || null,
          shippingTrackingStatus:
            typeof summary?.status === 'string' ? summary.status : success ? 'TRACKED' : 'ERROR',
          shippingTrackingSummary: summary,
          shippingTrackingHistory: history,
          shippingTrackingSyncedAt: syncedAt,
          shippingTrackingError: errorMessage,
          updatedAt: syncedAt,
          updatedBy: ctx.userId,
          version: po.version + 1,
        })
        .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, po.id)));

      await auditRecord({
        action: 'update',
        entityType: 'purchase_order',
        entityId: po.id,
        before: {
          courierCode: po.shippingCourierCode,
          awb: po.shippingAwb,
          trackingStatus: po.shippingTrackingStatus,
        },
        after: {
          courierCode: data.courierCode,
          awb: data.awb,
          trackingStatus:
            typeof summary?.status === 'string' ? summary.status : success ? 'TRACKED' : 'ERROR',
          success,
        },
        ctx,
      });

      if (!success) {
        throw AppError.external('purchasing.shipmentTracking.providerFailed', {
          message: errorMessage,
          httpStatus,
        });
      }

      return {
        poId: po.id,
        courierCode: data.courierCode,
        awb: data.awb,
        status: typeof summary?.status === 'string' ? summary.status : null,
        syncedAt: syncedAt.toISOString(),
        summary,
        history,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('purchasing.shipmentTracking.failed', e);
    },
  );
}
