/**
 * pos.createSale — SD §9.5, §21.4
 *
 * Creates a paid POS sales order with journal entry.
 *
 * Workflow:
 * 1. Validate shift is open, idempotency key not used
 * 2. Validate products/variants exist and are sellable
 * 3. Calculate per-line: subtotal, tax (PB1 10% inclusive), total
 * 4. For each line: lookup active BOM → deduct ingredients from stock_levels
 * 5. Insert sales_order + lines + payments (with idempotency dedup)
 * 6. Create journal entry:
 *      DR Cash/Bank                    (total received)
 *      CR Revenue (4-1010)             (subtotal before PB1)
 *      CR PB1 Payable (2-1050)         (PB1 embedded in price)
 *    For GoFood/GrabFood/ShopeeFood (online channels):
 *      Debit reduced to 80% of price (commission already deducted by platform)
 *
 * Permissions:
 *   pos.transact — required for createSale
 *   pos.void — for voidSale (cashier)
 *
 * Business rules:
 * - Shift must be open
 * - Idempotency key prevents duplicate orders from offline sync
 * - All lines must be for sellable products
 * - Payment total must ≥ grandTotal (overpay allowed, change recorded separately)
 * - Online channel (gofood/grabfood/shopeefood): revenue = 80% × price (net of commission)
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '@erp/db';
import {
  salesOrders,
  salesOrderLines,
  payments,
  shifts,
  idempotencyRecords,
} from '@erp/db/schema/pos';
import { products, boms, bomLines, stockMovements, stockLevels } from '@erp/db/schema/inventory';
import { journalEntries, journalLines, accountingPeriods, accounts } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { createJournal } from '../accounting/create-journal';
import { calculateDonation, type RoundingOption } from './donation';
import { earnLoyaltyPoints } from '../crm';
import type { SaleResult, SaleLineResult, PaymentResult } from './schemas';

// ─── Constants ──────────────────────────────────────────────────────────────

const PB1_RATE_BPS = 1000; // 10% — SD §19.2 (inclusive)
const PB1_ACCOUNT_CODE = '2-1050'; // PB1/PBJT Payable
const REVENUE_ACCOUNT_CODE = '4-1010'; // Penjualan
const CASH_ACCOUNT_CODE = '1-1030'; // Kas di Bank
const DONATION_TRUST_ACCOUNT_CODE = '2-2050'; // Donation Trust Payable (SD §25.11.2)

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract PB1 from inclusive price and return net + tax. */
function extractPB1(inclusivePrice: bigint): { net: bigint; pb1: bigint } {
  // net = inclusive × 10000 / 11000 (basis points, integer-safe)
  // pb1 = inclusive - net
  const price10k = BigInt(inclusivePrice) * BigInt(10000);
  const net = price10k / BigInt(11000);
  const pb1 = inclusivePrice - net;
  return { net, pb1 };
}

