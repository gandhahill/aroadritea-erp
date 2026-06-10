/**
 * purchasing/return-service.ts — Purchase returns (T-0180).
 *
 * Flow: createDraft → submit → approve → post → (optional cancel
 * before post). Posting creates a journal entry that reverses the
 * relevant portion of the original GRN posting:
 *
 *   DR  Accounts Payable / GRNI         (supplier credit reduces)
 *   CR  Inventory (per-product account) (stock value reduces)
 *
 * Stock is decremented via the standard stock_movements path with
 * reason = 'purchase_return'.
 *
 * Permissions:
 *   - purchasing.return.create   — draft + submit
 *   - purchasing.return.approve  — approve a submitted return
 *   - purchasing.return.post     — post journal + decrement stock
 *
 * Concurrency: every transition uses optimistic locking via
 * `version` column so two clerks approving the same return at the
 * same time don't double-post.
 */

import { db } from '@erp/db';
import { accountingPeriods, accounts, taxRates } from '@erp/db/schema/accounting';
import { products, stockLevels, stockMovements } from '@erp/db/schema/inventory';
import {
  goodsReceiptNotes,
  grnLines,
  purchaseReturnLines,
  purchaseReturns,
} from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { PermissionCode } from '@erp/shared/types';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  type CreatePurchaseReturnInput,
  CreatePurchaseReturnInputSchema,
  type PurchaseReturnIdInput,
  PurchaseReturnIdInputSchema,
} from './return-schemas';

// GRNI & inventory posting accounts come from the configurable account map
// (Settings → Accounting → Account Mapping); see accounting/posting-accounts.ts.
// A product may override its own inventory account via products.inventoryAccountId.

// ─── Helpers ──────────────────────────────────────────────────────────────

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
  const codes = await getPostingAccountCodes(tenantId);
  const fallback = await resolveAccountId(tenantId, codes.inventory);
  return fallback ?? codes.inventory;
}

async function generateReturnNumber(
  tenantId: string,
  locationId: string,
  returnDate: string,
): Promise<string> {
  const prefix = `PR-${returnDate.substring(0, 7)}-`;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseReturns)
    .where(
      and(
        eq(purchaseReturns.tenantId, tenantId),
        eq(purchaseReturns.locationId, locationId),
        sql`${purchaseReturns.number} LIKE ${prefix + '%'}`,
      ),
    );
  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// ─── Return shapes ────────────────────────────────────────────────────────

export interface PurchaseReturnSummary {
  id: string;
  number: string;
  supplierId: string;
  grnId: string;
  locationId: string;
  status: string;
  returnDate: string;
  grandTotal: string;
  createdAt: string;
}

export interface PurchaseReturnDetail extends PurchaseReturnSummary {
  reason: string;
  notes: string | null;
  subtotal: string;
  taxTotal: string;
  journalEntryId: string | null;
  lines: Array<{
    id: string;
    lineNo: number;
    grnLineId: string;
    productId: string;
    variantId: string | null;
    qtyReturned: string;
    uom: string;
    unitCost: string;
    lineSubtotal: string;
    lineTax: string;
    lineTotal: string;
    taxCode: string | null;
    notes: string | null;
  }>;
}

// ─── Create draft ─────────────────────────────────────────────────────────

