/**
 * POS Settings Server Actions.
 * Operational POS configuration is DB/UI-managed, not environment-driven.
 */

'use server';

import { getSession } from '@/lib/auth';
import { accounts, and, asc, db, eq, isNull } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { posSettings } from '@erp/db/schema/pos';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

export interface DeliveryChannelSetting {
  id: string;
  label: string;
  netBps: number;
  commissionBps: number;
  enabled: boolean;
}

const DEFAULT_DELIVERY_CHANNELS: DeliveryChannelSetting[] = [
  { id: 'gofood', label: 'GoFood', netBps: 8000, commissionBps: 2000, enabled: true },
  { id: 'grabfood', label: 'GrabFood', netBps: 8000, commissionBps: 2000, enabled: true },
  { id: 'shopeefood', label: 'ShopeeFood', netBps: 8000, commissionBps: 2000, enabled: true },
];

export interface PosSettingItem {
  id: string | null;
  locationId: string;
  locationName: string;
  pb1TaxCode: string;
  cashAccountCode: string;
  revenueAccountCode: string;
  donationTrustAccountCode: string;
  deliveryChannels: DeliveryChannelSetting[];
  receiptWidthMm: number;
  /** Printer device name as registered in the cashier OS (Print Bridge / kiosk hint). */
  receiptPrinterName: string | null;
  /** Label printer device name. Falls back to receipt printer when null. */
  labelPrinterName: string | null;
  /**
   * When true, Chrome is launched with `--kiosk-printing` and the
   * auto-print pages skip the preview-dialog delay.
   */
  kioskPrintingEnabled: boolean;
}

export interface AccountOption {
  code: string;
  label: string;
  type: string;
  normalBalance: string;
}

type ActionResult = { success: boolean; error?: string };

function getLocationName(name: unknown, fallback: string): string {
  const value = name as { id?: string; en?: string; zh?: string } | null;
  return value?.id ?? value?.en ?? value?.zh ?? fallback;
}

function normalizeChannels(channels: unknown): DeliveryChannelSetting[] {
  const source =
    Array.isArray(channels) && channels.length > 0 ? channels : DEFAULT_DELIVERY_CHANNELS;
  const result = new Map<string, DeliveryChannelSetting>();

  for (const item of source) {
    const record =
      typeof item === 'string'
        ? { id: item, label: item, netBps: 8000, enabled: true }
        : item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
    if (!record) continue;

    const id = String(record.id ?? '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_-]{2,32}$/.test(id)) continue;

    const rawNetBps = Number(record.netBps ?? 8000);
    const rawCommissionBps = Number(record.commissionBps ?? 10000 - rawNetBps);
    const netBps = Number.isFinite(rawNetBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawNetBps)))
      : 8000;
    const commissionBps = Number.isFinite(rawCommissionBps)
      ? Math.min(10000, Math.max(0, Math.trunc(rawCommissionBps)))
      : 10000 - netBps;

    result.set(id, {
      id,
      label: String(record.label ?? id).trim() || id,
      netBps,
      commissionBps,
      enabled: record.enabled !== false,
    });
  }

  return [...result.values()];
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
        type: locations.type,
        status: locations.status,
      })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, ctx.tenantId),
          eq(locations.type, 'store'),
          eq(locations.status, 'active'),
        ),
      )
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
        receiptPrinterName: posSettings.receiptPrinterName,
        labelPrinterName: posSettings.labelPrinterName,
        kioskPrintingEnabled: posSettings.kioskPrintingEnabled,
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
      deliveryChannels: normalizeChannels(setting?.deliveryChannelsJson),
      receiptWidthMm: setting?.receiptWidthMm ?? 80,
      receiptPrinterName: setting?.receiptPrinterName ?? null,
      labelPrinterName: setting?.labelPrinterName ?? null,
      kioskPrintingEnabled: setting?.kioskPrintingEnabled ?? false,
    };
  });
}

export async function fetchAccountOptions(): Promise<AccountOption[]> {
  const ctx = await requireContext();
  if (!ctx) return [];
  const perm = await requirePermission(ctx.userId, 'settings.manage');
  if (!perm.ok) return [];

  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      normalBalance: accounts.normalBalance,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    )
    .orderBy(asc(accounts.code));

  return rows.map((row) => {
    const name = row.name as { id?: string; en?: string; zh?: string } | null;
    return {
      code: row.code,
      label: `${row.code} - ${name?.id ?? name?.en ?? name?.zh ?? row.code}`,
      type: row.type,
      normalBalance: row.normalBalance,
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
    deliveryChannels: DeliveryChannelSetting[];
    receiptWidthMm: number;
    receiptPrinterName?: string | null;
    labelPrinterName?: string | null;
    kioskPrintingEnabled?: boolean;
  },
): Promise<ActionResult> {
  const ctx = await requireContext();
  if (!ctx) return { success: false, error: 'Unauthenticated' };
  const perm = await requirePermission(ctx.userId, 'settings.manage', { locationId });
  if (!perm.ok) return { success: false, error: 'Forbidden' };

  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, ctx.tenantId),
        eq(locations.id, locationId),
        eq(locations.type, 'store'),
      ),
    )
    .limit(1);

  if (!location) return { success: false, error: 'Location not found' };

  const selectedAccountCodes = [
    data.cashAccountCode.trim(),
    data.revenueAccountCode.trim(),
    data.donationTrustAccountCode.trim(),
  ];
  const accountRows = await db
    .select({ code: accounts.code })
    .from(accounts)
    .where(
      and(
        eq(accounts.tenantId, ctx.tenantId),
        eq(accounts.isActive, true),
        eq(accounts.isPostable, true),
        isNull(accounts.deletedAt),
      ),
    );
  const validAccountCodes = new Set(accountRows.map((row) => row.code));
  for (const code of selectedAccountCodes) {
    if (!validAccountCodes.has(code)) {
      return { success: false, error: `Account ${code} is not active or postable` };
    }
  }

  const channels = normalizeChannels(data.deliveryChannels);
  if (channels.length === 0) {
    return { success: false, error: 'At least one delivery channel is required' };
  }
  for (const channel of channels) {
    if (channel.netBps + channel.commissionBps !== 10000) {
      return {
        success: false,
        error: `Net and commission for ${channel.id} must add up to 100%`,
      };
    }
  }

  const receiptWidthMm = Math.trunc(Number(data.receiptWidthMm));
  if (!Number.isFinite(receiptWidthMm) || receiptWidthMm < 40 || receiptWidthMm > 120) {
    return { success: false, error: 'Receipt width must be between 40 and 120 mm' };
  }

  const normalizePrinterName = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
  };

  const values = {
    pb1TaxCode: data.pb1TaxCode.trim() || 'PB1',
    cashAccountCode: data.cashAccountCode.trim() || '1-1300',
    revenueAccountCode: data.revenueAccountCode.trim() || '4-1100',
    donationTrustAccountCode: data.donationTrustAccountCode.trim() || '2-2050',
    deliveryChannelsJson: channels,
    deliveryNetBps: Math.trunc(
      channels.reduce((sum, channel) => sum + channel.netBps, 0) / channels.length,
    ),
    receiptWidthMm,
    receiptPrinterName: normalizePrinterName(data.receiptPrinterName),
    labelPrinterName: normalizePrinterName(data.labelPrinterName),
    kioskPrintingEnabled: Boolean(data.kioskPrintingEnabled),
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
