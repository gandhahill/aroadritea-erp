/**
 * inventory.deleteProductPermanently
 *
 * Hard-deletes a product only while it is still master data only. Any
 * transactional usage (sale, purchase, stock movement, opname, KDS, etc.)
 * blocks deletion so historical records remain auditable.
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import {
  bomLines,
  bomSubstitutes,
  boms,
  productModifierLinks,
  productModifierOptions,
  productVariants,
  products,
  stockAdjustmentLines,
  stockLevels,
  stockMovements,
  stockTransferLines,
} from '@erp/db/schema/inventory';
import { naixerProductCodes } from '@erp/db/schema/kitchen';
import { salesOrderLines } from '@erp/db/schema/pos';
import { promotionApplications } from '@erp/db/schema/promotion';
import { grnLines, purchaseInvoiceLines, purchaseOrderLines } from '@erp/db/schema/purchasing';
import { stockMovementManual, stockOpnameLines } from '@erp/db/schema/stock-opname';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requirePermission } from '../iam';

async function exists(label: string, query: PromiseLike<unknown[]>): Promise<string | null> {
  const rows = await query;
  return rows.length > 0 ? label : null;
}

export async function deleteProductPermanently(
  productId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.delete', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!productId || productId.trim().length === 0) {
    return err(AppError.validation('inventory.product.invalidId', {}));
  }

  return tryCatch(
    async () => {
      const [product] = await db
        .select({ id: products.id, sku: products.sku, name: products.name })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)))
        .limit(1);

      if (!product) throw AppError.notFound('inventory.product.notFound');

      const blocking = await Promise.all([
        exists(
          'sales_order_lines',
          db
            .select({ id: salesOrderLines.id })
            .from(salesOrderLines)
            .where(eq(salesOrderLines.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_movements',
          db
            .select({ id: stockMovements.id })
            .from(stockMovements)
            .where(eq(stockMovements.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_levels_nonzero',
          db
            .select({ id: stockLevels.id })
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.tenantId, ctx.tenantId),
                eq(stockLevels.productId, productId),
                sql`(${stockLevels.qtyOnHand} <> 0 OR ${stockLevels.qtyAvailable} <> 0 OR ${stockLevels.qtyReserved} <> 0)`,
              ),
            )
            .limit(1),
        ),
        exists(
          'purchase_order_lines',
          db
            .select({ id: purchaseOrderLines.id })
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.productId, productId))
            .limit(1),
        ),
        exists(
          'grn_lines',
          db
            .select({ id: grnLines.id })
            .from(grnLines)
            .where(eq(grnLines.productId, productId))
            .limit(1),
        ),
        exists(
          'purchase_invoice_lines',
          db
            .select({ id: purchaseInvoiceLines.id })
            .from(purchaseInvoiceLines)
            .where(eq(purchaseInvoiceLines.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_adjustment_lines',
          db
            .select({ id: stockAdjustmentLines.id })
            .from(stockAdjustmentLines)
            .where(eq(stockAdjustmentLines.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_transfer_lines',
          db
            .select({ id: stockTransferLines.id })
            .from(stockTransferLines)
            .where(eq(stockTransferLines.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_opname_lines',
          db
            .select({ id: stockOpnameLines.id })
            .from(stockOpnameLines)
            .where(eq(stockOpnameLines.productId, productId))
            .limit(1),
        ),
        exists(
          'stock_movement_manual',
          db
            .select({ id: stockMovementManual.id })
            .from(stockMovementManual)
            .where(eq(stockMovementManual.productId, productId))
            .limit(1),
        ),
        exists(
          'bom_lines_as_ingredient',
          db
            .select({ id: bomLines.id })
            .from(bomLines)
            .where(eq(bomLines.ingredientId, productId))
            .limit(1),
        ),
        exists(
          'bom_substitutes',
          db
            .select({ id: bomSubstitutes.id })
            .from(bomSubstitutes)
            .where(eq(bomSubstitutes.substituteProductId, productId))
            .limit(1),
        ),
        exists(
          'modifier_options_linked_product',
          db
            .select({ id: productModifierOptions.id })
            .from(productModifierOptions)
            .where(eq(productModifierOptions.linkedProductId, productId))
            .limit(1),
        ),
        exists(
          'naixer_product_codes',
          db
            .select({ id: naixerProductCodes.id })
            .from(naixerProductCodes)
            .where(eq(naixerProductCodes.productId, productId))
            .limit(1),
        ),
        exists(
          'promotion_applications',
          db
            .select({ id: promotionApplications.id })
            .from(promotionApplications)
            .where(eq(promotionApplications.freeProductId, productId))
            .limit(1),
        ),
      ]);

      const blockedBy = blocking.filter(Boolean);
      if (blockedBy.length > 0) {
        throw AppError.businessRule('inventory.product.deleteBlocked', { blockedBy });
      }

      const ownedBoms = await db
        .select({ id: boms.id })
        .from(boms)
        .where(and(eq(boms.tenantId, ctx.tenantId), eq(boms.productId, productId)));
      const ownedBomIds = ownedBoms.map((bom) => bom.id);
      if (ownedBomIds.length > 0) {
        const ownedBomLines = await db
          .select({ id: bomLines.id })
          .from(bomLines)
          .where(inArray(bomLines.bomId, ownedBomIds));
        const ownedBomLineIds = ownedBomLines.map((line) => line.id);
        if (ownedBomLineIds.length > 0) {
          await db.delete(bomSubstitutes).where(inArray(bomSubstitutes.bomLineId, ownedBomLineIds));
          await db.delete(bomLines).where(inArray(bomLines.bomId, ownedBomIds));
        }
        await db.delete(boms).where(inArray(boms.id, ownedBomIds));
      }

      await db
        .delete(stockLevels)
        .where(and(eq(stockLevels.tenantId, ctx.tenantId), eq(stockLevels.productId, productId)));
      await db.delete(productModifierLinks).where(eq(productModifierLinks.productId, productId));
      await db.delete(productVariants).where(eq(productVariants.productId, productId));
      await db
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenantId)));

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'delete',
        entityType: 'product',
        entityId: productId,
        before: { id: product.id, sku: product.sku, name: product.name },
        after: null,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return { id: productId };
    },
    (error) => {
      if (error instanceof AppError) return error;
      return AppError.internal('inventory.product.deleteFailed', error);
    },
  );
}
