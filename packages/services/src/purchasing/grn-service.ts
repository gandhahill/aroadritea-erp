/**
 * purchasing/grn-service.ts — GRN creation + confirmation (SD §21.6)
 *
 * createGRN:  creates a draft GRN from an approved/partial PO
 * confirmGRN: draft → confirmed, updates stock + PO status + JE
 */

import { db } from '@erp/db';
import { accountingPeriods, accounts } from '@erp/db/schema/accounting';
import { products, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import {
  goodsReceiptNotes,
  grnLines,
  purchaseOrderLines,
  purchaseOrders,
} from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { ConfirmGRNInputSchema, CreateGRNInputSchema, type GRNLineInput } from './grn-schemas';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRNI_ACCOUNT_CODE = '2-1120'; // Barang Diterima Belum Ditagih
const DEFAULT_INVENTORY_ACCOUNT_CODE = '1-1210'; // Persediaan Barang Dagangan

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveAccountId(tenantId: string, code: string): Promise<string | null> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .limit(1);
  return row?.id ?? null;
}

async function resolveInventoryAccountForProduct(
  tenantId: string,
  productId: string,
): Promise<string> {
  const [row] = await db
    .select({ inventoryAccountId: products.inventoryAccountId })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);

  if (row?.inventoryAccountId) return row.inventoryAccountId;

  const fallback = await resolveAccountId(tenantId, DEFAULT_INVENTORY_ACCOUNT_CODE);
  return fallback ?? DEFAULT_INVENTORY_ACCOUNT_CODE;
}

async function generateGRNNumber(
  tenantId: string,
  locationId: string,
  receivedDate: string,
): Promise<string> {
  const prefix = `GRN-${receivedDate.substring(0, 7)}-`;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(goodsReceiptNotes)
    .where(
      and(
        eq(goodsReceiptNotes.tenantId, tenantId),
        eq(goodsReceiptNotes.locationId, locationId),
        sql`${goodsReceiptNotes.number} LIKE ${prefix + '%'}`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// ─── Result types ───────────────────────────────────────────────────────────

export interface GRNResult {
  id: string;
  number: string;
  purchaseOrderId: string;
  receivedDate: string;
  status: string;
  lines: GRNLineResult[];
}

export interface GRNLineResult {
  id: string;
  lineNo: number;
  poLineId: string;
  productId: string;
  variantId: string | null;
  qtyReceived: string;
  uom: string;
  batchNo: string | null;
  expiryDate: string | null;
}

export interface GRNConfirmResult {
  id: string;
  number: string;
  status: string;
  poStatus: string;
  journalEntryId: string | null;
  movementCount: number;
}

// ─── Create GRN ─────────────────────────────────────────────────────────────

export async function createGRN(rawInput: unknown, ctx: AuditContext): Promise<Result<GRNResult>> {
  const permCheck = await requirePermission(ctx.userId, 'purchasing.grn.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateGRNInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }
  const input = parsed.data;

  // Validate PO exists and is in receivable status
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, input.purchaseOrderId)),
    )
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  const RECEIVABLE_STATUSES = new Set(['approved', 'partial']);
  if (!RECEIVABLE_STATUSES.has(po.status)) {
    return err(
      AppError.businessRule('purchasing.errors.po_not_receivable', {
        currentStatus: po.status,
      }),
    );
  }

  // Load all PO lines
  const poLines = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id))
    .orderBy(purchaseOrderLines.lineNo);

  const poLineMap = new Map(poLines.map((l) => [l.id, l]));

  // Validate GRN lines against PO lines
  for (const grnLine of input.lines) {
    const poLine = poLineMap.get(grnLine.poLineId);
    if (!poLine) {
      return err(
        AppError.validation('purchasing.errors.invalid_po_line', {
          poLineId: grnLine.poLineId,
        }),
      );
    }

    if (grnLine.productId !== poLine.productId) {
      return err(
        AppError.validation('purchasing.errors.product_mismatch', {
          poLineId: grnLine.poLineId,
          expected: poLine.productId,
          got: grnLine.productId,
        }),
      );
    }

    // Check qty does not exceed remaining
    const alreadyReceived = Number.parseFloat(poLine.qtyReceived);
    const ordered = Number.parseFloat(poLine.qtyOrdered);
    const receiving = Number.parseFloat(grnLine.qtyReceived);
    const remaining = ordered - alreadyReceived;

    if (receiving > remaining + 0.001) {
      return err(
        AppError.businessRule('purchasing.errors.qty_exceeds_remaining', {
          poLineId: grnLine.poLineId,
          ordered: poLine.qtyOrdered,
          alreadyReceived: poLine.qtyReceived,
          remaining: remaining.toFixed(3),
          receiving: grnLine.qtyReceived,
        }),
      );
    }
  }

  // Generate GRN number
  const grnNumber = await generateGRNNumber(ctx.tenantId, input.locationId, input.receivedDate);

  // Insert GRN header
  const grnId = generateId();
  await db.insert(goodsReceiptNotes).values({
    id: grnId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number: grnNumber,
    purchaseOrderId: input.purchaseOrderId,
    receivedDate: input.receivedDate,
    receivedBy: ctx.userId,
    notes: input.notes ?? null,
    status: 'draft',
    version: 1,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // Insert GRN lines
  const grnLineValues = input.lines.map((line: GRNLineInput, idx: number) => ({
    id: generateId(),
    grnId,
    poLineId: line.poLineId,
    lineNo: idx + 1,
    productId: line.productId,
    variantId: line.variantId ?? null,
    qtyReceived: line.qtyReceived,
    uom: line.uom,
    batchNo: line.batchNo ?? null,
    expiryDate: line.expiryDate ?? null,
    notes: line.notes ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));

  await db.insert(grnLines).values(grnLineValues);

  await auditRecord({
    action: 'create',
    entityType: 'grn',
    entityId: grnId,
    before: null,
    after: {
      id: grnId,
      number: grnNumber,
      purchaseOrderId: input.purchaseOrderId,
      status: 'draft',
      lineCount: grnLineValues.length,
    },
    ctx,
  });

  return ok({
    id: grnId,
    number: grnNumber,
    purchaseOrderId: input.purchaseOrderId,
    receivedDate: input.receivedDate,
    status: 'draft',
    lines: grnLineValues.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      poLineId: l.poLineId,
      productId: l.productId,
      variantId: l.variantId,
      qtyReceived: l.qtyReceived,
      uom: l.uom,
      batchNo: l.batchNo,
      expiryDate: l.expiryDate,
    })),
  });
}

