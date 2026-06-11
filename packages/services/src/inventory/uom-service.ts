import { db } from '@erp/db';
import { uomConversions } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import { and, eq, isNull, or } from 'drizzle-orm';

/**
 * Units are free-text on stock_levels.uom, bom_lines.uom, and document lines,
 * sourced from different places (stock from GRN/adjustment, recipe from
 * products.uom). Compare case- and whitespace-insensitively so visually
 * identical units ("ml" vs "ML" vs " ml ") are treated as the same.
 */
export function normalizeUom(uom: string): string {
  return uom.trim().toLowerCase();
}

/**
 * Convert quantity from one UOM to another.
 *
 * It will look for conversions defined specifically for the product,
 * or fallback to global conversions (where productId is null).
 */
export async function convertQty(
  tenantId: string,
  qty: number,
  fromUomRaw: string,
  toUomRaw: string,
  productId?: string,
): Promise<Result<number>> {
  // Rows written via the management UI are stored normalized; normalize the
  // lookup too so "Pack" still matches a "pack" conversion.
  const fromUom = normalizeUom(fromUomRaw);
  const toUom = normalizeUom(toUomRaw);
  if (fromUom === toUom) return ok(qty);

  // Fetch all conversions for this tenant that match the UOMs
  // and are either global or specific to this product.
  const conditions = [
    eq(uomConversions.tenantId, tenantId),
    isNull(uomConversions.deletedAt),
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

export interface ProductUomQty {
  /** Quantity expressed in the product master uom (numeric string, 3 dp when converted). */
  qty: string;
  /** Always the product master uom, verbatim from products.uom. */
  uom: string;
  /** convertedQty / inputQty — 1 when no conversion was needed. */
  factor: number;
}

/**
 * Express a document-line quantity in the product master uom before it is
 * written to stock_levels / stock_movements.
 *
 * products.uom is the canonical stock unit (SD §9.3): every stock_levels row
 * must be stored in it, otherwise downstream consumers that compare units
 * (e.g. POS ingredient deduction) hard-fail with uom_mismatch — the 2026-06-11
 * MLI production incident. When the input unit differs, the qty is converted
 * via the uom_conversions table; without a registered conversion the write is
 * rejected so a stock row in a foreign unit can never be created.
 */
export async function toProductUom(
  tenantId: string,
  product: { id: string; uom: string },
  qty: string | number,
  inputUom: string,
  convert: typeof convertQty = convertQty,
): Promise<Result<ProductUomQty>> {
  const qtyNum = typeof qty === 'number' ? qty : Number.parseFloat(qty);
  if (!Number.isFinite(qtyNum)) {
    return err(AppError.validation('inventory.errors.invalid_qty', { productId: product.id, qty }));
  }

  if (normalizeUom(inputUom) === normalizeUom(product.uom)) {
    return ok({ qty: String(qty), uom: product.uom, factor: 1 });
  }

  const converted = await convert(tenantId, qtyNum, inputUom, product.uom, product.id);
  if (!converted.ok) {
    return err(
      AppError.businessRule('inventory.errors.stock_uom_mismatch', {
        productId: product.id,
        inputUom,
        productUom: product.uom,
      }),
    );
  }

  // qtyNum may be 0 (e.g. zero-qty adjustment line) — derive the factor from a
  // unit conversion so unit-cost rescaling still works.
  let factor = 1;
  if (qtyNum !== 0) {
    factor = converted.value / qtyNum;
  } else {
    const unit = await convert(tenantId, 1, inputUom, product.uom, product.id);
    if (unit.ok) factor = unit.value;
  }

  return ok({ qty: converted.value.toFixed(3), uom: product.uom, factor });
}

/**
 * Rescale a per-unit cost (rupiah bigint) after a qty was converted to the
 * product uom: cost per input unit ÷ factor = cost per product unit
 * (e.g. Rp25.000/pack with 1 pack = 25 pcs → Rp1.000/pcs).
 */
export function scaleUnitCostToProductUom(unitCost: bigint, factor: number): bigint {
  if (factor === 1 || factor === 0) return unitCost;
  return BigInt(Math.round(Number(unitCost) / factor));
}
