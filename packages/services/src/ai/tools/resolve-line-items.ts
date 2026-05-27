/**
 * Line-item resolver for OCR'd receipts.
 *
 * Takes the raw line items extracted from a struk photo (name + qty +
 * amount as printed) and resolves each one to a real product/variant in
 * the DB so the manual-sales draft can deduct ingredient stock via BOM
 * when the cashier clicks "Setujui & Posting".
 *
 * Why this lives here and not as a generic "find_product" tool:
 *   - Legacy POS prints product + modifiers inside brackets, e.g.
 *     `Osmanthus Oolong Milk Tea[700ml, Less, sugar, Standard, ice]`.
 *     Splitting that into "core name" + bracket tokens lets us search
 *     by product name first, then pick the right variant by size /
 *     temperature attributes.
 *   - We need typo tolerance — the print can be smudged or the OCR can
 *     misread a letter. The token-score approach in `listProductsTool`
 *     already handles partial overlap, so we reuse it and filter by a
 *     minimum confidence so wildly-wrong matches are flagged as
 *     `unresolved` instead of silently consuming the wrong BOM.
 */

import { and, db, eq, ilike, inArray, or, sql } from '@erp/db';
import { productVariants, products } from '@erp/db/schema/inventory';
import type { AuditContext } from '@erp/shared/types';
import {
  containsAllLookupTokens,
  flattenLocalizedName,
  lookupTokens,
  normaliseLookup,
} from './lookup';
import type { ExtractedLineItem } from './ocr-receipt';

/** Sale-line shape consumed by createManualSalesClosing. */
export interface ResolvedLineItem {
  resolved: true;
  productId: string;
  variantId?: string;
  /** Original printed line (kept for audit + ConfirmActionCard display). */
  name: string;
  qty: number;
  /** Per-unit price as integer string. */
  price: string;
  /** Line total as integer string (amount from the struk). */
  total: string;
  /** Match metadata surfaced to the cashier so they can spot bad matches. */
  matchedProductSku: string;
  matchedProductName: string;
  matchedVariantName?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface UnresolvedLineItem {
  resolved: false;
  /** Printed line — preserved so the card shows what couldn't be matched. */
  name: string;
  qty: number;
  total: string;
  reason: 'no_product_match' | 'low_confidence';
  /** Best-guess candidate names so the cashier can rename it manually. */
  candidates?: Array<{ sku: string; name: string }>;
}

export type ResolvedOrUnresolved = ResolvedLineItem | UnresolvedLineItem;

const HIGH_CONFIDENCE_SCORE = 80;
const MEDIUM_CONFIDENCE_SCORE = 30;
const MIN_ACCEPTABLE_SCORE = 12;

interface ProductRow {
  id: string;
  sku: string;
  name: Record<string, unknown>;
  defaultSellPrice: bigint;
}

interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  name: Record<string, unknown>;
  sellPrice: bigint;
  attributes: Record<string, string>;
}

/**
 * "Osmanthus Oolong Milk Tea[700ml, Less, sugar, Standard, ice]"
 *  → coreName: "Osmanthus Oolong Milk Tea"
 *  → modifierTokens: ["700ml", "less", "sugar", "standard", "ice"]
 *
 * Modifiers are tokenised and lowercased so they can be compared against
 * variant name + attributes for variant disambiguation.
 */
export function splitOcrLineName(raw: string): {
  coreName: string;
  modifierTokens: string[];
} {
  const bracketStart = raw.indexOf('[');
  if (bracketStart < 0) {
    return { coreName: raw.trim(), modifierTokens: [] };
  }
  const core = raw.slice(0, bracketStart).trim();
  const bracket = raw.slice(bracketStart).replace(/[\[\]{}()]/g, ' ');
  const modifierTokens = bracket
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2 && token !== 'standard');
  return { coreName: core, modifierTokens };
}

function scoreProductRow(row: ProductRow, query: string, tokens: string[]): number {
  const text = normaliseLookup(`${row.sku} ${flattenLocalizedName(row.name)}`);
  const q = normaliseLookup(query);
  let score = 0;
  if (text === q) score += 120;
  if (text.includes(q)) score += 60;
  if (containsAllLookupTokens(text, tokens)) score += 30;
  for (const token of tokens) {
    if (text.includes(token)) score += 10;
  }
  return score;
}

function scoreVariantRow(row: VariantRow, modifierTokens: string[]): number {
  if (modifierTokens.length === 0) return 0;
  const name = normaliseLookup(flattenLocalizedName(row.name));
  const attrText = normaliseLookup(Object.values(row.attributes ?? {}).join(' '));
  const sku = normaliseLookup(row.sku);
  let score = 0;
  for (const token of modifierTokens) {
    const t = normaliseLookup(token);
    if (!t) continue;
    if (name === t || attrText === t || sku === t) score += 25;
    else if (name.includes(t) || attrText.includes(t) || sku.includes(t)) score += 15;
  }
  return score;
}