export async function createPurchaseReturn(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<PurchaseReturnDetail>> {
  const parsed = CreatePurchaseReturnInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }
  const input: CreatePurchaseReturnInput = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'purchasing.return.create', {
    locationId: input.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // Load the source GRN so we can validate it belongs to this tenant
  // and is at the right location. We also validate that no requested
  // qty exceeds what was received per grn_line.
  const [grn] = await db
    .select()
    .from(goodsReceiptNotes)
    .where(and(eq(goodsReceiptNotes.tenantId, ctx.tenantId), eq(goodsReceiptNotes.id, input.grnId)))
    .limit(1);
  if (!grn) {
    return err(AppError.notFound('purchasing.errors.grn_not_found'));
  }
  if (grn.locationId !== input.locationId) {
    return err(
      AppError.businessRule('purchasing.errors.grn_location_mismatch', {
        grnLocation: grn.locationId,
        inputLocation: input.locationId,
      }),
    );
  }
  if (grn.status !== 'confirmed') {
    return err(
      AppError.businessRule('purchasing.errors.grn_not_confirmed', {
        currentStatus: grn.status,
      }),
    );
  }

  // Load the GRN lines once for qty validation.
  const srcLines = await db.select().from(grnLines).where(eq(grnLines.grnId, grn.id));
  const grnLineMap = new Map(srcLines.map((l) => [l.id, l]));

  for (const line of input.lines) {
    const src = grnLineMap.get(line.grnLineId);
    if (!src) {
      return err(
        AppError.validation('purchasing.errors.return_line_not_in_grn', {
          grnLineId: line.grnLineId,
        }),
      );
    }
    if (Number.parseFloat(line.qtyReturned) > Number.parseFloat(src.qtyReceived) + 0.001) {
      return err(
        AppError.businessRule('purchasing.errors.return_qty_exceeds_received', {
          grnLineId: line.grnLineId,
          requested: line.qtyReturned,
          received: src.qtyReceived,
        }),
      );
    }
  }

  // Totals (bigint sen-equivalent — using rupiah here per the rest of
  // purchasing). qty is 3-decimal so multiply by 1000 then divide.
  let subtotal = 0n;
  for (const line of input.lines) {
    const qtyScaled = BigInt(Math.round(Number.parseFloat(line.qtyReturned) * 1000));
    subtotal += (qtyScaled * BigInt(line.unitCost)) / 1000n;
  }
  // Tax handling stays open for now — purchase returns rarely include
  // PPN in this domain (retail F&B). Future: resolve via tax engine.
  const taxTotal = 0n;
  const grandTotal = subtotal + taxTotal;

  const number = await generateReturnNumber(ctx.tenantId, input.locationId, input.returnDate);
  const returnId = generateId();

  await db.insert(purchaseReturns).values({
    id: returnId,
    tenantId: ctx.tenantId,
    locationId: input.locationId,
    number,
    supplierId: input.supplierId,
    grnId: input.grnId,
    returnDate: input.returnDate,
    reason: input.reason,
    status: 'draft',
    subtotal,
    taxTotal,
    grandTotal,
    notes: input.notes ?? null,
    version: 1,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  const lineRows = input.lines.map((line, idx) => {
    const qtyScaled = BigInt(Math.round(Number.parseFloat(line.qtyReturned) * 1000));
    const lineSubtotal = (qtyScaled * BigInt(line.unitCost)) / 1000n;
    return {
      id: generateId(),
      returnId,
      lineNo: idx + 1,
      grnLineId: line.grnLineId,
      productId: line.productId,
      variantId: line.variantId ?? null,
      qtyReturned: line.qtyReturned,
      uom: line.uom,
      unitCost: BigInt(line.unitCost),
      lineSubtotal,
      lineTax: 0n,
      lineTotal: lineSubtotal,
      taxCode: line.taxCode ?? null,
      notes: line.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
  });
  await db.insert(purchaseReturnLines).values(lineRows);

  await auditRecord({
    action: 'create',
    entityType: 'purchase_return',
    entityId: returnId,
    before: null,
    after: {
      id: returnId,
      number,
      grnId: input.grnId,
      supplierId: input.supplierId,
      status: 'draft',
      lineCount: lineRows.length,
      grandTotal: grandTotal.toString(),
    },
    ctx,
  });

  return ok({
    id: returnId,
    number,
    supplierId: input.supplierId,
    grnId: input.grnId,
    locationId: input.locationId,
    status: 'draft',
    returnDate: input.returnDate,
    reason: input.reason,
    notes: input.notes ?? null,
    subtotal: subtotal.toString(),
    taxTotal: taxTotal.toString(),
    grandTotal: grandTotal.toString(),
    journalEntryId: null,
    createdAt: new Date().toISOString(),
    lines: lineRows.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      grnLineId: l.grnLineId,
      productId: l.productId,
      variantId: l.variantId,
      qtyReturned: l.qtyReturned,
      uom: l.uom,
      unitCost: l.unitCost.toString(),
      lineSubtotal: l.lineSubtotal.toString(),
      lineTax: l.lineTax.toString(),
      lineTotal: l.lineTotal.toString(),
      taxCode: l.taxCode,
      notes: l.notes,
    })),
  });
}

// ─── Status transitions ───────────────────────────────────────────────────

async function transitionStatus(
  returnId: string,
  fromStatus: string,
  toStatus: string,
  ctx: AuditContext,
  permission: string,
  patch: Record<string, unknown> = {},
): Promise<Result<{ id: string; status: string }>> {
  const [row] = await db
    .select()
    .from(purchaseReturns)
    .where(and(eq(purchaseReturns.tenantId, ctx.tenantId), eq(purchaseReturns.id, returnId)))
    .limit(1);
  if (!row) return err(AppError.notFound('purchasing.errors.return_not_found'));

  const permCheck = await requirePermission(ctx.userId, permission as PermissionCode, {
    locationId: row.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (row.status !== fromStatus) {
    return err(
      AppError.businessRule('purchasing.errors.return_wrong_status', {
        expected: fromStatus,
        actual: row.status,
      }),
    );
  }

  const claimed = await db
    .update(purchaseReturns)
    .set({
      status: toStatus,
      updatedBy: ctx.userId,
      version: row.version + 1,
      ...patch,
    })
    .where(
      and(
        eq(purchaseReturns.id, returnId),
        eq(purchaseReturns.version, row.version),
        eq(purchaseReturns.status, fromStatus),
      ),
    )
    .returning({ id: purchaseReturns.id });

  if (!claimed || claimed.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  await auditRecord({
    action: 'update',
    entityType: 'purchase_return',
    entityId: returnId,
    before: { status: fromStatus },
    after: { status: toStatus },
    ctx,
  });

  return ok({ id: returnId, status: toStatus });
}

export async function submitPurchaseReturn(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PurchaseReturnIdInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input'));
  }
  return transitionStatus(
    parsed.data.returnId,
    'draft',
    'submitted',
    ctx,
    'purchasing.return.create',
    {
      submittedBy: ctx.userId,
      submittedAt: new Date(),
    },
  );
}

export async function approvePurchaseReturn(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PurchaseReturnIdInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input'));
  }
  return transitionStatus(
    parsed.data.returnId,
    'submitted',
    'approved',
    ctx,
    'purchasing.return.approve',
    {
      approvedBy: ctx.userId,
      approvedAt: new Date(),
    },
  );
}

export async function cancelPurchaseReturn(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = PurchaseReturnIdInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input'));
  }
  // Allow cancel from draft, submitted, or approved (but not posted).
  const [row] = await db
    .select()
    .from(purchaseReturns)
    .where(
      and(eq(purchaseReturns.tenantId, ctx.tenantId), eq(purchaseReturns.id, parsed.data.returnId)),
    )
    .limit(1);
  if (!row) return err(AppError.notFound('purchasing.errors.return_not_found'));

  if (row.status === 'posted' || row.status === 'cancelled') {
    return err(
      AppError.businessRule('purchasing.errors.return_already_terminal', {
        currentStatus: row.status,
      }),
    );
  }
  return transitionStatus(
    parsed.data.returnId,
    row.status,
    'cancelled',
    ctx,
    'purchasing.return.create',
    {
      cancelledBy: ctx.userId,
      cancelledAt: new Date(),
    },
  );
}

// ─── Post (creates JE + decrements stock) ─────────────────────────────────

export async function postPurchaseReturn(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string; journalEntryId: string | null }>> {
  const parsed = PurchaseReturnIdInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input'));
  }

  const [row] = await db
    .select()
    .from(purchaseReturns)
    .where(
      and(eq(purchaseReturns.tenantId, ctx.tenantId), eq(purchaseReturns.id, parsed.data.returnId)),
    )
    .limit(1);
  if (!row) return err(AppError.notFound('purchasing.errors.return_not_found'));

  const permCheck = await requirePermission(ctx.userId, 'purchasing.return.post', {
    locationId: row.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (row.status !== 'approved') {
    return err(
      AppError.businessRule('purchasing.errors.return_must_be_approved', {
        currentStatus: row.status,
      }),
    );
  }

  // Period guard mirrors GRN.confirm.
  const periodCode = row.returnDate.substring(0, 7);
  const [period] = await db
    .select()
    .from(accountingPeriods)
    .where(
      and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodCode)),
    )
    .limit(1);
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

  // Claim the return.
  const claimed = await db
    .update(purchaseReturns)
    .set({
      status: 'posted',
      postedBy: ctx.userId,
      postedAt: new Date(),
      updatedBy: ctx.userId,
      version: row.version + 1,
    })
    .where(
      and(
        eq(purchaseReturns.id, row.id),
        eq(purchaseReturns.version, row.version),
        eq(purchaseReturns.status, 'approved'),
      ),
    )
    .returning({ id: purchaseReturns.id });
  if (!claimed || claimed.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  const lines = await db
    .select()
    .from(purchaseReturnLines)
    .where(eq(purchaseReturnLines.returnId, row.id))
    .orderBy(purchaseReturnLines.lineNo);

  // JE: DR GRNI / CR Inventory / CR Tax (reverse of the original GRN posting).
  let journalEntryId: string | null = null;
  if (row.grandTotal > 0n && lines.length > 0) {
    const returnCodes = await getPostingAccountCodes(ctx.tenantId);
    const grniAccountId = await resolveAccountId(ctx.tenantId, returnCodes['purchasing.grni']);
    if (!grniAccountId) {
      // Roll back so we don't leave a posted row without a JE.
      await db
        .update(purchaseReturns)
        .set({ status: 'approved', postedBy: null, postedAt: null, version: row.version })
        .where(eq(purchaseReturns.id, row.id));
      return err(AppError.businessRule('purchasing.errors.grni_account_not_found'));
    }

    // Pre-fetch tax rates for posting accounts
    const allTaxRates = await db.select().from(taxRates).where(eq(taxRates.isActive, true));
    const taxRateMap = new Map(allTaxRates.map((tr) => [tr.code, tr.postingAccountId]));

    const inventoryValueByAccount = new Map<string, bigint>();
    const taxValueByAccount = new Map<string, bigint>();

    for (const line of lines) {
      // Inventory (Subtotal)
      if (line.lineSubtotal > 0n) {
        const invAccountId = await resolveInventoryAccountForProduct(ctx.tenantId, line.productId);
        if (!invAccountId) {
          return err(AppError.businessRule('purchasing.errors.inventory_account_not_found'));
        }
        inventoryValueByAccount.set(
          invAccountId,
          (inventoryValueByAccount.get(invAccountId) ?? 0n) + line.lineSubtotal,
        );
      }

      // Tax
      if (line.lineTax > 0n && line.taxCode) {
        const taxAccountId = taxRateMap.get(line.taxCode);
        if (!taxAccountId) {
          return err(
            AppError.businessRule('purchasing.errors.tax_account_not_found', {
              code: line.taxCode,
            }),
          );
        }
        taxValueByAccount.set(
          taxAccountId,
          (taxValueByAccount.get(taxAccountId) ?? 0n) + line.lineTax,
        );
      }
    }

    const jeLines = [];

    // DR GRNI by Grand Total
    jeLines.push({
      accountId: grniAccountId,
      locationId: row.locationId,
      description: `Return ${row.number} GRNI`,
      debit: row.grandTotal.toString(),
      credit: '0',
      partnerId: row.supplierId,
    });

    // CR Inventory by Subtotal per Account
    for (const [accountId, amount] of inventoryValueByAccount.entries()) {
      if (amount > 0n) {
        jeLines.push({
          accountId,
          locationId: row.locationId,
          description: `Return ${row.number} inventory`,
          debit: '0',
          credit: amount.toString(),
          partnerId: row.supplierId,
        });
      }
    }

    // CR Tax per Account
    for (const [accountId, amount] of taxValueByAccount.entries()) {
      if (amount > 0n) {
        jeLines.push({
          accountId,
          locationId: row.locationId,
          description: `Return ${row.number} tax`,
          debit: '0',
          credit: amount.toString(),
          partnerId: row.supplierId,
        });
      }
    }

    const jeResult = await createJournal(
      {
        postingDate: row.returnDate,
        locationId: row.locationId,
        description: `Purchase return ${row.number} (supplier ${row.supplierId})`,
        referenceType: 'purchase',
        referenceId: row.id,
        lines: jeLines,
      },
      ctx,
      { skipPermissionCheck: true },
    );
    if (!jeResult.ok) {
      await db
        .update(purchaseReturns)
        .set({ status: 'approved', postedBy: null, postedAt: null, version: row.version })
        .where(eq(purchaseReturns.id, row.id));
      return jeResult;
    }
    journalEntryId = jeResult.value.id;
    await db.update(purchaseReturns).set({ journalEntryId }).where(eq(purchaseReturns.id, row.id));
  }

  // Stock movements + level decrement (variant-aware lookup).
  const movementValues = lines.map((line) => ({
    id: generateId(),
    tenantId: ctx.tenantId,
    locationId: row.locationId,
    occurredAt: new Date(),
    stockLocationId: null,
    productId: line.productId,
    variantId: line.variantId ?? null,
    batchNo: null,
    expiryDate: null,
    qtyDelta: `-${line.qtyReturned}`,
    uom: line.uom,
    reason: 'purchase_return' as const,
    referenceType: 'purchase_return' as const,
    referenceId: row.id,
    unitCost: line.unitCost,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  }));
  await db.insert(stockMovements).values(movementValues);

  for (const line of lines) {
    const variantCondition = line.variantId
      ? eq(stockLevels.variantId, line.variantId)
      : isNull(stockLevels.variantId);
    await db
      .update(stockLevels)
      .set({
        qtyOnHand: sql`${stockLevels.qtyOnHand} - ${line.qtyReturned}::numeric`,
        qtyAvailable: sql`${stockLevels.qtyAvailable} - ${line.qtyReturned}::numeric`,
        updatedBy: ctx.userId,
        lastMovementAt: new Date(),
      })
      .where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, row.locationId),
          eq(stockLevels.productId, line.productId),
          variantCondition,
        ),
      );
  }

  await auditRecord({
    action: 'approve',
    entityType: 'purchase_return',
    entityId: row.id,
    before: { status: 'approved' },
    after: {
      status: 'posted',
      journalEntryId,
      movementCount: movementValues.length,
      grandTotal: row.grandTotal.toString(),
    },
    ctx,
  });

  return ok({ id: row.id, status: 'posted', journalEntryId });
}

