/**
 * Tool: get_product — T-0172 (Phase 3).
 *
 * Looks up a product by SKU, returning its variants and prices so the
 * assistant can answer "berapa harga T01 Large dingin?".
 */

import { and, db, eq, ilike, or, sql } from '@erp/db';
import { productVariants, products } from '@erp/db/schema/inventory';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';

export const GetProductInputSchema = z
  .object({
    code: z.string().min(1).max(64).optional(),
    query: z.string().min(1).max(120).optional(),
  })
  .refine((v) => Boolean(v.code || v.query), {
    message: 'code or query is required',
  });

export type GetProductInput = z.infer<typeof GetProductInputSchema>;

export interface GetProductOutput {
  found: boolean;
  needs_clarification?: boolean;
  candidates?: Array<{
    id: string;
    sku: string;
    name: Record<string, unknown>;
    kind: string;
    default_sell_price: string;
  }>;
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
  const code = input.code?.trim();
  const query = input.query?.trim() || code || '';
  const pattern = `%${query}%`;
  const matchCondition = or(
    code ? eq(products.sku, code) : undefined,
    ilike(products.sku, query),
    ilike(products.sku, pattern),
    sql`${products.name}->>'id' ILIKE ${pattern}`,
    sql`${products.name}->>'en' ILIKE ${pattern}`,
    sql`${products.name}->>'zh' ILIKE ${pattern}`,
  );
  if (!matchCondition) return { found: false };

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), matchCondition))
    .limit(6);

  const product =
    rows.find((p) => code && p.sku.toLowerCase() === code.toLowerCase()) ??
    (rows.length === 1 ? rows[0] : null);

  if (!product) {
    return {
      found: rows.length > 0,
      needs_clarification: rows.length > 1,
      candidates: rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name as Record<string, unknown>,
        kind: p.kind,
        default_sell_price: p.defaultSellPrice.toString(),
      })),
    };
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(eq(productVariants.tenantId, ctx.tenantId), eq(productVariants.productId, product.id)),
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
