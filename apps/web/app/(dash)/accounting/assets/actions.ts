'use server';

import { getSession } from '@/lib/auth';
import { type LocationOption, getActiveLocationOptions } from '@/lib/location-options';
import {
  type FixedAssetCategoryItem,
  type FixedAssetListItem,
  createFixedAsset,
  listFixedAssetCategories,
  listFixedAssets,
  runFixedAssetDepreciation,
} from '@erp/services/accounting';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface AssetActionState {
  ok?: boolean;
  error?: string;
  assetId?: string;
  runId?: string;
  journalEntryId?: string;
  totalAmount?: string;
}

export interface AssetPageData {
  assets: FixedAssetListItem[];
  total: number;
  categories: FixedAssetCategoryItem[];
  locations: LocationOption[];
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : undefined;
}

function money(formData: FormData, key: string) {
  const digits = text(formData, key).replace(/[^\d]/g, '');
  return digits.length > 0 ? digits : '0';
}

function intValue(formData: FormData, key: string, fallback: number) {
  const parsed = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function fetchAssetPageData(input?: {
  locationId?: string;
  status?: 'active' | 'fully_depreciated' | 'disposed';
}): Promise<AssetPageData> {
  const ctx = await getAuditContext();
  if (!ctx) return { assets: [], total: 0, categories: [], locations: [] };
  const locale = (await getLocale().catch(() => 'id')) as 'id' | 'en' | 'zh';
  const [assetResult, categoryResult, locations] = await Promise.all([
    listFixedAssets({ locationId: input?.locationId, status: input?.status }, ctx),
    listFixedAssetCategories(ctx),
    getActiveLocationOptions({ tenantId: ctx.tenantId, locale }),
  ]);

  if (!assetResult.ok) throw assetResult.error;
  if (!categoryResult.ok) throw categoryResult.error;
  return {
    assets: assetResult.value.items,
    total: assetResult.value.total,
    categories: categoryResult.value,
    locations,
  };
}

export async function createAssetAction(
  _prev: AssetActionState | null,
  formData: FormData,
): Promise<AssetActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const result = await createFixedAsset(
    {
      locationId: text(formData, 'locationId'),
      categoryId: text(formData, 'categoryId'),
      code: text(formData, 'code'),
      name: text(formData, 'name'),
      acquisitionDate: text(formData, 'acquisitionDate'),
      inServiceDate: text(formData, 'inServiceDate'),
      acquisitionCost: money(formData, 'acquisitionCost'),
      salvageValue: money(formData, 'salvageValue'),
      usefulLifeMonths: intValue(formData, 'usefulLifeMonths', 48),
      depreciationMethod:
        (text(formData, 'depreciationMethod') as
          | 'straight_line'
          | 'declining_balance'
          | 'double_declining_balance'
          | 'sum_of_years_digits'
          | 'units_of_production') || 'straight_line',
      depreciationRateBps: optionalText(formData, 'depreciationRateBps')
        ? intValue(formData, 'depreciationRateBps', 2500)
        : undefined,
      productionCapacity: optionalText(formData, 'productionCapacity'),
      notes: optionalText(formData, 'notes'),
    },
    ctx,
  );
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/accounting/assets');
  return { ok: true, assetId: result.value.id };
}

export async function runDepreciationAction(
  _prev: AssetActionState | null,
  formData: FormData,
): Promise<AssetActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const result = await runFixedAssetDepreciation(
    {
      locationId: text(formData, 'locationId'),
      postingDate: text(formData, 'postingDate'),
      notes: optionalText(formData, 'notes'),
    },
    ctx,
  );
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/accounting/assets');
  revalidatePath('/accounting/journals');
  return {
    ok: true,
    runId: result.value.runId,
    journalEntryId: result.value.journalEntryId,
    totalAmount: result.value.totalAmount,
  };
}
