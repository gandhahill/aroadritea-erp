'use server';

import { getSession } from '@/lib/auth';
import { db, sql } from '@erp/db';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { deductIngredients } from '@erp/services/pos/create-sale';
import { generateId } from '@erp/shared/id';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { listManualSalesLocations } from '@erp/services/pos';

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

export async function fetchConsumedIngredientsData() {
  const ctx = await getAuditContext();
  if (!ctx) return { locations: [], ingredients: [], error: 'Unauthenticated' };
  
  const locale = await getLocale();
  
  function pickLocalized(value: unknown, locale: string): string {
    const record = value as Record<string, string> | null | undefined;
    if (!record) return '';
    const key = locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : 'id';
    return record[key] ?? record.id ?? record.en ?? record.zh ?? '';
  }

  const [locationRows, ingredientsList] = await Promise.all([
    listManualSalesLocations(ctx),
    db
      .execute<{
        id: string;
        name: string;
        uom: string;
      }>(
        sql`
      SELECT 
        p.id, 
        COALESCE(p.name->>'id', p.name->>'en', 'Ingredient') as name,
        p.uom
      FROM products p
      WHERE p.tenant_id = ${ctx.tenantId} AND p.is_active = true AND p.kind IN ('raw_material', 'consumable')
      ORDER BY p.sku ASC
      `,
      )
      .then((res) => res),
  ]);

  return {
    locations: locationRows.map((row) => ({
      id: row.id,
      code: row.code,
      label: `${row.code} - ${pickLocalized(row.name, locale)}`,
    })),
    ingredients: ingredientsList.map((i) => ({
      id: i.id,
      name: i.name,
      uom: i.uom,
    })),
  };
}

export async function createConsumedIngredientsAction(
  _prev: any,
  formData: FormData,
) {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  let consumedIngredients = [];
  try {
    const rawConsumed = formData.get('consumedIngredientsJson') as string;
    if (rawConsumed) {
      consumedIngredients = JSON.parse(rawConsumed);
    }
  } catch (e) {
    return { error: 'Invalid consumed ingredients data' };
  }

  if (consumedIngredients.length === 0) {
    return { error: 'Silakan tambahkan minimal 1 bahan baku' };
  }
  
  const locationId = (formData.get('locationId') as string) || ctx.locationId;
  const referenceId = generateId(); // Unique ID to track this stock movement

  const deductResult = await deductIngredients(
    ctx.tenantId,
    locationId,
    consumedIngredients,
    referenceId,
    ctx,
  );

  if (!deductResult.ok) {
    return { error: 'Gagal memotong stok: ' + (deductResult.error.message || deductResult.error.code) };
  }

  revalidatePath('/pos/manual-sales');
  revalidatePath('/inventory/stock-adjustments');
  return { ok: true };
}
