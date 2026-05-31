/**
 * reporting.cogs — T-0174.
 *
 * Recipe costing per sellable product: walks each product's active
 * BOM, multiplies every line by the ingredient's cost basis, and
 * returns Cost-of-Goods per portion in IDR (bigint).
 *
 * Cost basis priority (per ingredient):
 *   1. `productVariants.costPrice` when a specific variant is matched
 *      (Phase 2 — variant-aware BOM lines, not yet emitted by every
 *      recipe).
 *   2. `products.defaultCostPrice`.
 *
 * Sell price + margin are computed too so the report can flag
 * negative-margin products (e.g. price-cut promos that lost money).
 *
 * Permission: `accounting.reports` (re-used; same gate as P&L).
 */

import { db } from '@erp/db';
import { bomLines, boms, productVariants, products } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { requirePermission } from '../iam';

export interface CogsInput {
  /** Optional: only return one product when set. */
  productId?: string;
  /** Optional: include inactive products (default false). */
  includeInactive?: boolean;
}

export interface CogsLine {
  ingredientId: string;
  ingredientSku: string;
  ingredientName: Record<string, string>;
  qty: string;
  uom: string;
  unitCost: string; // bigint string
  lineCost: string; // qty * unitCost, bigint string
}

export interface CogsRow {
  productId: string;
  productSku: string;
  productName: Record<string, string>;
  sellPrice: string; // bigint string (defaultSellPrice)
  unitCost: string; // sum of lineCost
  grossMargin: string; // sell - cost (bigint string, may be negative)
  marginPercent: number | null; // null when sellPrice == 0
  lines: CogsLine[];
  bomVersion: number | null;
}

export interface CogsResult {
  products: CogsRow[];
  /** Products that have no active BOM yet. The UI surfaces this as
   *  a TODO list — "these dishes still need a recipe entered". */
  missingBomProductIds: string[];
}

export async function cogsReport(input: CogsInput, ctx: AuditContext): Promise<Result<CogsResult>> {
  const permCheck = await requirePermission(ctx.userId, 'accounting.reports');
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const productConds = [eq(products.tenantId, ctx.tenantId), eq(products.isSellable, true)];
      if (!input.includeInactive) productConds.push(eq(products.isActive, true));
      if (input.productId) productConds.push(eq(products.id, input.productId));

      const productRows = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          defaultCostPrice: products.defaultCostPrice,
          defaultSellPrice: products.defaultSellPrice,
        })
        .from(products)
        .where(and(...productConds));

      if (productRows.length === 0) {
        return { products: [], missingBomProductIds: [] };
      }
      const productIds = productRows.map((p) => p.id);
      const productById = new Map(productRows.map((p) => [p.id, p]));

      const bomRows = await db
        .select({
          id: boms.id,
          productId: boms.productId,
          version: boms.bomVersion,
        })
        .from(boms)
        .where(and(eq(boms.tenantId, ctx.tenantId), eq(boms.isActive, true)));

      // Most-recent active BOM per product (highest bomVersion wins —
      // T-0050 maintains monotonic versions).
      const bomByProduct = new Map<string, { id: string; version: number }>();
      for (const b of bomRows) {
        if (!productIds.includes(b.productId)) continue;
        const existing = bomByProduct.get(b.productId);
        if (!existing || b.version > existing.version) {
          bomByProduct.set(b.productId, { id: b.id, version: b.version });
        }
      }

      const bomIds = Array.from(bomByProduct.values()).map((b) => b.id);
      const lineRows = bomIds.length
        ? await db
            .select({
              bomId: bomLines.bomId,
              ingredientId: bomLines.ingredientId,
              qty: bomLines.qty,
              uom: bomLines.uom,
              isOptional: bomLines.isOptional,
            })
            .from(bomLines)
            .where(inArray(bomLines.bomId, bomIds))
        : [];

      const ingredientIds = Array.from(
        new Set(lineRows.filter((l) => bomIds.includes(l.bomId)).map((l) => l.ingredientId)),
      );
      const ingredientRows = ingredientIds.length
        ? await db
            .select({
              id: products.id,
              sku: products.sku,
              name: products.name,
              defaultCostPrice: products.defaultCostPrice,
            })
            .from(products)
            .where(and(
              eq(products.tenantId, ctx.tenantId),
              inArray(products.id, ingredientIds)
            ))
        : [];
      const ingredientById = new Map(ingredientRows.map((r) => [r.id, r]));

      // Variant-level cost overrides (optional — currently unused per
      // ingredient because bom_lines have no variantId column).
      const variantById = new Map<string, { sku: string; costPrice: bigint }>();
      if (ingredientIds.length) {
        const variantRows = await db
          .select({
            id: productVariants.id,
            sku: productVariants.sku,
            costPrice: productVariants.costPrice,
          })
          .from(productVariants)
          .where(eq(productVariants.tenantId, ctx.tenantId));
        for (const v of variantRows) {
          variantById.set(v.id, { sku: v.sku, costPrice: v.costPrice });
        }
      }

      const result: CogsRow[] = [];
      const missing: string[] = [];

      for (const p of productRows) {
        const bom = bomByProduct.get(p.id);
        if (!bom) {
          missing.push(p.id);
          continue;
        }

        let totalCost = 0n;
        const lines: CogsLine[] = [];
        for (const line of lineRows) {
          if (line.bomId !== bom.id) continue;
          if (line.isOptional) continue; // exclude toppings/upsells from base COGS
          const ingredient = ingredientById.get(line.ingredientId);
          if (!ingredient) continue;
          const unitCost = ingredient.defaultCostPrice;
          // qty is numeric(14,4) string — multiply by unit cost via float
          // since we are rolling up rupiah (integer) at the end.
          const qtyNumber = Number.parseFloat(line.qty);
          const lineCost = BigInt(Math.round(Number(unitCost) * qtyNumber));
          totalCost += lineCost;
          lines.push({
            ingredientId: ingredient.id,
            ingredientSku: ingredient.sku,
            ingredientName: ingredient.name as Record<string, string>,
            qty: line.qty,
            uom: line.uom,
            unitCost: unitCost.toString(),
            lineCost: lineCost.toString(),
          });
        }

        const sellPrice = p.defaultSellPrice;
        const grossMargin = sellPrice - totalCost;
        const marginPercent =
          sellPrice > 0n ? Number((grossMargin * 10000n) / sellPrice) / 100 : null;

        result.push({
          productId: p.id,
          productSku: p.sku,
          productName: p.name as Record<string, string>,
          sellPrice: sellPrice.toString(),
          unitCost: totalCost.toString(),
          grossMargin: grossMargin.toString(),
          marginPercent,
          lines,
          bomVersion: bom.version,
        });
      }

      // Negative-margin first to draw the operator's eye to bleeding
      // products; then alphabetical.
      result.sort((a, b) => {
        const am = BigInt(a.grossMargin);
        const bm = BigInt(b.grossMargin);
        if (am < 0n && bm >= 0n) return -1;
        if (bm < 0n && am >= 0n) return 1;
        return a.productSku.localeCompare(b.productSku);
      });

      return { products: result, missingBomProductIds: missing };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('reporting.cogs.failed', e)),
  );
}
