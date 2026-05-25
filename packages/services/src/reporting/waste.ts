/**
 * reporting.waste — T-0174.
 *
 * Waste / spoilage report — totals of stock written off via
 * `stock_adjustments` whose `reason` matches the waste / spoilage
 * pattern, grouped by product, with quantity and rupiah value.
 *
 * Value basis: `stock_adjustment_lines.unitCost` when set (set by the
 * service when the adjustment commits) otherwise fall back to
 * `products.defaultCostPrice` so the report never says "0 IDR" just
 * because the lab tech forgot to fill it in.
 *
 * Permission: `inventory.view` — same gate as the variance dashboard,
 * because waste reads cross-location stock data.
 */

import { db } from '@erp/db';
import {
  productVariants,
  products,
  stockAdjustmentLines,
  stockAdjustments,
} from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { type Result, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

export interface WasteInput {
  /** Inclusive start date (YYYY-MM-DD). */
  from: string;
  /** Inclusive end date (YYYY-MM-DD). */
  to: string;
  /** Optional outlet filter. */
  locationId?: string;
  /** Default `false` — only count `approved` adjustments. Set true to
   *  include drafts (e.g. during a daily reconciliation preview). */
  includePending?: boolean;
}

export interface WasteRow {
  productId: string;
  productSku: string;
  productName: Record<string, string>;
  variantId: string | null;
  variantSku: string | null;
  qty: string; // numeric(14,3) string
  uom: string;
  valueIdr: string; // bigint string
  adjustmentCount: number;
}

export interface WasteResult {
  from: string;
  to: string;
  locationId: string | null;
  rows: WasteRow[];
  totalQty: string;
  totalValueIdr: string; // bigint string
}

export async function wasteReport(
  input: WasteInput,
  ctx: AuditContext,
): Promise<Result<WasteResult>> {
  const permCheck = await requirePermission(
    ctx.userId,
    'inventory.view',
    input.locationId ? { locationId: input.locationId } : undefined,
  );
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const conditions = [
        eq(stockAdjustments.tenantId, ctx.tenantId),
        gte(stockAdjustments.adjustmentDate, input.from),
        lte(stockAdjustments.adjustmentDate, input.to),
        or(
          ilike(stockAdjustments.reason, '%waste%'),
          ilike(stockAdjustments.reason, '%susut%'),
          ilike(stockAdjustments.reason, '%spoil%'),
          ilike(stockAdjustments.reason, '%basi%'),
          ilike(stockAdjustments.reason, '%expir%'),
        )!,
      ];
      if (!input.includePending) conditions.push(eq(stockAdjustments.status, 'approved'));
      if (input.locationId) conditions.push(eq(stockAdjustments.locationId, input.locationId));

      const lines = await db
        .select({
          adjustmentId: stockAdjustmentLines.adjustmentId,
          productId: stockAdjustmentLines.productId,
          variantId: stockAdjustmentLines.variantId,
          qtyDelta: stockAdjustmentLines.qtyDelta,
          uom: stockAdjustmentLines.uom,
          unitCost: stockAdjustmentLines.unitCost,
        })
        .from(stockAdjustmentLines)
        .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentLines.adjustmentId))
        .where(and(...conditions));

      const productIds = Array.from(new Set(lines.map((l) => l.productId)));
      const variantIds = Array.from(
        new Set(lines.map((l) => l.variantId).filter(Boolean) as string[]),
      );

      const productRows = productIds.length
        ? await db
            .select({
              id: products.id,
              sku: products.sku,
              name: products.name,
              uom: products.uom,
              defaultCostPrice: products.defaultCostPrice,
            })
            .from(products)
            .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)))
        : [];
      const productById = new Map(productRows.map((p) => [p.id, p]));

      const variantRows = variantIds.length
        ? await db
            .select({
              id: productVariants.id,
              sku: productVariants.sku,
              costPrice: productVariants.costPrice,
            })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.tenantId, ctx.tenantId),
                inArray(productVariants.id, variantIds),
              ),
            )
        : [];
      const variantById = new Map(variantRows.map((v) => [v.id, v]));

      // Aggregate per (productId, variantId) — waste is negative qtyDelta,
      // we flip sign so the report shows a positive quantity wasted.
      type Key = string;
      const buckets = new Map<
        Key,
        { row: WasteRow; valueBig: bigint; qtyNumber: number }
      >();

      for (const line of lines) {
        const product = productById.get(line.productId);
        if (!product) continue;
        const variant = line.variantId ? variantById.get(line.variantId) : null;

        const delta = Number.parseFloat(line.qtyDelta);
        const wastedQty = delta < 0 ? -delta : delta;
        const fallbackCost = variant?.costPrice ?? product.defaultCostPrice;
        const unitCost = line.unitCost ?? fallbackCost;
        const lineValue = BigInt(Math.round(Number(unitCost) * wastedQty));

        const key: Key = `${product.id}::${variant?.id ?? '-'}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.qtyNumber += wastedQty;
          existing.valueBig += lineValue;
          existing.row.adjustmentCount += 1;
        } else {
          buckets.set(key, {
            qtyNumber: wastedQty,
            valueBig: lineValue,
            row: {
              productId: product.id,
              productSku: product.sku,
              productName: product.name as Record<string, string>,
              variantId: variant?.id ?? null,
              variantSku: variant?.sku ?? null,
              qty: wastedQty.toFixed(3),
              uom: line.uom,
              valueIdr: lineValue.toString(),
              adjustmentCount: 1,
            },
          });
        }
      }

      let totalQty = 0;
      let totalValue = 0n;
      const rows: WasteRow[] = [];
      for (const bucket of buckets.values()) {
        bucket.row.qty = bucket.qtyNumber.toFixed(3);
        bucket.row.valueIdr = bucket.valueBig.toString();
        totalQty += bucket.qtyNumber;
        totalValue += bucket.valueBig;
        rows.push(bucket.row);
      }
      rows.sort((a, b) =>
        BigInt(b.valueIdr) > BigInt(a.valueIdr)
          ? 1
          : BigInt(b.valueIdr) < BigInt(a.valueIdr)
            ? -1
            : 0,
      );

      return {
        from: input.from,
        to: input.to,
        locationId: input.locationId ?? null,
        rows,
        totalQty: totalQty.toFixed(3),
        totalValueIdr: totalValue.toString(),
      };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('reporting.waste.failed', e)),
  );
}
