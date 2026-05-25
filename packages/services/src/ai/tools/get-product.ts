/**
 * Tool: get_product — T-0172 (Phase 3).
 *
 * Looks up a product by SKU, returning its variants and prices so the
 * assistant can answer "berapa harga T01 Large dingin?".
 */

import { and, db, eq } from '@erp/db';
import { productVariants, products } from '@erp/db/schema/inventory';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const GetProductInputSchema = z.object({
  code: z.string().min(1).max(64),
});

export type GetProductInput = z.infer<typeof GetProductInputSchema>;

export interface GetProductOutput {
  found: boolean;
  product?: {
    id: string;
    sku: string;
    name: Record<string, unknown>;
    category_id: string;
    kind: string;
    uom: string;
    is_active: boolean;
    default_sell_price: string;
    default_cost_price: string;
    variants: Array<{
      id: string;
      sku: string;
      name: Record<string, unknown>;
      sell_price: string;
      cost_price: string;
      attributes: Record<string, string>;
      is_active: boolean;
    }>;
  };
}

export async function getProductTool(
  input: GetProductInput,
  ctx: AuditContext,
): Promise<GetProductOutput> {
  const code = input.code.trim();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.sku, code)))
    .limit(1);

  if (!product) return { found: false };

  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.tenantId, ctx.tenantId),
        eq(productVariants.productId, product.id),
      ),
    );

  return {
    found: true,
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name as Record<string, unknown>,
      category_id: product.categoryId,
      kind: product.kind,
      uom: product.uom,
      is_active: product.isActive,
      default_sell_price: product.defaultSellPrice.toString(),
      default_cost_price: product.defaultCostPrice.toString(),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name as Record<string, unknown>,
        sell_price: v.sellPrice.toString(),
        cost_price: v.costPrice.toString(),
        attributes: (v.attributes ?? {}) as Record<string, string>,
        is_active: v.isActive,
      })),
    },
  };
}
