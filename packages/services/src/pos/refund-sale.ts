/**
 * pos.refund — SD §21.4
 *
 * Refunds a paid sales order (full or per-line partial).
 * Reverses journal entry, restores stock (BOM ingredients back),
 * marks order as refunded.
 *
 * Workflow:
 * 1. Load original sales order (must be 'paid')
 * 2. Validate refund lines against original order lines
 * 3. Reverse the original journal entry (full) or create proportional
 *    reversal JE (partial)
 * 4. Restore BOM ingredients to stock_levels for refunded lines only
 * 5. Update sales_order status → 'refunded'
 * 6. Audit log
 *
 * Permission: pos.refund
 *
 * Business rules:
 * - Only 'paid' orders can be refunded
 * - Idempotency: prevent double-refund via version check
 * - Refund restores exactly the specified quantity per line
 * - Reversal JE must be in an open accounting period
 * - Once refunded (full or partial), the order cannot be refunded again
 */

import { db } from '@erp/db';
import { accountingPeriods, journalEntries, journalLines } from '@erp/db/schema/accounting';
import { bomLines, boms, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import { salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { reverseJournal } from '../accounting/reverse-journal';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { claimIdempotency, releaseIdempotencyClaim, saveIdempotency } from '../shared/idempotency';
import { generateJournalNumber } from '../shared/number-generator';
import { RefundSaleInputSchema } from './schemas';
import type { SaleResult } from './schemas';

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
  let claimedIdempotencyId: string | null = null;

  try {
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

    const claimResult = await claimIdempotency(sale.locationId, data.idempotencyKey, 'pos.refund');
    if (!claimResult.ok) return claimResult;
    claimedIdempotencyId = claimResult.value.id;

    // ── Validate refund lines against original ──────────────────────────
    const originalLines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, data.salesOrderId))
      .orderBy(salesOrderLines.lineNo);

    const originalLineMap = new Map(originalLines.map((l) => [l.id, l]));

    let refundTotal = 0n;
    for (const rl of data.lines) {
      const ol = originalLineMap.get(rl.lineId);
      if (!ol) {
        return err(AppError.validation('pos.refund.lineNotFound', { lineId: rl.lineId }));
      }
      const originalQty = Math.round(Number(ol.qty));
      if (rl.qty > originalQty) {
        return err(
          AppError.validation('pos.refund.qtyExceeded', {
            lineId: rl.lineId,
            requestedQty: rl.qty,
            originalQty,
          }),
        );
      }
      const lineTotal = BigInt(ol.lineTotal.toString());
      refundTotal += (lineTotal * BigInt(rl.qty)) / BigInt(originalQty);
    }

    const isFullRefund =
      refundTotal === BigInt(sale.grandTotal.toString()) &&
      data.lines.length === originalLines.length;

    // ── CLAIM the order first ───────────────────────────────────────────
    // Without this, two cashiers refunding the same order could both run
    // the journal reversal AND restore stock twice. The atomic UPDATE
    // returning rows lets only one caller proceed; the other gets a
    // clean conflict before any books or stock are touched.
    const claimedSale = await db
      .update(salesOrders)
      .set({
        status: 'refunded',
        notes: data.reason,
        updatedBy: ctx.userId,
        version: sale.version + 1,
      })
      .where(
        and(
          eq(salesOrders.id, data.salesOrderId),
          eq(salesOrders.version, sale.version),
          eq(salesOrders.status, 'paid'),
        ),
      )
      .returning({ id: salesOrders.id });
    if (!claimedSale || claimedSale.length === 0) {
      return err(AppError.conflict('pos.refund.versionMismatch'));
    }

    // ── Journal handling ────────────────────────────────────────────────
    let reversalJeId: string | null = null;

    if (sale.journalEntryId) {
      if (isFullRefund) {
        const reversalResult = await reverseJournal(
          {
            journalId: sale.journalEntryId,
            postingDate: new Date().toISOString().slice(0, 10),
          },
          ctx, { skipPermissionCheck: true }
        );
        if (!reversalResult.ok) {
          // Roll the claim back so the order can be refunded again
          // when the underlying period reopens.
          await db
            .update(salesOrders)
            .set({ status: 'paid', notes: sale.notes, version: sale.version })
            .where(eq(salesOrders.id, data.salesOrderId));
          return err(
            AppError.internal('pos.refund.journalReversalFailed', {
              originalJeId: sale.journalEntryId,
              reason: reversalResult.error.code,
            }),
          );
        }
        reversalJeId = reversalResult.value.id;
      } else {
        const partialResult = await createPartialReversalJe(sale, refundTotal, ctx);
        if (!partialResult.ok) {
          await db
            .update(salesOrders)
            .set({ status: 'paid', notes: sale.notes, version: sale.version })
            .where(eq(salesOrders.id, data.salesOrderId));
          return partialResult as Result<never>;
        }
        reversalJeId = partialResult.value;
      }
    }

    // ── Restore stock for refunded lines only ──────────────────────────
    // Uses atomic SQL increment + variant-aware match to avoid the
    // float-drift and variant-overwrite bugs that hit other modules.
    for (const rl of data.lines) {
      const line = originalLineMap.get(rl.lineId);
      if (!line) continue;

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

      if (!bom) continue;

      const bomLineRows = await db
        .select({
          ingredientId: bomLines.ingredientId,
          qty: bomLines.qty,
          uom: bomLines.uom,
        })
        .from(bomLines)
        .where(and(eq(bomLines.bomId, bom.id), eq(bomLines.autoDeduct, true)));

      for (const ingredient of bomLineRows) {
        const restoreQty = (Number.parseFloat(ingredient.qty) * rl.qty).toFixed(3);

        const [currentLevel] = await db
          .select({ id: stockLevels.id, uom: stockLevels.uom })
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.tenantId, ctx.tenantId),
              eq(stockLevels.locationId, sale.locationId),
              eq(stockLevels.productId, ingredient.ingredientId),
            ),
          )
          .limit(1);

        if (!currentLevel || currentLevel.uom !== ingredient.uom) continue;

        // BOM lines reference ingredient products directly — raw
        // materials are tracked without variants in this schema, so
        // matching by tenant+location+productId is correct here.
        const incremented = await db
          .update(stockLevels)
          .set({
            qtyOnHand: sql`${stockLevels.qtyOnHand} + ${restoreQty}::numeric`,
            qtyAvailable: sql`${stockLevels.qtyAvailable} + ${restoreQty}::numeric`,
            updatedBy: ctx.userId,
            lastMovementAt: new Date(),
          })
          .where(
            and(
              eq(stockLevels.tenantId, ctx.tenantId),
              eq(stockLevels.locationId, sale.locationId),
              eq(stockLevels.id, currentLevel.id),
            ),
          )
          .returning({ id: stockLevels.id });

        if (!incremented || incremented.length === 0) continue;

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

    // ── Audit log ───────────────────────────────────────────────────────
    await auditRecord({
      action: 'refund',
      entityType: 'sales_order',
      entityId: data.salesOrderId,
      before: { status: sale.status },
      after: {
        status: 'refunded',
        reason: data.reason,
        reversalJeId,
        isFullRefund,
        refundTotal: refundTotal.toString(),
        refundLines: data.lines,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    const result: SaleResult = {
      id: sale.id,
      number: sale.number,
      status: 'refunded',
      channel: sale.channel as SaleResult['channel'],
      subtotal: sale.subtotal.toString(),
      discountTotal: sale.discountTotal.toString(),
      voucherDiscount: sale.voucherDiscount.toString(),
      taxTotal: sale.taxTotal.toString(),
      grandTotal: sale.grandTotal.toString(),
      lines: originalLines.map((l) => ({
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
      payments: [],
      journalEntryId: reversalJeId,
    };

    await saveIdempotency(db, sale!.locationId, data.idempotencyKey, 200, result);
    return ok(result);
  } catch (e) {
    if (claimedIdempotencyId) {
      await releaseIdempotencyClaim(claimedIdempotencyId, 500, { error: 'refund_failed' });
    }
    return err(AppError.internal('pos.refund.failed', e));
  }
}

// ─── Partial reversal JE ──────────────────────────────────────────────────────

async function createPartialReversalJe(
  sale: typeof salesOrders.$inferSelect,
  refundTotal: bigint,
  ctx: AuditContext,
): Promise<Result<string>> {
  if (!sale.journalEntryId) {
    return err(AppError.internal('pos.refund.missingJournalEntry'));
  }
  const originalJournalEntryId = sale.journalEntryId;
  const postingDate = new Date().toISOString().slice(0, 10);
  const periodCode = postingDate.substring(0, 7);

  const period = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
    )
    .then((r) => r[0]);

  if (!period) {
    return err(AppError.businessRule('accounting.journal.periodNotFound', { periodCode }));
  }
  if (period.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode,
        periodStatus: period.status,
      }),
    );
  }

  const originalJeLines = await db
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, originalJournalEntryId));

  if (originalJeLines.length === 0) {
    return err(AppError.internal('pos.refund.noJournalLines'));
  }

  const grandTotal = Number(sale.grandTotal.toString());
  const ratio = Number(refundTotal) / grandTotal;

  const scaledLines = originalJeLines.map((line) => ({
    accountId: line.accountId,
    locationId: line.locationId,
    description: line.description,
    debit: BigInt(Math.round(Number(line.credit) * ratio)),
    credit: BigInt(Math.round(Number(line.debit) * ratio)),
    taxCode: line.taxCode,
    partnerId: line.partnerId,
  }));

  let totalDebit = scaledLines.reduce((s, l) => s + l.debit, 0n);
  let totalCredit = scaledLines.reduce((s, l) => s + l.credit, 0n);

  if (totalDebit !== totalCredit) {
    const diff = totalDebit - totalCredit;
    if (diff > 0n) {
      let maxIdx = 0;
      for (let i = 1; i < scaledLines.length; i++) {
        const current = scaledLines[i];
        const max = scaledLines[maxIdx];
        if (current && max && current.credit > max.credit) maxIdx = i;
      }
      const target = scaledLines[maxIdx];
      if (!target) return err(AppError.internal('pos.refund.noJournalLines'));
      target.credit += diff;
      totalCredit += diff;
    } else {
      const absDiff = -diff;
      let maxIdx = 0;
      for (let i = 1; i < scaledLines.length; i++) {
        const current = scaledLines[i];
        const max = scaledLines[maxIdx];
        if (current && max && current.debit > max.debit) maxIdx = i;
      }
      const target = scaledLines[maxIdx];
      if (!target) return err(AppError.internal('pos.refund.noJournalLines'));
      target.debit += absDiff;
      totalDebit += absDiff;
    }
  }

  const jeId = generateId();
  const jeNumber = await generateJournalNumber(ctx.tenantId, postingDate);
  const now = new Date();

  await db.insert(journalEntries).values({
    id: jeId,
    tenantId: ctx.tenantId,
    locationId: sale.locationId,
    periodId: period.id,
    postingDate,
    number: jeNumber,
    description: `Partial refund of sale ${sale.number}`,
    referenceType: 'sales_order',
    referenceId: sale.id,
    status: 'posted',
    postedAt: now,
    postedBy: ctx.userId,
    reversedByJeId: null,
    totalDebit,
    totalCredit,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  const lineValues = scaledLines.map((line, idx) => ({
    id: generateId(),
    journalEntryId: jeId,
    lineNo: idx + 1,
    accountId: line.accountId,
    locationId: line.locationId,
    description: line.description,
    debit: line.debit,
    credit: line.credit,
    taxCode: line.taxCode,
    partnerId: line.partnerId,
  }));

  await db.insert(journalLines).values(lineValues);

  await auditRecord({
    action: 'create',
    entityType: 'journal_entry',
    entityId: jeId,
    before: null,
    after: {
      id: jeId,
      number: jeNumber,
      status: 'posted',
      partialRefundOf: sale.number,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
    },
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    ctx,
  });

  return ok(jeId);
}