async function findCandidateProducts(
  coreName: string,
  ctx: AuditContext,
  limit = 5,
): Promise<ProductRow[]> {
  const trimmed = coreName.trim();
  if (!trimmed) return [];
  const tokens = lookupTokens(trimmed);
  const phrasePattern = `%${trimmed}%`;
  const tokenConditions = tokens.map((token) => {
    const tokenPattern = `%${token}%`;
    return or(
      ilike(products.sku, tokenPattern),
      sql`${products.name}->>'id' ILIKE ${tokenPattern}`,
      sql`${products.name}->>'en' ILIKE ${tokenPattern}`,
      sql`${products.name}->>'zh' ILIKE ${tokenPattern}`,
    );
  });
  const condition = or(
    ilike(products.sku, phrasePattern),
    sql`${products.name}->>'id' ILIKE ${phrasePattern}`,
    sql`${products.name}->>'en' ILIKE ${phrasePattern}`,
    sql`${products.name}->>'zh' ILIKE ${phrasePattern}`,
    ...tokenConditions,
  );

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      defaultSellPrice: products.defaultSellPrice,
    })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true), condition))
    .limit(20);

  return rows
    .map<ProductRow>((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name as Record<string, unknown>,
      defaultSellPrice: r.defaultSellPrice,
    }))
    .sort((a, b) => scoreProductRow(b, trimmed, tokens) - scoreProductRow(a, trimmed, tokens))
    .slice(0, limit);
}

async function findVariantsForProducts(
  productIds: string[],
  ctx: AuditContext,
): Promise<Map<string, VariantRow[]>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      name: productVariants.name,
      sellPrice: productVariants.sellPrice,
      attributes: productVariants.attributes,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.tenantId, ctx.tenantId),
        eq(productVariants.isActive, true),
        inArray(productVariants.productId, productIds),
      ),
    );

  const out = new Map<string, VariantRow[]>();
  for (const row of rows) {
    const list = out.get(row.productId) ?? [];
    list.push({
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      name: row.name as Record<string, unknown>,
      sellPrice: row.sellPrice,
      attributes: (row.attributes ?? {}) as Record<string, string>,
    });
    out.set(row.productId, list);
  }
  return out;
}

function pickVariant(
  variants: VariantRow[] | undefined,
  modifierTokens: string[],
): VariantRow | undefined {
  if (!variants || variants.length === 0) return undefined;
  if (variants.length === 1) return variants[0];
  if (modifierTokens.length === 0) return variants[0];
  const scored = variants
    .map((variant) => ({ variant, score: scoreVariantRow(variant, modifierTokens) }))
    .sort((a, b) => b.score - a.score);
  // Need at least one positive overlap, otherwise the first variant is
  // arbitrary and we'd rather just return the first registered one.
  const top = scored[0];
  if (!top || top.score === 0) return variants[0];
  return top.variant;
}

/**
 * Resolve every OCR'd line item against the catalog.
 *
 * Independent per item — a failure on one row does not block the others
 * (matches the user's "buat draft + warning unresolved" requirement).
 */
export async function resolveOcrLineItems(
  items: ExtractedLineItem[],
  ctx: AuditContext,
): Promise<ResolvedOrUnresolved[]> {
  if (items.length === 0) return [];

  // De-duplicate fuzzy product searches across the receipt — a struk
  // often repeats the same product name with different bracket
  // modifiers (e.g. multiple Osmanthus Oolong rows with different
  // sizes). One DB roundtrip per distinct core name.
  const coreNameCache = new Map<string, ProductRow[]>();
  const resolved: ResolvedOrUnresolved[] = [];

  const variantIdsToFetch = new Set<string>();
  const parsed = items.map((item) => splitOcrLineName(item.name));
  for (const p of parsed) {
    if (!coreNameCache.has(p.coreName)) coreNameCache.set(p.coreName, []);
  }

  // Populate the per-core-name candidate cache.
  for (const coreName of coreNameCache.keys()) {
    const list = await findCandidateProducts(coreName, ctx, 5);
    coreNameCache.set(coreName, list);
    for (const p of list) variantIdsToFetch.add(p.id);
  }

  const variantsByProduct = await findVariantsForProducts(Array.from(variantIdsToFetch), ctx);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const split = parsed[i];
    if (!item || !split) continue;
    const candidates = coreNameCache.get(split.coreName) ?? [];
    const top = candidates[0];
    const tokens = lookupTokens(split.coreName);
    const topScore = top ? scoreProductRow(top, split.coreName, tokens) : 0;

    if (!top || topScore < MIN_ACCEPTABLE_SCORE) {
      resolved.push({
        resolved: false,
        name: item.name,
        qty: item.qty,
        total: item.amount,
        reason: top ? 'low_confidence' : 'no_product_match',
        candidates:
          candidates.length > 0
            ? candidates
                .slice(0, 3)
                .map((c) => ({ sku: c.sku, name: flattenLocalizedName(c.name) }))
            : undefined,
      });
      continue;
    }

    const variants = variantsByProduct.get(top.id);
    const variant = pickVariant(variants, split.modifierTokens);

    const unitPrice = (
      variant?.sellPrice && variant.sellPrice > 0n ? variant.sellPrice : top.defaultSellPrice
    ).toString();
    const confidence: ResolvedLineItem['confidence'] =
      topScore >= HIGH_CONFIDENCE_SCORE
        ? 'high'
        : topScore >= MEDIUM_CONFIDENCE_SCORE
          ? 'medium'
          : 'low';

    resolved.push({
      resolved: true,
      productId: top.id,
      variantId: variant?.id,
      name: item.name,
      qty: item.qty,
      price: unitPrice,
      total: item.amount,
      matchedProductSku: top.sku,
      matchedProductName: flattenLocalizedName(top.name),
      matchedVariantName: variant ? flattenLocalizedName(variant.name) : undefined,
      confidence,
    });
  }

  return resolved;
}
