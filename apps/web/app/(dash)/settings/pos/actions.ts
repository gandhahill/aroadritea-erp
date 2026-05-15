/**
 * POS Settings Server Actions.
 * Operational POS configuration is DB/UI-managed, not environment-driven.
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { posSettings } from '@erp/db/schema/pos';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

const DEFAULT_DELIVERY_CHANNELS = ['gofood', 'grabfood', 'shopeefood'];

export interface PosSettingItem {
  id: string | null;
  locationId: string;
  locationName: string;
  pb1TaxCode: string;
  cashAccountCode: string;
  revenueAccountCode: string;
  donationTrustAccountCode: string;
  deliveryChannels: string[];
  deliveryNetBps: number;
  receiptWidthMm: number;
}

type ActionResult = { success: boolean; error?: string };

function getLocationName(name: unknown, fallback: string): string {
  const value = name as { id?: string; en?: string; zh?: string } | null;
  return value?.id ?? value?.en ?? value?.zh ?? fallback;
}

function normalizeChannels(channels: string[]): string[] {
  return Array.from(
    new Set(
      channels
        .map((channel) => channel.trim().toLowerCase())
        .filter((channel) => /^[a-z0-9_-]{2,32}$/.test(channel)),
    ),
  );
}

async function requireContext() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    tenantId: (user.tenantId as string) ?? 'default',
    userId: (user.id as string) ?? '',
  };
}

export async function fetchPosSettings(): Promise<PosSettingItem[]> {
  const ctx = await requireContext();
  if (!ctx) return [];
  const perm = await requirePermission(ctx.userId, 'settings.manage');
  if (!perm.ok) return [];

  const [locRows, settingRows] = await Promise.all([
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(eq(locations.tenantId, ctx.tenantId))
      .orderBy(locations.code),
    db
      .select({
        id: posSettings.id,
        locationId: posSettings.locationId,
        pb1TaxCode: posSettings.pb1TaxCode,
        cashAccountCode: posSettings.cashAccountCode,
        revenueAccountCode: posSettings.revenueAccountCode,
        donationTrustAccountCode: posSettings.donationTrustAccountCode,
        deliveryChannelsJson: posSettings.deliveryChannelsJson,
        deliveryNetBps: posSettings.deliveryNetBps,
        receiptWidthMm: posSettings.receiptWidthMm,
      })
      .from(posSettings)
      .where(eq(posSettings.tenantId, ctx.tenantId)),
  ]);

  const settingsByLocation = new Map(settingRows.map((row) => [row.locationId, row]));

  return locRows.map((loc) => {
    const setting = settingsByLocation.get(loc.id);
    return {
      id: setting?.id ?? null,
      locationId: loc.id,
      locationName: getLocationName(loc.name, loc.code),
      pb1TaxCode: setting?.pb1TaxCode ?? 'PB1',
      cashAccountCode: setting?.cashAccountCode ?? '1-1300',
      revenueAccountCode: setting?.revenueAccountCode ?? '4-1100',
      donationTrustAccountCode: setting?.donationTrustAccountCode ?? '2-2050',
      deliveryChannels: setting?.deliveryChannelsJson ?? DEFAULT_DELIVERY_CHANNELS,
      deliveryNetBps: setting?.deliveryNetBps ?? 8000,
      receiptWidthMm: setting?.receiptWidthMm ?? 80,
    };
  });
}

export async function updatePosSetting(
  locationId: string,
  data: {
    pb1TaxCode: string;
    cashAccountCode: string;
    revenueAccountCode: string;
    donationTrustAccountCode: string;
    deliveryChannels: string[];
    deliveryNetBps: number;
    receiptWidthMm: number;
  },
): Promise<ActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'settings.manage', { locationId });
  if (!perm.ok) return { success: false, error: 'Forbidden' };

  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.id, locationId)))
    .limit(1);

  if (!location) return { success: false, error: 'Location not found' };

  const channels = normalizeChannels(data.deliveryChannels);
  if (channels.length === 0) {
    return { success: false, error: 'At least one delivery channel is required' };
  }

  const deliveryNetBps = Math.trunc(Number(data.deliveryNetBps));
  if (!Number.isFinite(deliveryNetBps) || deliveryNetBps <= 0 || deliveryNetBps > 10000) {
    return { success: false, error: 'Delivery net bps must be between 1 and 10000' };
  }

  const receiptWidthMm = Math.trunc(Number(data.receiptWidthMm));
  if (!Number.isFinite(receiptWidthMm) || receiptWidthMm < 40 || receiptWidthMm > 120) {
    return { success: false, error: 'Receipt width must be between 40 and 120 mm' };
  }

  const values = {
    pb1TaxCode: data.pb1TaxCode.trim() || 'PB1',
    cashAccountCode: data.cashAccountCode.trim() || '1-1300',
    revenueAccountCode: data.revenueAccountCode.trim() || '4-1100',
    donationTrustAccountCode: data.donationTrustAccountCode.trim() || '2-2050',
    deliveryChannelsJson: channels,
    deliveryNetBps,
    receiptWidthMm,
    updatedAt: new Date(),
    updatedBy: ctx.userId || null,
  };

  try {
    const [existing] = await db
      .select({ id: posSettings.id })
      .from(posSettings)
      .where(and(eq(posSettings.tenantId, ctx.tenantId), eq(posSettings.locationId, locationId)))
      .limit(1);

    if (existing) {
      await db
        .update(posSettings)
        .set(values)
        .where(and(eq(posSettings.id, existing.id), eq(posSettings.tenantId, ctx.tenantId)));
    } else {
      await db.insert(posSettings).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        locationId,
        ...values,
        createdBy: ctx.userId || null,
      });
    }

    revalidatePath('/settings/pos');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
