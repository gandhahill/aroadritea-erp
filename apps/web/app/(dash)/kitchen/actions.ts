/**
 * Kitchen Display System (KDS) server actions — SD §21.7
 *
 * Staff-facing board actions: list queued/making/ready items for a location
 * and advance an item through the kds-service status machine.
 */

'use server';

import { getSession } from '@/lib/auth';
import { authorizedLocationIdsForTenant } from '@/lib/authz';
import { getActiveLocationOptions } from '@/lib/location-options';
import {
  type KdsItemResult,
  type KdsStatus,
  listKdsItems,
  updateKdsStatus,
} from '@erp/services/kitchen';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

export type { KdsStatus };

export interface KitchenLocationOption {
  id: string;
  label: string;
}

export interface KdsBoardItem {
  id: string;
  salesOrderId: string;
  status: KdsStatus;
  pickupNumber: number;
  productSummary: string;
  queuedAt: string;
  makingAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
}

export interface KdsBoard {
  locationId: string;
  queued: KdsBoardItem[];
  making: KdsBoardItem[];
  ready: KdsBoardItem[];
}

async function getSessionUser(): Promise<Record<string, unknown>> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  return session.user as Record<string, unknown>;
}

async function buildCtx(locationId: string): Promise<AuditContext> {
  const user = await getSessionUser();
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId,
    userAgent: 'ERP Web',
    ipAddress: '127.0.0.1',
  };
}

/** Locations the current user may view the kitchen board for. */
export async function fetchKitchenLocations(): Promise<KitchenLocationOption[]> {
  const user = await getSessionUser();
  const userId = String(user.id ?? '');
  const tenantId = String(user.tenantId ?? 'default');

  const scope = await authorizedLocationIdsForTenant(userId, 'kitchen.view', tenantId);
  if (!scope.global && scope.locationIds.length === 0) return [];

  const options = await getActiveLocationOptions({ tenantId, locale: 'id', type: 'store' });
  const allowed = scope.global
    ? options
    : options.filter((option) => scope.locationIds.includes(option.id));

  return allowed.map((option) => ({ id: option.id, label: option.label }));
}

/** Default location: the session's own store if the user has access, else the first available. */
export async function fetchDefaultKitchenLocationId(): Promise<string> {
  const user = await getSessionUser();
  const sessionLocationId = String(user.locationId ?? '');
  const locations = await fetchKitchenLocations();
  if (locations.length === 0) return '';
  if (locations.some((location) => location.id === sessionLocationId)) return sessionLocationId;
  return locations[0]?.id ?? '';
}

function serialize(items: KdsItemResult[]): KdsBoardItem[] {
  return items.map((item) => ({
    id: item.id,
    salesOrderId: item.salesOrderId,
    status: item.status,
    pickupNumber: item.pickupNumber,
    productSummary: item.productSummary,
    queuedAt: item.queuedAt.toISOString(),
    makingAt: item.makingAt?.toISOString() ?? null,
    readyAt: item.readyAt?.toISOString() ?? null,
    servedAt: item.servedAt?.toISOString() ?? null,
  }));
}

export async function fetchKdsBoard(locationId: string): Promise<KdsBoard> {
  const ctx = await buildCtx(locationId);

  const [queued, making, ready] = await Promise.all([
    listKdsItems({ locationId, status: 'queued', limit: 50 }, ctx),
    listKdsItems({ locationId, status: 'making', limit: 50 }, ctx),
    listKdsItems({ locationId, status: 'ready', limit: 50 }, ctx),
  ]);

  return {
    locationId,
    queued: queued.ok ? serialize(queued.value) : [],
    making: making.ok ? serialize(making.value) : [],
    ready: ready.ok ? serialize(ready.value) : [],
  };
}

export type AdvanceKdsStatusResult = { success: true } | { success: false; error: string };

export async function advanceKdsStatusAction(
  kdsItemId: string,
  newStatus: KdsStatus,
  locationId: string,
): Promise<AdvanceKdsStatusResult> {
  const ctx = await buildCtx(locationId);
  const res = await updateKdsStatus({ kdsItemId, newStatus }, ctx);
  if (!res.ok) return { success: false, error: res.error.messageKey };

  revalidatePath('/kitchen');
  return { success: true };
}
