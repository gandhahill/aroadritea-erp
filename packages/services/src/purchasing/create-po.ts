/**
 * purchasing/create-po.ts — Purchase Order creation service (SD §21.6)
 *
 * Validates input, computes line totals + tax, generates PO number,
 * inserts PO header + lines, records audit.
 *
 * Permission: purchasing.po.create
 */

import { db } from '@erp/db';
import { partners, taxRates } from '@erp/db/schema/accounting';
import { products } from '@erp/db/schema/inventory';
import { purchaseOrderLines, purchaseOrders } from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { generatePONumber } from './number-generator';
import { type CreatePOInput, CreatePOInputSchema, type POLineInput } from './schemas';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface POLineResult {
  id: string;
  lineNo: number;
  productId: string;
  variantId: string | null;
  qtyOrdered: string;
  uom: string;
  unitPrice: string;
  lineSubtotal: string;
  lineTax: string;
  lineTotal: string;
  taxCode: string | null;
}

export interface POCreatedResult {
  id: string;
  number: string;
  supplierId: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  lines: POLineResult[];
}

export type POCreated = POCreatedResult;

// ─── Tax computation ────────────────────────────────────────────────────────────

/**
 * Compute tax for a single PO line.
 * Uses direct taxRates lookup — no full tax.resolve engine needed for PO.
 * For exclusive (PPN): tax = lineSubtotal × rateBps / 10000
 * For inclusive (PB1): tax = lineSubtotal × rateBps / (10000 + rateBps)
 */
