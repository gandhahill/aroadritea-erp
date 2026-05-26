/**
 * Tool: get_stock — T-0172 (Phase 3).
 *
 * Looks up current on-hand stock for a product (and optionally a
 * specific variant) at one outlet. The model uses this to answer
 * "tea_leaf di outlet Malioboro sisa berapa?".
 */

import { and, db, eq } from '@erp/db';
import { productVariants, stockLevels } from '@erp/db/schema/inventory';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { getProductTool } from './get-product';
import { resolveLocationRef } from './resolve-location';

export const GetStockInputSchema = z.object({
  product_code: z.string().min(1).max(64),
  /** Outlet ID or code. Defaults to caller's session location. */
  location: z.string().min(1).max(64).optional(),
  /** Optional variant SKU. */
  variant_code: z.string().min(1).max(64).optional(),
});

export type GetStockInput = z.infer<typeof GetStockInputSchema>;

export interface GetStockOutput {
  found: boolean;
  product_sku?: string;
  variant_sku?: string | null;
  location_id?: string;
  location_code?: string;
  uom?: string;
  qty_on_hand?: string;
  qty_reserved?: string;
  qty_available?: string;
  batches?: Array<{ batch_no: string | null; qty_on_hand: string; expiry: string | null }>;
}

export async function getStockTool(
  input: GetStockInput,
  ctx: AuditContext,
): Promise<GetStockOutput> {
  const location = await resolveLocationRef(input.location, ctx);
  if (!location) return { found: false };

  const productResult = await getProductTool(
    { code: input.product_code.trim(), query: input.product_code.trim() },
    ctx,
  );
  if (!productResult.found || !productResult.product) return { found: false };
  const product = productResult.product;

  let variantId: string | null = null;
  let variantSku: string | null = null;
  if (input.variant_code) {
    const [v] = await db
      .select({ id: productVariants.id, sku: productVariants.sku })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.tenantId, ctx.tenantId),
          eq(productVariants.productId, product.id),
          eq(productVariants.sku, input.variant_code.trim()),
        ),
      )
      .limit(1);
    if (!v) return { found: false };
    variantId = v.id;
    variantSku = v.sku;
  }

  const rows = await db
    .select()
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.tenantId, ctx.tenantId),
        eq(stockLevels.locationId, location.id),
        eq(stockLevels.productId, product.id),
      ),
    );

  const filtered = variantId ? rows.filter((r) => r.variantId === variantId) : rows;
  if (filtered.length === 0) {
    return {
      found: true,
      product_sku: product.sku,
      variant_sku: variantSku,
      location_id: location.id,
      location_code: location.code,
      uom: product.uom,
      qty_on_hand: '0',
      qty_reserved: '0',
      qty_available: '0',
      batches: [],
    };
  }

  let onHand = 0;
  let reserved = 0;
  let available = 0;
  for (const r of filtered) {
    onHand += Number.parseFloat(r.qtyOnHand);
    reserved += Number.parseFloat(r.qtyReserved);
    available += Number.parseFloat(r.qtyAvailable);
  }

  return {
    found: true,
    product_sku: product.sku,
    variant_sku: variantSku,
    location_id: location.id,
    location_code: location.code,
    uom: product.uom,
    qty_on_hand: onHand.toFixed(3),
    qty_reserved: reserved.toFixed(3),
    qty_available: available.toFixed(3),
    batches: filtered.map((r) => ({
      batch_no: r.batchNo,
      qty_on_hand: r.qtyOnHand,
      expiry: r.expiryDate,
    })),
  };
}
