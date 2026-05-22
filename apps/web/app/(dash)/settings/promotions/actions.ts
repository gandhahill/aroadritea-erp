'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq } from '@erp/db';
import { accounts } from '@erp/db/schema/accounting';
import { locations } from '@erp/db/schema/auth';
import { productVariants, products } from '@erp/db/schema/inventory';
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
  if (!ctx)
    return { promotions: [], locations: [], products: [], variants: [], expenseAccounts: [] };

  const [promotionResult, locale, locationRows, productRows, variantRows, expenseAccountRows] =
    await Promise.all([
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
        .where(
          and(
            eq(locations.tenantId, ctx.tenantId),
            eq(locations.status, 'active'),
            eq(locations.type, 'store'),
          ),
        )
        .orderBy(locations.code),
      db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          isActive: products.isActive,
        })
        .from(products)
        .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
        .orderBy(products.sku),
      db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          sku: productVariants.sku,
          isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(and(eq(productVariants.tenantId, ctx.tenantId), eq(productVariants.isActive, true)))
        .orderBy(productVariants.sku),
      db
        .select({
          id: accounts.id,
          code: accounts.code,
          name: accounts.name,
          type: accounts.type,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, ctx.tenantId),
            eq(accounts.isActive, true),
            eq(accounts.isPostable, true),
            eq(accounts.type, 'expense'),
          ),
        )
        .orderBy(accounts.code),
    ]);

  return {
    promotions: promotionResult.ok ? promotionResult.value : [],
    locations: locationRows.map((location) => ({
      id: location.id,
      code: location.code,
      type: location.type,
      label: localizedName(location.name, locale) || location.code,
    })),
    products: productRows.map((p) => ({
      id: p.id,
      sku: p.sku,
      label: `${p.sku} — ${localizedName(p.name, locale) || p.sku}`,
    })),
    variants: variantRows.map((v) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      label: `${v.sku} — ${localizedName(v.name, locale) || v.sku}`,
    })),
    expenseAccounts: expenseAccountRows.map((a) => ({
      id: a.id,
      code: a.code,
      label: `${a.code} — ${localizedName(a.name, locale) || a.code}`,
    })),
  };
}

export async function savePromotionAction(
  input: UpsertPromotionInput,
): Promise<PromotionActionResult> {
  const ctx = await getContext();
  if (!ctx) return { ok: false, error: 'account.validationFailed' };

  if (input.locationScope.length > 0) {
    const storeRows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, ctx.tenantId),
          eq(locations.status, 'active'),
          eq(locations.type, 'store'),
        ),
      );
    const storeIds = new Set(storeRows.map((row) => row.id));
    if (input.locationScope.some((locationId) => !storeIds.has(locationId))) {
      return { ok: false, error: 'promotion.outletOnly' };
    }
  }

  const result = await upsertPromotion(input, ctx);
  if (!result.ok) {
    return { ok: false, error: result.error.messageKey };
  }

  revalidatePath('/settings/promotions');
  return { ok: true, item: result.value };
}