// ─── Confirm GRN ────────────────────────────────────────────────────────────

export async function confirmGRN(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<GRNConfirmResult>> {
  const parsed = ConfirmGRNInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }

  // Load GRN
  const [grn] = await db
    .select()
    .from(goodsReceiptNotes)
    .where(
      and(
        eq(goodsReceiptNotes.tenantId, ctx.tenantId),
        eq(goodsReceiptNotes.id, parsed.data.grnId),
      ),
    )
    .limit(1);

  if (!grn) {
    return err(AppError.notFound('purchasing.errors.grn_not_found'));
  }

  // Permission scoped to the GRN's outlet, not the caller's current
  // location — receiving a delivery at outlet A should never be done
  // by a clerk logged into outlet B.
  const permCheck = await requirePermission(ctx.userId, 'purchasing.grn.create', {
    locationId: grn.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (grn.status !== 'draft') {
    return err(
      AppError.businessRule('purchasing.errors.grn_not_draft', {
        currentStatus: grn.status,
      }),
    );
  }

  // Load GRN lines
  const lines = await db
    .select()
    .from(grnLines)
    .where(eq(grnLines.grnId, grn.id))
    .orderBy(grnLines.lineNo);

  if (lines.length === 0) {
    return err(AppError.businessRule('purchasing.errors.grn_no_lines'));
  }

  // Load PO for context
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, grn.purchaseOrderId))
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  // Verify accounting period is open
  const periodCode = grn.receivedDate.substring(0, 7);
  const [period] = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
    )
    .limit(1);

  if (!period) {
    return err(
      AppError.businessRule('accounting.journal.periodNotFound', {
        periodCode,
      }),
    );
  }
  if (period.status !== 'open') {
    return err(
      AppError.businessRule('accounting.journal.periodClosed', {
        periodCode,
        periodStatus: period.status,
      }),
    );
  }

  // CLAIM the GRN first. Two concurrent confirmGRN calls would
  // otherwise both run the stock + PO line updates, doubling on-hand
  // qty and posting two GRNI journals.
  const claimedGrn = await db
    .update(goodsReceiptNotes)
    .set({
      status: 'confirmed',
      updatedBy: ctx.userId,
      version: grn.version + 1,
    })
    .where(
      and(
        eq(goodsReceiptNotes.id, grn.id),
        eq(goodsReceiptNotes.version, grn.version),
        eq(goodsReceiptNotes.status, 'draft'),
      ),
    )
    .returning({ id: goodsReceiptNotes.id });
  if (!claimedGrn || claimedGrn.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  // Resolve accounts BEFORE any state mutation. Failing here means the
  // CoA isn't seeded — surface the error before we corrupt stock.
  const grniAccountId = await resolveAccountId(ctx.tenantId, GRNI_ACCOUNT_CODE);
  if (!grniAccountId) {
    return err(AppError.businessRule('purchasing.errors.grni_account_not_found'));
  }

  // Load PO lines once so we can compute totals and remaining qty.
  const poLines = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id));
  const poLineMap = new Map(poLines.map((l) => [l.id, l]));

  // Compute total value with bigint math (3-decimal scaling) before
  // mutating anything. This drives the JE amount.
  let totalValue = 0n;
  for (const line of lines) {
    const poLine = poLineMap.get(line.poLineId);
    if (poLine) {
      const qty = BigInt(Math.round(Number.parseFloat(line.qtyReceived) * 1000));
      totalValue += (qty * poLine.unitPrice) / 1000n;
    }
  }

  // Post the JE FIRST. If it fails (period closed mid-flight, account
  // inactive), roll the GRN status back so nothing else runs.
  let journalEntryId: string | null = null;
  if (totalValue > 0n) {
    const firstProduct = lines[0]!;
    const invAccountId = await resolveInventoryAccountForProduct(
      ctx.tenantId,
      firstProduct.productId,
    );

    const jeResult = await createJournal(
      {
        postingDate: grn.receivedDate,
        locationId: grn.locationId,
        description: `GRN ${grn.number} — goods received (PO ${po.number})`,
        referenceType: 'purchase',
        referenceId: grn.id,
        lines: [
          {
            accountId: invAccountId,
            locationId: grn.locationId,
            description: `GRN ${grn.number} inventory`,
            debit: totalValue.toString(),
            credit: '0',
            partnerId: po.supplierId,
          },
          {
            accountId: grniAccountId,
            locationId: grn.locationId,
            description: `GRN ${grn.number} GRNI`,
            debit: '0',
            credit: totalValue.toString(),
            partnerId: po.supplierId,
          },
        ],
      },
      ctx,
    );
    if (!jeResult.ok) {
      await db
        .update(goodsReceiptNotes)
        .set({ status: 'draft', version: grn.version })
        .where(eq(goodsReceiptNotes.id, grn.id));
      return jeResult;
    }
    journalEntryId = jeResult.value.id;
  }

  // 1. Update PO line qtyReceived using atomic SQL so concurrent GRNs
  //    on the SAME PO don't race the value.
  for (const line of lines) {
    const poLine = poLineMap.get(line.poLineId);
    if (!poLine) continue;

    await db
      .update(purchaseOrderLines)
      .set({
        qtyReceived: sql`(${purchaseOrderLines.qtyReceived}::numeric + ${line.qtyReceived}::numeric)`,
        updatedBy: ctx.userId,
      })
      .where(eq(purchaseOrderLines.id, poLine.id));

    poLineMap.set(poLine.id, {
      ...poLine,
      qtyReceived: (
        Number.parseFloat(poLine.qtyReceived) + Number.parseFloat(line.qtyReceived)
      ).toFixed(3),
    });
  }

  // 2. Create stock movements (reason='purchase')
  const movementValues = lines.map((line) => {
    const poLine = poLineMap.get(line.poLineId);
    return {
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: grn.locationId,
      occurredAt: new Date(),
      stockLocationId: null,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      qtyDelta: line.qtyReceived,
      uom: line.uom,
      reason: 'purchase' as const,
      referenceType: 'grn' as const,
      referenceId: grn.id,
      unitCost: poLine?.unitPrice ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
  });

  await db.insert(stockMovements).values(movementValues);

  // 3. Update stock_levels — variant-aware lookup; bug fix from opname.
  for (const line of lines) {
    const variantCondition = line.variantId
      ? eq(stockLevels.variantId, line.variantId)
      : eq(stockLevels.variantId, '' as unknown as string);

    const incremented = await db
      .update(stockLevels)
      .set({
        qtyOnHand: sql`${stockLevels.qtyOnHand} + ${line.qtyReceived}::numeric`,
        qtyAvailable: sql`${stockLevels.qtyAvailable} + ${line.qtyReceived}::numeric`,
        updatedBy: ctx.userId,
        lastMovementAt: new Date(),
      })
      .where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, grn.locationId),
          eq(stockLevels.productId, line.productId),
          variantCondition,
        ),
      )
      .returning({ id: stockLevels.id });

    if (!incremented || incremented.length === 0) {
      await db.insert(stockLevels).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        locationId: grn.locationId,
        stockLocationId: null,
        productId: line.productId,
        variantId: line.variantId ?? null,
        batchNo: line.batchNo ?? null,
        qtyOnHand: line.qtyReceived,
        qtyReserved: '0',
        qtyAvailable: line.qtyReceived,
        uom: line.uom,
        avgUnitCost: null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }
  }

  // 4. Determine new PO status and update.
  const updatedPoLines = [...poLineMap.values()];
  const allFullyReceived = updatedPoLines.every(
    (l) => Number.parseFloat(l.qtyReceived) >= Number.parseFloat(l.qtyOrdered) - 0.001,
  );
  const newPoStatus = allFullyReceived ? 'received' : 'partial';

  await db
    .update(purchaseOrders)
    .set({
      status: newPoStatus,
      updatedBy: ctx.userId,
      version: po.version + 1,
    })
    .where(and(eq(purchaseOrders.id, po.id), eq(purchaseOrders.version, po.version)));

  // 7. Audit
  await auditRecord({
    action: 'approve',
    entityType: 'grn',
    entityId: grn.id,
    before: { status: 'draft' },
    after: {
      status: 'confirmed',
      poStatus: newPoStatus,
      journalEntryId,
      movementCount: movementValues.length,
      totalValue: totalValue.toString(),
    },
    ctx,
  });

  return ok({
    id: grn.id,
    number: grn.number,
    status: 'confirmed',
    poStatus: newPoStatus,
    journalEntryId,
    movementCount: movementValues.length,
  });
}
