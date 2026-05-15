'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import {
  type PromotionListItem,
  type UpsertPromotionInput,
  listPromotions,
  upsertPromotion,
} from '@erp/services/promotion';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export type PromotionActionResult =
  | { ok: true; item: PromotionListItem }
  | { ok: false; error: string };

function localizedName(value: unknown, locale: string): string {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return String(record[locale] ?? record.id ?? record.en ?? record.zh ?? '').trim();
}

async function getContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function fetchPromotionPageData() {
  const ctx = await getContext();
  if (!ctx) return { promotions: [], locations: [] };

  const [promotionResult, locale, locationRows] = await Promise.all([
    listPromotions(ctx),
    getLocale(),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        type: locations.type,
      })
      .from(locations)
      .where(and(eq(locations.tenantId, ctx.tenantId), eq(locations.status, 'active')))
      .orderBy(locations.code),
  ]);

  return {
    promotions: promotionResult.ok ? promotionResult.value : [],
    locations: locationRows.map((location) => ({
      id: location.id,
      code: location.code,
      type: location.type,
      label: localizedName(location.name, locale) || location.code,
    })),
  };
}

export async function savePromotionAction(
  input: UpsertPromotionInput,
): Promise<PromotionActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: 'account.validationFailed' };

  const result = await upsertPromotion(input, ctx);
  if (!result.ok) {
    return { ok: false, error: result.error.messageKey };
  }

  revalidatePath('/settings/promotions');
  return { ok: true, item: result.value };
}
