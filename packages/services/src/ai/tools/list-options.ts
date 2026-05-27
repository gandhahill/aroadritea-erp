import { and, db, eq, ilike, inArray, or, sql } from '@erp/db';
import { locations } from '@erp/db/schema/auth';
import { products } from '@erp/db/schema/inventory';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { getAuthorizedLocations } from '../../iam';
import { flattenLocalizedName, lookupTokens, normaliseLookup } from './lookup';

const ProductKindSchema = z.enum([
  'finished_good',
  'raw_material',
  'merchandise',
  'consumable',
  'service',
]);

export const ListLocationsInputSchema = z.object({
  query: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const ListProductsInputSchema = z.object({
  query: z.string().min(1).max(120).optional(),
  kind: ProductKindSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type ListLocationsInput = z.infer<typeof ListLocationsInputSchema>;
export type ListProductsInput = z.infer<typeof ListProductsInputSchema>;

export interface LocationOption {
  id: string;
  code: string;
  name: Record<string, unknown>;
  type: string;
  status: string;
}

export interface ProductOption {
  id: string;
  sku: string;
  name: Record<string, unknown>;
  category_id: string;
  kind: string;
  uom: string;
  is_active: boolean;
  default_sell_price: string;
  default_cost_price: string;
}

export interface ListLocationsOutput {
  found: boolean;
  needs_clarification: boolean;
  query?: string;
  total_returned: number;
  locations: LocationOption[];
}

export interface ListProductsOutput {
  found: boolean;
  needs_clarification: boolean;
  query?: string;
  total_returned: number;
  products: ProductOption[];
}

function rankByQuery<T>(
  rows: T[],
  query: string | undefined,
  readText: (row: T) => string,
  readTieBreaker: (row: T) => string,
): T[] {
  if (!query) return rows;
  const normalizedQuery = normaliseLookup(query);
  const tokens = lookupTokens(query);
  const score = (row: T) => {
    const text = normaliseLookup(readText(row));
    let value = 0;
    if (text.includes(normalizedQuery)) value += 50;
    for (const token of tokens) {
      if (text.includes(token)) value += 10;
    }
    return value;
  };
  return [...rows].sort(
    (a, b) => score(b) - score(a) || readTieBreaker(a).localeCompare(readTieBreaker(b)),
  );
}

export async function listLocationsTool(
  input: ListLocationsInput,
  ctx: AuditContext,
): Promise<ListLocationsOutput> {
  const limit = input.limit ?? 20;
  const query = input.query?.trim();
  const tokens = query ? lookupTokens(query) : [];
  const phrasePattern = query ? `%${query}%` : undefined;
  const tokenConditions = tokens.map((token) => {
    const tokenPattern = `%${token}%`;
    return or(
      ilike(locations.code, tokenPattern),
      sql`${locations.name}->>'id' ILIKE ${tokenPattern}`,
      sql`${locations.name}->>'en' ILIKE ${tokenPattern}`,
      sql`${locations.name}->>'zh' ILIKE ${tokenPattern}`,
    );
  });
  const queryCondition =
    query && phrasePattern
      ? or(
          ilike(locations.code, phrasePattern),
          sql`${locations.name}->>'id' ILIKE ${phrasePattern}`,
          sql`${locations.name}->>'en' ILIKE ${phrasePattern}`,
          sql`${locations.name}->>'zh' ILIKE ${phrasePattern}`,
          ...tokenConditions,
        )
      : undefined;

  const scope = await getAuthorizedLocations(ctx.userId, 'ai.assistant.use');
  if (scope.scope === 'location' && scope.locationIds.length === 0) {
    return {
      found: false,
      needs_clarification: false,
      query,
      total_returned: 0,
      locations: [],
    };
  }

  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      status: locations.status,
    })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, ctx.tenantId),
        queryCondition,
        scope.scope === 'global' ? undefined : inArray(locations.id, scope.locationIds),
      ),
    )
    .limit(limit);

  const ranked = rankByQuery(
    rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name as Record<string, unknown>,
      type: row.type,
      status: row.status,
    })),
    query,
    (row) => `${row.code} ${flattenLocalizedName(row.name)} ${row.type}`,
    (row) => row.code,
  );

  return {
    found: ranked.length > 0,
    needs_clarification: ranked.length > 1,
    query,
    total_returned: ranked.length,
    locations: ranked,
  };
}

export async function listProductsTool(
  input: ListProductsInput,
  ctx: AuditContext,
): Promise<ListProductsOutput> {
  const limit = input.limit ?? 20;
  const query = input.query?.trim();
  const tokens = query ? lookupTokens(query) : [];
  const phrasePattern = query ? `%${query}%` : undefined;
  const tokenConditions = tokens.map((token) => {
    const tokenPattern = `%${token}%`;
    return or(
      ilike(products.sku, tokenPattern),
      sql`${products.name}->>'id' ILIKE ${tokenPattern}`,
      sql`${products.name}->>'en' ILIKE ${tokenPattern}`,
      sql`${products.name}->>'zh' ILIKE ${tokenPattern}`,
    );
  });
  const queryCondition =
    query && phrasePattern
      ? or(
          ilike(products.sku, phrasePattern),
          sql`${products.name}->>'id' ILIKE ${phrasePattern}`,
          sql`${products.name}->>'en' ILIKE ${phrasePattern}`,
          sql`${products.name}->>'zh' ILIKE ${phrasePattern}`,
          ...tokenConditions,
        )
      : undefined;

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.tenantId, ctx.tenantId),
        input.kind ? eq(products.kind, input.kind) : undefined,
        queryCondition,
      ),
    )
    .limit(limit);

  const ranked = rankByQuery(
    rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name as Record<string, unknown>,
      category_id: row.categoryId,
      kind: row.kind,
      uom: row.uom,
      is_active: row.isActive,
      default_sell_price: row.defaultSellPrice.toString(),
      default_cost_price: row.defaultCostPrice.toString(),
    })),
    query,
    (row) => `${row.sku} ${flattenLocalizedName(row.name)} ${row.kind} ${row.uom}`,
    (row) => row.sku,
  );

  return {
    found: ranked.length > 0,
    needs_clarification: ranked.length > 1,
    query,
    total_returned: ranked.length,
    products: ranked,
  };
}
