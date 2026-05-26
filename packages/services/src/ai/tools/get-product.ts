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
import {
  containsAllLookupTokens,
  flattenLocalizedName,
  lookupTokens,
  normaliseLookup,
} from './lookup';

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

type ProductRow = typeof products.$inferSelect;

function productSearchText(product: ProductRow): string {
  return normaliseLookup([product.sku, flattenLocalizedName(product.name), product.kind].join(' '));
}

function scoreProductCandidate(
  product: ProductRow,
  query: string,
  tokens: string[],
  code?: string,
): number {
  const normalizedQuery = normaliseLookup(query);
  const normalizedSku = normaliseLookup(product.sku);
  const normalizedName = normaliseLookup(flattenLocalizedName(product.name));
  const searchText = productSearchText(product);
  let score = 0;
  if (code && normalizedSku === normaliseLookup(code)) score += 150;
  if (normalizedSku === normalizedQuery) score += 130;
  if (normalizedName === normalizedQuery) score += 120;
  if (normalizedName.includes(normalizedQuery)) score += 70;
  if (containsAllLookupTokens(searchText, tokens)) score += 45;
  for (const token of tokens) {
    if (normalizedName.includes(token)) score += 12;
    else if (normalizedSku.includes(token)) score += 8;
  }
  if (product.kind === 'finished_good') score += 8;
  if (product.isActive) score += 4;
  return score;
}

function rankProducts(
  rows: ProductRow[],
  query: string,
  tokens: string[],
  code?: string,
): ProductRow[] {
  const byId = new Map<string, ProductRow>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()].sort(
    (a, b) =>
      scoreProductCandidate(b, query, tokens, code) -
        scoreProductCandidate(a, query, tokens, code) || a.sku.localeCompare(b.sku),
  );
}

function chooseProduct(rows: ProductRow[], query: string, tokens: string[], code?: string) {
  const exactCode = rows.find((p) => code && p.sku.toLowerCase() === code.toLowerCase());
  if (exactCode) return exactCode;
  if (rows.length === 1) return rows[0];
  const [top, second] = rows;
  if (!top || !second) return top ?? null;
  const topScore = scoreProductCandidate(top, query, tokens, code);
  const secondScore = scoreProductCandidate(second, query, tokens, code);
  return topScore >= 45 && topScore - secondScore >= 8 ? top : null;
}

export async function getProductTool(
  input: GetProductInput,
  ctx: AuditContext,
): Promise<GetProductOutput> {
  const code = input.code?.trim();
  const query = input.query?.trim() || code || '';
  const pattern = `%${query}%`;
  const tokens = lookupTokens(query);
  const matchCondition = or(
    code ? eq(products.sku, code) : undefined,
    ilike(products.sku, query),
    ilike(products.sku, pattern),
    sql`${products.name}->>'id' ILIKE ${pattern}`,
    sql`${products.name}->>'en' ILIKE ${pattern}`,
    sql`${products.name}->>'zh' ILIKE ${pattern}`,
  );
  if (!matchCondition) return { found: false };

  const selectRows = (condition: ReturnType<typeof or>, rowLimit: number) =>
    db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), condition))
      .limit(rowLimit);

  let rows = await selectRows(matchCondition, 6);
  if (rows.length === 0 && tokens.length > 0) {
    const tokenCondition = and(
      ...tokens.map((token) => {
        const tokenPattern = `%${token}%`;
        return or(
          ilike(products.sku, tokenPattern),
          sql`${products.name}->>'id' ILIKE ${tokenPattern}`,
          sql`${products.name}->>'en' ILIKE ${tokenPattern}`,
          sql`${products.name}->>'zh' ILIKE ${tokenPattern}`,
        );
      }),
    );
    if (tokenCondition) rows = await selectRows(tokenCondition, 12);
  }

  rows = rankProducts(rows, query, tokens, code);
  const product = chooseProduct(rows, query, tokens, code);

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
