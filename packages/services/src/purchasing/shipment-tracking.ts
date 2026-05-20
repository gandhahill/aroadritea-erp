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

const BINDERBYTE_ENDPOINT = 'https://api.binderbyte.com/v1/track';
const MONTHLY_REQUEST_LIMIT = 500;

interface BinderByteTrackResponse {
  status?: number;
  message?: string;
  data?: {
    summary?: Record<string, unknown>;
    detail?: Record<string, unknown>;
    history?: Array<Record<string, unknown>>;
  };
}

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

  const apiKey = process.env.BINDERBYTE_API_KEY;
  if (!apiKey) return err(AppError.internal('purchasing.shipmentTracking.apiKeyMissing'));

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
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
      const url = new URL(BINDERBYTE_ENDPOINT);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('courier', data.courierCode);
      url.searchParams.set('awb', data.awb);
      if (data.phoneLast5) url.searchParams.set('number', data.phoneLast5);

      let httpStatus: number | null = null;
      let payload: BinderByteTrackResponse | null = null;
      let errorMessage: string | null = null;

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(10_000),
        });
        httpStatus = response.status;
        payload = (await response.json()) as BinderByteTrackResponse;
        if (!response.ok || payload.status !== 200) {
          errorMessage = payload.message ?? `BinderByte HTTP ${response.status}`;
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      const success = !errorMessage && payload?.status === 200;
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
