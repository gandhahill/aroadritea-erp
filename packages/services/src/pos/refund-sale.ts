/**
 * pos.refund — SD §21.4
 *
 * Refunds a paid sales order.
 * Reverses journal entry, restores stock (BOM ingredients back),
 * marks order as refunded.
 *
 * Workflow:
 * 1. Load original sales order (must be 'paid')
 * 2. Reverse the original journal entry via accounting.reverseJournal
 * 3. Restore BOM ingredients to stock_levels (+reverse movement, reason='refund')
 * 4. Update sales_order status → 'refunded'
 * 5. Audit log
 *
 * Permission: pos.refund
 *
 * Business rules:
 * - Only 'paid' orders can be refunded
 * - Idempotency: prevent double-refund via version check
 * - Refund restores exactly the same quantity that was sold
 * - Reversal JE must be in an open accounting period
 */

import { db } from '@erp/db';
import { journalEntries } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { bomLines, boms, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { payments, salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { reverseJournal } from '../accounting/reverse-journal';
import { requirePermission } from '../iam';
import { RefundSaleInputSchema } from './schemas';
import type { SaleResult } from './schemas';

// ─── Refund Sale ──────────────────────────────────────────────────────────────

export async function refundSale(input: unknown, ctx: AuditContext): Promise<Result<SaleResult>> {
  const parsed = RefundSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.refund.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    // 1. Load original sales order
    const sale = await db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenantId), eq(salesOrders.id, data.salesOrderId)))
      .then((r) => r[0]);

    if (!sale) {
      return err(AppError.notFound('pos.refund.notFound', { salesOrderId: data.salesOrderId }));
    }
    const permCheck = await requirePermission(ctx.userId, 'pos.refund', {
      locationId: sale.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (sale.status !== 'paid') {
      return err(AppError.businessRule('pos.refund.notPaid', { currentStatus: sale.status }));
    }
    if (sale.version !== data.version) {
      return err(AppError.conflict('pos.refund.versionMismatch'));
    }

    // 2. Reverse the original journal entry
    let reversalJeId: string | null = null;
    if (sale.journalEntryId) {
      const reversalResult = await reverseJournal(
        {
          journalId: sale.journalEntryId,
          postingDate: new Date().toISOString().slice(0, 10),
        },
        ctx,
      );
      if (!reversalResult.ok) {
        // Refund cannot proceed without reversal — return error
        return err(
          AppError.internal('pos.refund.journalReversalFailed', {
            originalJeId: sale.journalEntryId,
            reason: reversalResult.error.code,
          }),
        );
      }
      reversalJeId = reversalResult.value.id;
    }

    // 3. Restore BOM ingredients to stock_levels (undo createSale deduction)
    const lines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, data.salesOrderId))
      .orderBy(salesOrderLines.lineNo);

    for (const line of lines) {
      // Find active BOM for this product
      const bom = await db
        .select({ id: boms.id })
        .from(boms)
        .where(
          and(
            eq(boms.tenantId, ctx.tenantId),
            eq(boms.productId, line.productId),
            line.variantId ? eq(boms.variantId, line.variantId) : sql`boms.variant_id IS NULL`,
            eq(boms.isActive, true),
          ),
        )
        .then((r) => r[0]);

      if (!bom) continue; // No BOM → nothing to restore (service item)

      const bomLineRows = await db
        .select({
          ingredientId: bomLines.ingredientId,
          qty: bomLines.qty,
          uom: bomLines.uom,
        })
        .from(bomLines)
        .where(eq(bomLines.bomId, bom.id));

      const qtySold = Number.parseFloat(line.qty);

      for (const ingredient of bomLineRows) {
        const restoreQty = (Number.parseFloat(ingredient.qty) * qtySold).toFixed(3);

        // Upsert stock_levels: add back
        const existingLevel = await db
          .select()
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.tenantId, ctx.tenantId),
              eq(stockLevels.locationId, sale.locationId),
              eq(stockLevels.productId, ingredient.ingredientId),
            ),
          )
          .then((r) => r[0]);

        if (existingLevel) {
          const newOnHand =
            Number.parseFloat(existingLevel.qtyOnHand) + Number.parseFloat(restoreQty);
          await db
            .update(stockLevels)
            .set({
              qtyOnHand: String(newOnHand),
              qtyAvailable: String(newOnHand),
              updatedBy: ctx.userId,
              lastMovementAt: new Date(),
            })
            .where(eq(stockLevels.id, existingLevel.id));
        } else {
          // Insert new stock level for this ingredient
          await db.insert(stockLevels).values({
            id: generateId(),
            tenantId: ctx.tenantId,
            locationId: sale.locationId,
            productId: ingredient.ingredientId,
            variantId: null,
            batchNo: null,
            qtyOnHand: restoreQty,
            qtyAvailable: restoreQty,
            qtyReserved: '0',
            uom: ingredient.uom,
            avgUnitCost: null,
            lastMovementAt: new Date(),
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
        }

        // Record stock movement (reason='refund')
        await db.insert(stockMovements).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          locationId: sale.locationId,
          occurredAt: new Date(),
          stockLocationId: null as unknown as string,
          productId: ingredient.ingredientId,
          variantId: null,
          batchNo: null,
          qtyDelta: restoreQty,
          uom: ingredient.uom,
          reason: 'refund',
          referenceType: 'sales_order',
          referenceId: data.salesOrderId,
          unitCost: null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }
    }

    // 4. Update sales_order status → 'refunded'
    await db
      .update(salesOrders)
      .set({
        status: 'refunded',
        notes: data.reason ?? null,
        updatedBy: ctx.userId,
        version: sale.version + 1,
      })
      .where(and(eq(salesOrders.id, data.salesOrderId), eq(salesOrders.version, sale.version)));

    // 5. Audit log
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'refund',
      entityType: 'sales_order',
      entityId: data.salesOrderId,
      before: { status: sale.status },
      after: { status: 'refunded', reason: data.reason, reversalJeId },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    // 6. Build result
    return ok({
      id: sale.id,
      number: sale.number,
      status: 'refunded',
      channel: sale.channel as SaleResult['channel'],
      subtotal: sale.subtotal.toString(),
      discountTotal: sale.discountTotal.toString(),
      taxTotal: sale.taxTotal.toString(),
      grandTotal: sale.grandTotal.toString(),
      lines: lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        productId: l.productId,
        variantId: l.variantId ?? null,
        qty: l.qty,
        unitPrice: l.unitPrice.toString(),
        lineSubtotal: l.lineSubtotal.toString(),
        lineDiscount: l.lineDiscount.toString(),
        lineTax: l.lineTax.toString(),
        lineTotal: l.lineTotal.toString(),
        modifierJson: l.modifierJson as unknown,
        notes: l.notes,
      })),
      payments: [], // no payments in refund result
      journalEntryId: reversalJeId,
    });
  } catch (e) {
    return err(AppError.internal('pos.refund.failed', e));
  }
}
