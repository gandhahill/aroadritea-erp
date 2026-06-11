import { and, db, eq } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { getLocale, getTranslations } from 'next-intl/server';

interface DeductErrorLike {
  message?: string;
  messageKey?: string;
  code?: string;
  details?: unknown;
}

function pickLocalizedName(value: unknown, locale: string): string {
  const record = value as Record<string, string> | null | undefined;
  if (!record) return '';
  const key = locale === 'zh' ? 'zh' : locale === 'en' ? 'en' : 'id';
  return record[key] ?? record.id ?? record.en ?? record.zh ?? '';
}

async function ingredientName(tenantId: string | undefined, ingredientId: string) {
  const locale = await getLocale();
  const row = await db
    .select({ name: products.name, sku: products.sku })
    .from(products)
    .where(
      tenantId
        ? and(eq(products.tenantId, tenantId), eq(products.id, ingredientId))
        : eq(products.id, ingredientId),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!row) return ingredientId;
  return pickLocalizedName(row.name, locale) || row.sku;
}

/**
 * Translate an ingredient-deduction AppError into a cashier-readable message.
 *
 * deductIngredients only exposes a messageKey plus structured details
 * (ingredientId, units, quantities); showing the raw key — as happened in the
 * 2026-06-11 `pos.createSale.ingredientUomMismatch` incident at MLI — leaves
 * the cashier unable to tell which of the entered lines is the problem.
 * Unknown errors fall back to the previous message/code behaviour.
 */
export async function describeDeductError(
  error: DeductErrorLike,
  tenantId?: string,
): Promise<string> {
  const t = await getTranslations('pos.manualSales');
  const key = error.messageKey ?? error.message ?? '';
  const details = (error.details ?? {}) as Record<string, unknown>;
  const ingredientId = typeof details.ingredientId === 'string' ? details.ingredientId : null;

  if (key === 'pos.createSale.ingredientUomMismatch' && ingredientId) {
    return t('errorIngredientUomMismatch', {
      name: await ingredientName(tenantId, ingredientId),
      recipeUom: String(details.recipeUom ?? ''),
      stockUom: String(details.stockUom ?? ''),
    });
  }

  if (key === 'pos.createSale.insufficientStock' && ingredientId) {
    return t('errorIngredientInsufficient', {
      name: await ingredientName(tenantId, ingredientId),
      requiredQty: String(details.requiredQty ?? ''),
      qtyAvailable: String(details.qtyAvailable ?? '0'),
      uom: String(details.uom ?? ''),
    });
  }

  if (key === 'pos.createSale.ingredientStockMissing' && ingredientId) {
    return t('errorIngredientStockMissing', {
      name: await ingredientName(tenantId, ingredientId),
    });
  }

  return error.message || error.code || String(error);
}