// ─── Read helpers ─────────────────────────────────────────────────────────

export async function listPurchaseReturns(
  filter: { locationId?: string; status?: string; limit?: number },
  ctx: AuditContext,
): Promise<Result<PurchaseReturnSummary[]>> {
  const permCheck = await requirePermission(ctx.userId, 'purchasing.view');
  if (!permCheck.ok) return permCheck;

  const conds = [eq(purchaseReturns.tenantId, ctx.tenantId)];
  if (filter.locationId) conds.push(eq(purchaseReturns.locationId, filter.locationId));
  if (filter.status) conds.push(eq(purchaseReturns.status, filter.status));
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);

  const rows = await db
    .select()
    .from(purchaseReturns)
    .where(and(...conds))
    .orderBy(desc(purchaseReturns.createdAt))
    .limit(limit);

  return ok(
    rows.map((r) => ({
      id: r.id,
      number: r.number,
      supplierId: r.supplierId,
      grnId: r.grnId,
      locationId: r.locationId,
      status: r.status,
      returnDate: r.returnDate,
      grandTotal: r.grandTotal.toString(),
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export async function getPurchaseReturn(
  returnId: string,
  ctx: AuditContext,
): Promise<Result<PurchaseReturnDetail>> {
  const permCheck = await requirePermission(ctx.userId, 'purchasing.view');
  if (!permCheck.ok) return permCheck;

  const [row] = await db
    .select()
    .from(purchaseReturns)
    .where(and(eq(purchaseReturns.tenantId, ctx.tenantId), eq(purchaseReturns.id, returnId)))
    .limit(1);
  if (!row) return err(AppError.notFound('purchasing.errors.return_not_found'));

  const lines = await db
    .select()
    .from(purchaseReturnLines)
    .where(eq(purchaseReturnLines.returnId, returnId))
    .orderBy(purchaseReturnLines.lineNo);

  return ok({
    id: row.id,
    number: row.number,
    supplierId: row.supplierId,
    grnId: row.grnId,
    locationId: row.locationId,
    status: row.status,
    returnDate: row.returnDate,
    reason: row.reason,
    notes: row.notes,
    subtotal: row.subtotal.toString(),
    taxTotal: row.taxTotal.toString(),
    grandTotal: row.grandTotal.toString(),
    journalEntryId: row.journalEntryId,
    createdAt: row.createdAt.toISOString(),
    lines: lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      grnLineId: l.grnLineId,
      productId: l.productId,
      variantId: l.variantId,
      qtyReturned: l.qtyReturned,
      uom: l.uom,
      unitCost: l.unitCost.toString(),
      lineSubtotal: l.lineSubtotal.toString(),
      lineTax: l.lineTax.toString(),
      lineTotal: l.lineTotal.toString(),
      taxCode: l.taxCode,
      notes: l.notes,
    })),
  });
}