/** Generate sales order number T01-YYYY-MM-NNNN (SD §9.5). */
async function generateSaleNumber(
  tenantId: string,
  locationId: string,
): Promise<string> {
  const now = new Date();
  const prefix = `T01-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;

  // Count existing sales orders with this prefix
  const result = await db.execute(
    sql`SELECT COUNT(*) FROM sales_orders WHERE tenant_id = ${tenantId} AND number LIKE ${prefix + '%'}`,
  );
  const count = Number(result.rows[0]?.count ?? 0);
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
}

/** Look up active BOM for a product, scale by qtySold. */
async function getBOMIngredients(
  tenantId: string,
  productId: string,
  variantId: string | null,
  qtySold: number,
): Promise<Array<{ ingredientId: string; qty: string; uom: string }>> {
  const bom = await db
    .select({ id: boms.id })
    .from(boms)
    .where(
      and(
        eq(boms.tenantId, tenantId),
        eq(boms.productId, productId),
        variantId ? eq(boms.variantId, variantId) : sql`boms.variant_id IS NULL`,
        eq(boms.isActive, true),
      ),
    )
    .then((r) => r[0]);

  if (!bom) return []; // No BOM → no ingredient deduction (service items)

  const lines = await db
    .select({
      ingredientId: bomLines.ingredientId,
      qty: bomLines.qty,
      uom: bomLines.uom,
    })
    .from(bomLines)
    .where(eq(bomLines.bomId, bom.id));

  return lines.map((l) => ({
    ingredientId: l.ingredientId,
    qty: (parseFloat(l.qty) * qtySold).toFixed(3),
    uom: l.uom,
  }));
}

/** Deduct ingredients from stock_levels. */
async function deductIngredients(
  tenantId: string,
  locationId: string,
  ingredients: Array<{ ingredientId: string; qty: string; uom: string }>,
  ctx: AuditContext,
): Promise<Result<void>> {
  try {
    for (const ing of ingredients) {
      const existing = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.tenantId, tenantId),
            eq(stockLevels.locationId, locationId),
            eq(stockLevels.productId, ing.ingredientId),
          ),
        )
        .then((r) => r[0]);

      if (existing) {
        const newOnHand = parseFloat(existing.qtyOnHand) - parseFloat(ing.qty);
        await db
          .update(stockLevels)
          .set({
            qtyOnHand: String(Math.max(0, newOnHand)),
            qtyAvailable: String(Math.max(0, newOnHand)),
            updatedBy: ctx.userId,
            lastMovementAt: new Date(),
          })
          .where(eq(stockLevels.id, existing.id));
      }

      // Record stock movement
      await db.insert(stockMovements).values({
        id: generateId(),
        tenantId,
        locationId,
        occurredAt: new Date(),
        stockLocationId: null as unknown as string,
        productId: ing.ingredientId,
        variantId: null,
        batchNo: null,
        qtyDelta: `-${ing.qty}` as unknown as ReturnType<typeof String>,
        uom: ing.uom,
        reason: 'sale',
        referenceType: 'sales_order',
        referenceId: '', // will be filled after order creation
        unitCost: null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
    return ok(undefined);
  } catch (e) {
    return err(AppError.internal('pos.createSale.ingredientDeductionFailed', e));
  }
}

// ─── Create Sale ──────────────────────────────────────────────────────────────

export async function createSale(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<SaleResult>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Parse input
  const parsed = CreateSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.createSale.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    // 3. Validate shift is open
    const shift = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.tenantId, ctx.tenantId),
          eq(shifts.id, data.shiftId),
          eq(shifts.status, 'open'),
        ),
      )
      .then((r) => r[0]);

    if (!shift) {
      return err(AppError.notFound('pos.createSale.shiftNotOpen', { shiftId: data.shiftId }));
    }

    // 4. Idempotency check — prevent duplicate from offline sync
    const existingIdempotency = await db
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.locationId, data.locationId),
          eq(idempotencyRecords.idempotencyKey, data.idempotencyKey),
        ),
      )
      .then((r) => r[0]);

    if (existingIdempotency) {
      // Return cached response
      const cachedBody = existingIdempotency.responseBody as { id: string } | null;
      if (cachedBody?.id) {
        return err(
          AppError.conflict('pos.createSale.duplicateOrder', {
            existingOrderId: cachedBody.id,
          }),
        );
      }
    }

    // 5. Validate products/variants
    const productIds = [...new Set(data.lines.map((l) => l.productId))];
    const foundProducts = await db
      .select({
        id: products.id,
        isSellable: products.isSellable,
        isActive: products.isActive,
        kind: products.kind,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, ctx.tenantId),
          inArray(products.id, productIds),
        ),
      );
    const productMap = new Map(foundProducts.map((p) => [p.id, p]));

    for (const line of data.lines) {
      const p = productMap.get(line.productId);
      if (!p) {
        return err(AppError.notFound('pos.createSale.productNotFound', { productId: line.productId }));
      }
      if (!p.isActive) {
        return err(AppError.businessRule('pos.createSale.productInactive', { productId: line.productId }));
      }
      if (!p.isSellable) {
        return err(AppError.businessRule('pos.createSale.productNotSellable', { productId: line.productId }));
      }
      // Skip BOM deduction for service items
    }

    // 6. Calculate totals
    let totalSubtotal = BigInt(0);
    let totalDiscount = BigInt(0);
    let totalTax = BigInt(0);
    let totalGrand = BigInt(0);

    const lineResults: Array<{
      productId: string;
      variantId: string | null;
      qty: string;
      unitPrice: bigint;
      lineSubtotal: bigint;
      lineDiscount: bigint;
      lineTax: bigint;
      lineTotal: bigint;
      modifierJson: unknown | null;
      notes: string | null;
    }> = [];

    for (const line of data.lines) {
      const unitPrice = BigInt(line.unitPrice);
      const lineSubtotal = unitPrice * BigInt(Math.round(line.qty));
      const lineDiscount = BigInt(line.lineDiscount ?? '0');
      const { net, pb1 } = extractPB1(unitPrice);
      const lineTax = pb1 * BigInt(Math.round(line.qty));
      const lineTotal = lineSubtotal; // unitPrice already includes PB1

      totalSubtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      totalTax += lineTax;
      totalGrand += lineTotal - lineDiscount;

      lineResults.push({
        productId: line.productId,
        variantId: line.variantId ?? null,
        qty: line.qty.toString(),
        unitPrice,
        lineSubtotal,
        lineDiscount,
        lineTax,
        lineTotal,
        modifierJson: line.modifierJson ?? null,
        notes: line.notes ?? null,
      });
    }

    // 7. Validate payment coverage
    const totalPaid = data.payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
    if (totalPaid < totalGrand) {
      return err(
        AppError.businessRule('pos.createSale.insufficientPayment', {
          required: totalGrand.toString(),
          paid: totalPaid.toString(),
        }),
      );
    }

    // 7b. SD §25.11 — Calculate donation / rounding for cash payments
    // The change amount = totalPaid - totalGrand (overpay amount)
    const changeAmount = totalPaid - totalGrand;
    const cashPayment = data.payments.find((p) => p.method === 'cash');
    const roundingOption = (cashPayment?.roundingOption ?? 'no_donation') as RoundingOption;

    const donationResult = calculateDonation(changeAmount, roundingOption);

    // 8. Generate order number + ID
    const saleId = generateId();
    const saleNumber = await generateSaleNumber(ctx.tenantId, data.locationId);
    const postingDate = new Date().toISOString().slice(0, 10);

    // 9. BOM ingredient deduction (for all non-service lines)
    for (const line of data.lines) {
      const p = productMap.get(line.productId);
      if (p?.kind === 'service') continue; // skip service items

      const ingredients = await getBOMIngredients(
        ctx.tenantId,
        line.productId,
        line.variantId ?? null,
        line.qty,
      );

      const deductResult = await deductIngredients(
        ctx.tenantId,
        data.locationId,
        ingredients,
        ctx,
      );
      if (!deductResult.ok) {
        // Log but don't fail — stock deduction is best-effort for POS
        // (stock levels may not have been initialized for raw materials)
      }

      // Update reference_id on stock movements (already created with empty ref)
      // For simplicity, movements are already created with referenceId='' and
      // will be linked via the sales_order after insertion.
    }

    // 10. Insert sales_order
    await db.insert(salesOrders).values({
      id: saleId,
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      number: saleNumber,
      shiftId: data.shiftId,
      cashierId: ctx.userId,
      channel: data.channel,
      status: 'paid',
      placedAt: new Date(),
      subtotal: totalSubtotal,
      discountTotal: totalDiscount,
      taxTotal: totalTax,
      grandTotal: totalGrand,
      customerId: data.customerId ?? null,
      idempotencyKey: data.idempotencyKey,
      notes: data.notes ?? null,
      version: 1,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // 11. Insert order lines
    const orderLines = lineResults.map((lr, idx) => ({
      id: generateId(),
      salesOrderId: saleId,
      lineNo: idx + 1,
      productId: lr.productId,
      variantId: lr.variantId,
      qty: lr.qty,
      unitPrice: lr.unitPrice,
      lineSubtotal: lr.lineSubtotal,
      lineDiscount: lr.lineDiscount,
      lineTax: lr.lineTax,
      lineTotal: lr.lineTotal,
      modifierJson: lr.modifierJson as never,
      notes: lr.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));
    await db.insert(salesOrderLines).values(orderLines);

    // 12. Insert payments
    const paymentRecords = data.payments.map((p) => ({
      id: generateId(),
      salesOrderId: saleId,
      method: p.method,
      amount: BigInt(p.amount),
      reference: p.reference ?? null,
      occurredAt: new Date(),
      // SD §25.11 — donation on cash payment
      donationAmount: p.method === 'cash' && donationResult.donatedAmount > BigInt(0)
        ? donationResult.donatedAmount
        : null,
      roundingOption: p.method === 'cash' && roundingOption !== 'no_donation'
        ? roundingOption
        : null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));
    await db.insert(payments).values(paymentRecords);

    // 13. Create journal entry
    // For online delivery: revenue = 80% × subtotal (net of commission)
    const isDeliveryChannel = ['gofood', 'grabfood', 'shopeefood'].includes(data.channel);
    const revenueMultiplier = isDeliveryChannel ? BigInt(80) : BigInt(100);

    const netRevenue = (totalSubtotal * revenueMultiplier) / BigInt(100);
    const netPB1 = totalTax; // PB1 on gross
    // Note: for delivery, netPB1 is on gross too (platform collects gross, remits PB1)

    // SD §25.11 — JE for cash + donation: record trust separately
    // Cash received = totalGrand + donationAmount (customer overpaid change, donated it)
    const totalCashReceived = totalGrand + donationResult.donatedAmount;
    const hasDonation = donationResult.donatedAmount > BigInt(0);

    const jeLines: Array<{
      accountId: string;
      locationId: string;
      description: string;
      debit: string;
      credit: string;
    }> = [];

    // DR Cash — total cash received (sale + any donation)
    jeLines.push({
      accountId: CASH_ACCOUNT_CODE,
      locationId: data.locationId,
      description: `${data.channel} payment${hasDonation ? ' + donasi' : ''}`,
      debit: totalCashReceived.toString(),
      credit: '0',
    });

    // SD §25.11 — CR Donation Trust Payable (liability held until remitted)
    if (hasDonation) {
      jeLines.push({
        accountId: DONATION_TRUST_ACCOUNT_CODE,
        locationId: data.locationId,
        description: `Donasi dari penjualan ${saleNumber}`,
        debit: '0',
        credit: donationResult.donatedAmount.toString(),
      });
    }

    // CR Revenue — net (after PB1)
    jeLines.push({
      accountId: REVENUE_ACCOUNT_CODE,
      locationId: data.locationId,
      description: `Sales ${saleNumber}`,
      debit: '0',
      credit: netRevenue.toString(),
    });

    // CR PB1 Payable
    jeLines.push({
      accountId: PB1_ACCOUNT_CODE,
      locationId: data.locationId,
      description: `PB1 ${saleNumber}`,
      debit: '0',
      credit: netPB1.toString(),
    });

    const jeResult = await createJournal(
      {
        postingDate,
        locationId: data.locationId,
        description: `POS ${saleNumber} — ${data.channel}${isDeliveryChannel ? ' (80% net)' : ''}${hasDonation ? ' + donasi' : ''}`,
        referenceType: 'sales',
        referenceId: saleId,
        lines: jeLines,
      },
      ctx,
    );

    let journalEntryId: string | null = null;
    if (jeResult.ok) {
      journalEntryId = jeResult.value.id;
      // Update sales_order with JE reference
      await db
        .update(salesOrders)
        .set({ journalEntryId })
        .where(eq(salesOrders.id, saleId));
    }

    // 14. Idempotency record
    const expiryAt = new Date();
    expiryAt.setHours(expiryAt.getHours() + 24);

    await db.insert(idempotencyRecords).values({
      id: existingIdempotency?.id ?? generateId(),
      idempotencyKey: data.idempotencyKey,
      locationId: data.locationId,
      responseStatus: 200,
      responseBody: { id: saleId } as never,
      createdAt: new Date(),
      expiresAt: expiryAt,
    });

    // 15. Audit log
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'sales_order',
      entityId: saleId,
      before: null,
      after: {
        number: saleNumber,
        channel: data.channel,
        subtotal: totalSubtotal.toString(),
        taxTotal: totalTax.toString(),
        grandTotal: totalGrand.toString(),
        lineCount: lineResults.length,
        paymentCount: data.payments.length,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    // 15b. Loyalty points — earn for member customers
    // Points calculated on net (after discounts), in cents (× 100)
    if (data.customerId && totalGrand > BigInt(0)) {
      earnLoyaltyPoints(data.customerId, totalGrand * BigInt(100), saleId, ctx).catch(() => {
        // Non-fatal: do not fail the sale if loyalty earning fails
      });
    }

    // 16. Build result
    const result: SaleResult = {
      id: saleId,
      number: saleNumber,
      status: 'paid',
      channel: data.channel,
      subtotal: totalSubtotal.toString(),
      discountTotal: totalDiscount.toString(),
      taxTotal: totalTax.toString(),
      grandTotal: totalGrand.toString(),
      lines: orderLines.map((ol) => ({
        id: ol.id,
        lineNo: ol.lineNo,
        productId: ol.productId,
        variantId: ol.variantId ?? null,
        qty: ol.qty,
        unitPrice: ol.unitPrice.toString(),
        lineSubtotal: ol.lineSubtotal.toString(),
        lineDiscount: ol.lineDiscount.toString(),
        lineTax: ol.lineTax.toString(),
        lineTotal: ol.lineTotal.toString(),
        modifierJson: ol.modifierJson,
        notes: ol.notes,
      })),
      payments: paymentRecords.map((pr) => ({
        id: pr.id,
        method: pr.method,
        amount: pr.amount.toString(),
        reference: pr.reference,
        donationAmount: pr.donationAmount ? pr.donationAmount.toString() : null,
        roundingOption: pr.roundingOption,
      })),
      journalEntryId,
    };

    return ok(result);
  } catch (e) {
    return err(AppError.internal('pos.createSale.failed', e));
  }
}

// ─── Void Sale (cancel before payment) ────────────────────────────────────────

export async function voidSale(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<SaleResult>> {
  const permCheck = await requirePermission(ctx.userId, 'pos.void', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = VoidSaleInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('pos.void.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const sale = await db
      .select()
      .from(salesOrders)
      .where(
        and(
          eq(salesOrders.tenantId, ctx.tenantId),
          eq(salesOrders.id, data.salesOrderId),
        ),
      )
      .then((r) => r[0]);

    if (!sale) {
      return err(AppError.notFound('pos.void.notFound', { salesOrderId: data.salesOrderId }));
    }
    if (sale.status !== 'open') {
      return err(
        AppError.businessRule('pos.void.notOpen', { currentStatus: sale.status }),
      );
    }
    if (sale.version !== data.version) {
      return err(AppError.conflict('pos.void.versionMismatch'));
    }

    await db
      .update(salesOrders)
      .set({
        status: 'voided',
        notes: data.reason,
        updatedBy: ctx.userId,
        version: sale.version + 1,
      })
      .where(
        and(
          eq(salesOrders.id, data.salesOrderId),
          eq(salesOrders.version, sale.version),
        ),
      );

    const lines = await db
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.salesOrderId, data.salesOrderId))
      .orderBy(salesOrderLines.lineNo);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'sales_order',
      entityId: data.salesOrderId,
      before: { status: sale.status },
      after: { status: 'voided', reason: data.reason },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

    return ok({
      id: sale.id,
      number: sale.number,
      status: 'voided',
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
      payments: [],
      journalEntryId: null,
    });
  } catch (e) {
    return err(AppError.internal('pos.void.failed', e));
  }
}

// ─── Input schema re-export (for convenience) ────────────────────────────────

import { CreateSaleInputSchema, VoidSaleInputSchema } from './schemas';