async function computeLineTax(
  lineInput: POLineInput,
  lineSubtotal: bigint,
): Promise<{ taxCode: string | null; lineTax: bigint; rateBps: number; calculation: string }> {
  if (!lineInput.taxCode)
    return { taxCode: null, lineTax: 0n, rateBps: 0, calculation: 'exclusive' };

  const [rateRow] = await db
    .select({
      rateBps: taxRates.rateBps,
      calculation: taxRates.calculation,
    })
    .from(taxRates)
    .where(eq(taxRates.code, lineInput.taxCode))
    .limit(1);

  if (!rateRow)
    return { taxCode: lineInput.taxCode, lineTax: 0n, rateBps: 0, calculation: 'exclusive' };

  const rate = rateRow.rateBps;
  let lineTax: bigint;

  if (rateRow.calculation === 'inclusive') {
    // PB1 inclusive: back out tax from subtotal
    const denominator = BigInt(10000 + rate);
    lineTax = (lineSubtotal * BigInt(rate)) / denominator;
  } else {
    // Exclusive: add tax on top
    lineTax = (lineSubtotal * BigInt(rate)) / 10000n;
  }

  return {
    taxCode: lineInput.taxCode,
    lineTax,
    rateBps: rate,
    calculation: rateRow.calculation,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export async function createPO(rawInput: unknown, ctx: AuditContext): Promise<Result<POCreated>> {
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Parse input
  const parsed = CreatePOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }
  const input = parsed.data;

  // 3. Validate supplier exists in this tenant and is flagged as a
  //    supplier (partners table also holds customers/members — without
  //    the kind check a tenant could attach a customer record to a PO).
  const [supplier] = await db
    .select({ id: partners.id, kind: partners.kind })
    .from(partners)
    .where(and(eq(partners.id, input.supplierId), eq(partners.tenantId, ctx.tenantId)))
    .limit(1);

  if (!supplier) {
    return err(AppError.notFound('purchasing.errors.supplier_not_found'));
  }
  if (supplier.kind !== 'supplier') {
    return err(
      AppError.businessRule('purchasing.errors.partner_not_supplier', {
        partnerKind: supplier.kind,
      }),
    );
  }

  // 4. Validate all products exist within this tenant.
  const productIds: string[] = [...new Set(input.lines.map((l: POLineInput) => l.productId))];
  const productRows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));

  if (productRows.length !== productIds.length) {
    const found = new Set(productRows.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    return err(
      AppError.validation('purchasing.errors.product_not_found', { detail: missing.join(', ') }),
    );
  }

  // 5. Generate PO number
  const poNumber = await generatePONumber(ctx.tenantId, input.locationId, input.orderDate);

  // 6. Compute line totals
  const computedLines: Array<{
    id: string;
    lineNo: number;
    productId: string;
    variantId: string | null;
    qtyOrdered: string;
    uom: string;
    unitPrice: string;
    lineSubtotal: string;
    lineTax: string;
    lineTotal: string;
    taxCode: string | null;
    _unitPrice: bigint;
    _qtyOrdered: bigint;
    _lineSubtotal: bigint;
    _lineTax: bigint;
  }> = [];

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    const qtyNum = BigInt(Math.round(Number.parseFloat(line.qtyOrdered) * 1000));
    const unitPriceNum = BigInt(line.unitPrice);
    const lineSubtotal = (qtyNum * unitPriceNum) / 1000n;

    const { taxCode, lineTax } = await computeLineTax(line, lineSubtotal);

    computedLines.push({
      id: generateId(),
      lineNo: i + 1,
      productId: line.productId,
      variantId: line.variantId ?? null,
      qtyOrdered: line.qtyOrdered,
      uom: line.uom,
      unitPrice: line.unitPrice,
      lineSubtotal: lineSubtotal.toString(),
      lineTax: lineTax.toString(),
      lineTotal: (lineSubtotal + lineTax).toString(),
      taxCode,
      _unitPrice: unitPriceNum,
      _qtyOrdered: qtyNum,
      _lineSubtotal: lineSubtotal,
      _lineTax: lineTax,
    });
  }

  // 7. Compute totals
  const subtotal = computedLines.reduce((sum, l) => sum + l._lineSubtotal, 0n);
  const taxTotal = computedLines.reduce((sum, l) => sum + l._lineTax, 0n);
  const grandTotal = subtotal + taxTotal;

  // 8. Insert PO
  const poId = generateId();
  await db.insert(purchaseOrders).values({
    id: poId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number: poNumber,
    supplierId: input.supplierId,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate ?? null,
    status: 'draft',
    subtotal,
    taxTotal,
    grandTotal,
    notes: input.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // 9. Insert PO lines
  const lineValues = computedLines.map((l) => ({
    id: l.id,
    purchaseOrderId: poId,
    lineNo: l.lineNo,
    productId: l.productId,
    variantId: l.variantId,
    qtyOrdered: l.qtyOrdered,
    qtyReceived: '0',
    uom: l.uom,
    unitPrice: l._unitPrice,
    lineSubtotal: l._lineSubtotal,
    lineTax: l._lineTax,
    lineTotal: l._lineSubtotal + l._lineTax,
    taxCode: l.taxCode,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db.insert(purchaseOrderLines).values(lineValues);

  // 10. Audit
  await auditRecord({
    action: 'create',
    entityType: 'purchase_order',
    entityId: poId,
    before: null,
    after: {
      id: poId,
      number: poNumber,
      supplierId: input.supplierId,
      status: 'draft',
      subtotal: subtotal.toString(),
      grandTotal: grandTotal.toString(),
      lineCount: computedLines.length,
    },
    ctx,
  });

  return ok({
    id: poId,
    number: poNumber,
    supplierId: input.supplierId,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate ?? null,
    status: 'draft',
    subtotal: subtotal.toString(),
    taxTotal: taxTotal.toString(),
    grandTotal: grandTotal.toString(),
    lines: computedLines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      productId: l.productId,
      variantId: l.variantId,
      qtyOrdered: l.qtyOrdered,
      uom: l.uom,
      unitPrice: l.unitPrice,
      lineSubtotal: l.lineSubtotal,
      lineTax: l.lineTax,
      lineTotal: l.lineTotal,
      taxCode: l.taxCode,
    })),
  });
}
