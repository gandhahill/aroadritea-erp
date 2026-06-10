import { db } from '@erp/db';
import { uomConversions } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import { and, eq, isNull, or } from 'drizzle-orm';

/**
 * Convert quantity from one UOM to another.
 *
 * It will look for conversions defined specifically for the product,
 * or fallback to global conversions (where productId is null).
 */
export async function convertQty(
  tenantId: string,
  qty: number,
  fromUom: string,
  toUom: string,
  productId?: string,
): Promise<Result<number>> {
  if (fromUom === toUom) return ok(qty);

  // Fetch all conversions for this tenant that match the UOMs
  // and are either global or specific to this product.
  const conditions = [
    eq(uomConversions.tenantId, tenantId),
    or(
      and(eq(uomConversions.fromUom, fromUom), eq(uomConversions.toUom, toUom)),
      and(eq(uomConversions.fromUom, toUom), eq(uomConversions.toUom, fromUom)),
    ),
  ];

  if (productId) {
    conditions.push(or(isNull(uomConversions.productId), eq(uomConversions.productId, productId)));
  } else {
    conditions.push(isNull(uomConversions.productId));
  }

  const conversions = await db
    .select()
    .from(uomConversions)
    .where(and(...conditions));

  if (conversions.length === 0) {
    return err(
      AppError.businessRule('inventory.errors.no_uom_conversion', {
        from: fromUom,
        to: toUom,
      }),
    );
  }

  // Prefer product-specific conversion over global
  let bestMatch = conversions.find((c) => c.productId === productId);
  if (!bestMatch) {
    bestMatch = conversions.find((c) => c.productId === null);
  }

  if (!bestMatch) {
    return err(
      AppError.businessRule('inventory.errors.no_uom_conversion', {
        from: fromUom,
        to: toUom,
      }),
    );
  }

  const multiplyBy = Number.parseFloat(bestMatch.multiplyBy);

  // Direct conversion
  if (bestMatch.fromUom === fromUom && bestMatch.toUom === toUom) {
    return ok(qty * multiplyBy);
  }

  // Inverse conversion
  if (bestMatch.fromUom === toUom && bestMatch.toUom === fromUom) {
    return ok(qty / multiplyBy);
  }

  return err(AppError.internal('inventory.errors.uom_resolution_failed'));
}
