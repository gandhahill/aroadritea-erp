'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { db, desc, eq, inArray, and } from '@erp/db';
import { outgoingShipments } from '@erp/db/schema/logistics';
import { createOutgoingShipment, trackOutgoingShipment } from '@erp/services/logistics';
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

  const conditions = [eq(outgoingShipments.tenantId, String(user.tenantId ?? 'default'))];
  
  if (!scope.global) {
    conditions.push(inArray(outgoingShipments.locationId, scope.locationIds));
  }

  const query = db
    .select()
    .from(outgoingShipments)
    .where(and(...conditions))
    .orderBy(desc(outgoingShipments.createdAt));

  return query;
}

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

  const res = await trackOutgoingShipment({
    shipmentId,
    courierCode,
    awb,
  }, ctx);

  if (res.ok) {
    revalidatePath('/logistics/outgoing-shipments');
    return { success: true, status: res.value.status };
  } else {
    throw new Error(res.error.message);
  }
}
