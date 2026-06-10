'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { and, db, desc, eq, inArray, isNull } from '@erp/db';
import { outgoingShipments } from '@erp/db/schema/logistics';
import {
  createOutgoingShipment,
  deleteOutgoingShipment,
  trackOutgoingShipment,
  updateOutgoingShipment,
} from '@erp/services/logistics';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

export async function fetchOutgoingShipments() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = session.user as Record<string, unknown>;
  const scope = await authorizedLocationIdsForTenant(
    String(user.id ?? ''),
    'logistics.shipments.view',
    String(user.tenantId ?? 'default'),
  );

  if (!scope.global && scope.locationIds.length === 0) {
    return [];
  }

  const conditions = [
    eq(outgoingShipments.tenantId, String(user.tenantId ?? 'default')),
    isNull(outgoingShipments.deletedAt),
  ];

  if (!scope.global) {
    conditions.push(inArray(outgoingShipments.locationId, scope.locationIds));
    // Creator-scoped visibility (User Req 2026-05-30): staff without a global
    // logistics role see only shipments they created; managers/director (global scope) see all.
    conditions.push(eq(outgoingShipments.createdBy, String(user.id ?? '')));
  }

  const query = db
    .select()
    .from(outgoingShipments)
    .where(and(...conditions))
    .orderBy(desc(outgoingShipments.createdAt));

  return query;
}

export async function fetchOutgoingShipmentById(id: string) {
  const session = await getSession();
  if (!session) return null;

  const user = session.user as Record<string, unknown>;
  const tenantId = String(user.tenantId ?? 'default');

  const [shipment] = await db
    .select()
    .from(outgoingShipments)
    .where(
      and(
        eq(outgoingShipments.tenantId, tenantId),
        eq(outgoingShipments.id, id),
        isNull(outgoingShipments.deletedAt),
      ),
    )
    .limit(1);

  if (!shipment) return null;

  return {
    id: shipment.id,
    number: shipment.number,
    subject: shipment.subject,
    notes: shipment.notes,
    recipientName: shipment.recipientName,
    recipientAddress: shipment.recipientAddress,
    recipientPhone: shipment.recipientPhone,
    status: shipment.status,
    courierCode: shipment.shippingCourierCode,
    awb: shipment.shippingAwb,
    phoneLast5: shipment.shippingPhoneLast5,
    trackingStatus: shipment.shippingTrackingStatus,
    trackingSummary: shipment.shippingTrackingSummary as Record<string, unknown> | null,
    trackingHistory: (shipment.shippingTrackingHistory ?? []) as Record<string, unknown>[],
    trackingSyncedAt: shipment.shippingTrackingSyncedAt?.toISOString() ?? null,
    trackingError: shipment.shippingTrackingError,
    locationId: shipment.locationId,
    createdAt: shipment.createdAt?.toISOString() ?? null,
  };
}

export type OutgoingShipmentDetail = NonNullable<
  Awaited<ReturnType<typeof fetchOutgoingShipmentById>>
>;

export async function syncTrackingAction(shipmentId: string, courierCode: string, awb: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await trackOutgoingShipment(
    {
      shipmentId,
      courierCode,
      awb,
    },
    ctx,
  );

  if (res.ok) {
    revalidatePath('/logistics/outgoing-shipments');
    revalidatePath(`/logistics/outgoing-shipments/${shipmentId}`);
    return { success: true, status: res.value.status };
  } else {
    throw new Error(res.error.message);
  }
}

export async function createOutgoingShipmentAction(input: any) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await createOutgoingShipment(input, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/logistics/outgoing-shipments');
  return { success: true, id: res.value };
}

export async function updateOutgoingShipmentAction(shipmentId: string, input: any) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await updateOutgoingShipment({ ...input, shipmentId }, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/logistics/outgoing-shipments');
  revalidatePath(`/logistics/outgoing-shipments/${shipmentId}`);
  return { success: true, id: res.value };
}

export async function deleteOutgoingShipmentAction(shipmentId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = session.user as Record<string, unknown>;
  const ctx: AuditContext = {
    userId: String(user.id),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };

  const res = await deleteOutgoingShipment(shipmentId, ctx);
  if (!res.ok) throw new Error(res.error.message);

  revalidatePath('/logistics/outgoing-shipments');
  return { success: true, id: res.value };
}
