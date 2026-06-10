/**
 * inventory.adjust — SD §9.3, §21.5
 *
 * Stock adjustment workflow:
 *   draft → submitted → approved (executed) | rejected
 *
 * Execution on approval:
 * - Creates stock_movement records for each line
 * - Updates stock_levels qty_on_hand / qty_available
 * - Creates a balancing journal entry (adjustment account ↔ inventory account)
 *
 * Business rules:
 * - Only user with 'director' role can approve (SD §21.5)
 * - Products must be active and inventory-tracked
 * - Accounting period for adjustment date must be open
 * - JE uses product's inventoryAccountId (falls back to 1-1210) on the
 *   inventory side, and 6-1110 (loss) or 4-2020 (gain) on the other side
 *
 * Permission: inventory.adjust (create + submit)
 *             inventory.adjust.approve (approve + execute)
 */

import { db } from '@erp/db';
import { accountingPeriods } from '@erp/db/schema/accounting';
import {
  products,
  stockAdjustmentLines,
  stockAdjustments,
  stockLevels,
  stockMovements,
} from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { resolveAccountIdsByCodes } from '../accounting/account-resolver';
import { createJournal } from '../accounting/create-journal';
import { getPostingAccountCodes } from '../accounting/posting-accounts';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { generateAdjustmentNumber } from '../shared/number-generator';
import {
  type AdjustmentReason,
  ApproveAdjustmentInputSchema,
  CreateAdjustmentInputSchema,
  RejectAdjustmentInputSchema,
} from './schemas';

// Posting accounts (inventory + loss/gain offsets) come from the configurable
// account map (Settings → Accounting → Account Mapping); see
// accounting/posting-accounts.ts. A product may further override its own
// inventory account via products.inventoryAccountId.

// ─── Return types ─────────────────────────────────────────────────────────────

export interface AdjustmentResult {
  id: string;
  number: string;
  adjustmentDate: string;
  reason: AdjustmentReason;
  notes: string | null;
  status: string;
  lines: AdjustmentLineResult[];
  journalEntryId: string | null;
}

export interface AdjustmentLineResult {
  id: string;
  productId: string;
  variantId: string | null;
  batchNo: string | null;
  expiryDate: string | null;
  qtyBefore: string;
  qtyAfter: string;
  qtyDelta: string;
  uom: string;
  unitCost: string | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the inventory account UUID for a product. Falls back to the
 * tenant's `1-1210` (Persediaan Barang Dagangan) account.
 *
 * Returns null when neither the product-level account nor the default
 * code can be resolved (callers should treat that as a configuration
 * error, not silently swallow it).
 */
async function resolveInventoryAccount(
  tenantId: string,
  productId: string,
  fallbackCode: string,
): Promise<string | null> {
  const row = await db
    .select({ inventoryAccountId: products.inventoryAccountId })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .then((r) => r[0]);

  if (row?.inventoryAccountId) return row.inventoryAccountId;

  const map = await resolveAccountIdsByCodes(tenantId, [fallbackCode]);
  return map.get(fallbackCode) ?? null;
}

// ─── Build result from DB rows ───────────────────────────────────────────────

function buildLineResult(
  l: Pick<
    typeof stockAdjustmentLines.$inferSelect,
    | 'id'
    | 'productId'
    | 'variantId'
    | 'batchNo'
    | 'expiryDate'
    | 'qtyBefore'
    | 'qtyAfter'
    | 'qtyDelta'
    | 'uom'
    | 'unitCost'
    | 'notes'
  >,
): AdjustmentLineResult {
  return {
    id: l.id,
    productId: l.productId,
    variantId: l.variantId ?? null,
    batchNo: l.batchNo ?? null,
    expiryDate: l.expiryDate ?? null,
    qtyBefore: l.qtyBefore,
    qtyAfter: l.qtyAfter,
    qtyDelta: l.qtyDelta,
    uom: l.uom,
    unitCost: l.unitCost ? l.unitCost.toString() : null,
    notes: l.notes,
  };
}

// ─── Create Draft ─────────────────────────────────────────────────────────────

/**
 * Create a new stock adjustment in 'draft' status.
 * Caller must have `inventory.adjust` permission.
 */
export async function createAdjustmentDraft(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<AdjustmentResult>> {
  // 1. Validate input
  const parsed = CreateAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 2. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 3. Validate product IDs exist and are active
  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  const foundProducts = await db
    .select({
      id: products.id,
      isActive: products.isActive,
      trackBatch: products.trackBatch,
      trackExpiry: products.trackExpiry,
    })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, productIds)));
  const productMap = new Map(foundProducts.map((p) => [p.id, p]));

  for (const line of data.lines) {
    const p = productMap.get(line.productId);
    if (!p) {
      return err(
        AppError.notFound('inventory.adjust.productNotFound', {
          productId: line.productId,
        }),
      );
    }
    if (!p.isActive) {
      return err(
        AppError.businessRule('inventory.adjust.productInactive', {
          productId: line.productId,
        }),
      );
    }
    if (p.trackBatch && !line.batchNo) {
      return err(
        AppError.validation('inventory.adjust.missingBatchNo', {
          productId: line.productId,
        }),
      );
    }
    if (p.trackExpiry && !line.expiryDate) {
      return err(
        AppError.validation('inventory.adjust.missingExpiryDate', {
          productId: line.productId,
        }),
      );
    }
  }

  const adjId = generateId();
  const adjNumber = await generateAdjustmentNumber(ctx.tenantId, data.adjustmentDate);

  try {
    await db.insert(stockAdjustments).values({
      id: adjId,
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      number: adjNumber,
      adjustmentDate: data.adjustmentDate,
      reason: data.reason,
      notes: data.notes ?? null,
      status: 'draft',
      version: 1,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    const lineValues = data.lines.map((line, idx) => ({
      id: generateId(),
      adjustmentId: adjId,
      lineNo: idx + 1,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      qtyBefore: line.qtyBefore,
      qtyAfter: line.qtyAfter,
      qtyDelta: line.qtyDelta,
      uom: line.uom,
      unitCost: line.unitCost ? BigInt(line.unitCost) : null,
      notes: line.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    await db.insert(stockAdjustmentLines).values(lineValues);

    await auditRecord({
      action: 'create',
      entityType: 'stock_adjustment',
      entityId: adjId,
      before: null,
      after: { number: adjNumber, reason: data.reason, lineCount: lineValues.length },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({
      id: adjId,
      number: adjNumber,
      adjustmentDate: data.adjustmentDate,
      reason: data.reason,
      notes: data.notes ?? null,
      status: 'draft',
      lines: lineValues.map(buildLineResult),
      journalEntryId: null,
    });
  } catch (e) {
    return err(AppError.internal('inventory.adjust.createFailed', e));
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────

/**
 * Submit a draft adjustment for approval.
 * Transitions: draft → submitted.
 */
export async function submitAdjustment(
  adjustmentId: string,
  ctx: AuditContext,
): Promise<Result<AdjustmentResult>> {
  try {
    const adj = await db
      .select()
      .from(stockAdjustments)
      .where(
        and(eq(stockAdjustments.tenantId, ctx.tenantId), eq(stockAdjustments.id, adjustmentId)),
      )
      .then((r) => r[0]);

    if (!adj) {
      return err(AppError.notFound('inventory.adjust.notFound', { adjustmentId }));
    }

    const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
      locationId: adj.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (adj.status !== 'draft') {
      return err(
        AppError.businessRule('inventory.adjust.notDraft', {
          currentStatus: adj.status,
        }),
      );
    }

    const claimed = await db
      .update(stockAdjustments)
      .set({ status: 'submitted', updatedBy: ctx.userId, version: adj.version + 1 })
      .where(
        and(
          eq(stockAdjustments.id, adjustmentId),
          eq(stockAdjustments.version, adj.version),
          eq(stockAdjustments.status, 'draft'),
        ),
      )
      .returning({ id: stockAdjustments.id });
    if (!claimed || claimed.length === 0) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    const lines = await db
      .select()
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, adjustmentId))
      .orderBy(stockAdjustmentLines.lineNo);

    await auditRecord({
      action: 'submit',
      entityType: 'stock_adjustment',
      entityId: adjustmentId,
      before: { status: adj.status },
      after: { status: 'submitted' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    // Notify approvers (inventory.adjust.approve holders).
    const { notifyByPermission } = await import('../notification');
    notifyByPermission({
      tenantId: ctx.tenantId,
      kind: 'stock_adjustment',
      title: 'Penyesuaian stok menunggu persetujuan',
      body: `No. ${adj.number}`,
      link: '/inventory/adjust',
      permission: 'inventory.adjust.approve',
    }).catch(() => {});

    return ok({
      id: adj.id,
      number: adj.number,
      adjustmentDate: adj.adjustmentDate,
      reason: adj.reason as AdjustmentReason,
      notes: adj.notes,
      status: 'submitted',
      lines: lines.map(buildLineResult),
      journalEntryId: null,
    });
  } catch (e) {
    return err(AppError.internal('inventory.adjust.submitFailed', e));
  }
}

// ─── Approve + Execute ────────────────────────────────────────────────────────

/**
 * Approve a submitted adjustment and execute it atomically.
 * Transitions: submitted → approved.
 *
 * Execution:
 * 1. Creates stock_movement records for each line
 * 2. Updates stock_levels qty_on_hand / qty_available
 * 3. Creates a balancing journal entry (adjustment account ↔ inventory account)
 *
 * Only a user with the 'director' role can approve.
 */
export async function approveAdjustment(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<AdjustmentResult>> {
  // 1. Validate input
  const parsed = ApproveAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    // 3. Load adjustment + lines
    const adj = await db
      .select()
      .from(stockAdjustments)
      .where(
        and(
          eq(stockAdjustments.tenantId, ctx.tenantId),
          eq(stockAdjustments.id, data.adjustmentId),
        ),
      )
      .then((r) => r[0]);

    if (!adj) {
      return err(
        AppError.notFound('inventory.adjust.notFound', { adjustmentId: data.adjustmentId }),
      );
    }

    // 4. Permission check — scoped to the adjustment's location so an
    //    approver at outlet A can't approve outlet B's adjustment.
    const permCheck = await requirePermission(ctx.userId, 'inventory.adjust.approve', {
      locationId: adj.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (adj.status !== 'submitted') {
      return err(
        AppError.businessRule('inventory.adjust.notSubmitted', { currentStatus: adj.status }),
      );
    }
    if (adj.version !== data.version) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    const lines = await db
      .select()
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, data.adjustmentId))
      .orderBy(stockAdjustmentLines.lineNo);

    if (lines.length === 0) {
      return err(AppError.businessRule('inventory.adjust.noLines'));
    }

    // 5. Verify accounting period is open
    const periodMonth = adj.adjustmentDate.substring(0, 7);
    const period = await db
      .select()
      .from(accountingPeriods)
      .where(
        and(eq(accountingPeriods.tenantId, ctx.tenantId), eq(accountingPeriods.code, periodMonth)),
      )
      .then((r) => r[0]);

    if (!period) {
      return err(
        AppError.businessRule('accounting.journal.periodNotFound', { periodCode: periodMonth }),
      );
    }
    if (period.status !== 'open') {
      return err(
        AppError.businessRule('accounting.journal.periodClosed', {
          periodCode: periodMonth,
          periodStatus: period.status,
        }),
      );
    }

    // 6. CLAIM the adjustment first via atomic optimistic UPDATE. Without
    //    this, two concurrent approvers would each execute stock movements
    //    + level updates (doubling inventory deltas) before either status
    //    transition is rejected.
    const claimed = await db
      .update(stockAdjustments)
      .set({
        status: 'approved',
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        updatedBy: ctx.userId,
        version: adj.version + 1,
      })
      .where(
        and(
          eq(stockAdjustments.id, data.adjustmentId),
          eq(stockAdjustments.version, adj.version),
          eq(stockAdjustments.status, 'submitted'),
        ),
      )
      .returning({ id: stockAdjustments.id });

    if (!claimed || claimed.length === 0) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    // 7. Compute net monetary value (qty_delta × unit_cost in rupiah).
    //    qtyDelta is a decimal string; unitCost is bigint rupiah. Use a
    //    string→bigint pipeline to preserve precision (avoids JS float
    //    artefacts for large outlets / high-cost items).
    let netDelta = 0n;
    for (const line of lines) {
      if (!line.unitCost) continue;
      // qtyDelta supports up to 3 decimal places → scale by 1000.
      const scaled = BigInt(Math.round(Number.parseFloat(line.qtyDelta) * 1000));
      netDelta += (scaled * line.unitCost) / 1000n;
    }

    // 8. Post the balancing journal FIRST. If the journal rejects
    //    (period race-closed since step 5, accounts inactive, etc.),
    //    we abort BEFORE touching inventory — keeping stock and GL in
    //    sync. The status was claimed in step 6, so on JE failure we
    //    roll the status back to 'submitted'.
    let journalEntryId: string | null = null;
    if (netDelta !== 0n) {
      const firstLine = lines[0]!;
      const acctCodes = await getPostingAccountCodes(ctx.tenantId);
      const invAccount = await resolveInventoryAccount(
        ctx.tenantId,
        firstLine.productId,
        acctCodes.inventory,
      );
      if (!invAccount) {
        // Roll the status claim back so the adjustment can be retried
        // after the operator wires up the inventory account.
        await db
          .update(stockAdjustments)
          .set({ status: 'submitted', approvedBy: null, approvedAt: null, version: adj.version })
          .where(eq(stockAdjustments.id, data.adjustmentId));
        return err(
          AppError.businessRule('inventory.adjust.inventoryAccountMissing', {
            code: acctCodes.inventory,
          }),
        );
      }

      // Resolve the offsetting code (loss/gain) to its UUID. Without this
      // the caller would pass a bare code to createJournal which expects
      // accounts.id (UUID) → `accountNotFound`.
      const offsetCode =
        netDelta < 0n ? acctCodes['adjustment.expense'] : acctCodes['adjustment.income'];
      const codeMap = await resolveAccountIdsByCodes(ctx.tenantId, [offsetCode]);
      const offsetAccountId = codeMap.get(offsetCode);
      if (!offsetAccountId) {
        await db
          .update(stockAdjustments)
          .set({ status: 'submitted', approvedBy: null, approvedAt: null, version: adj.version })
          .where(eq(stockAdjustments.id, data.adjustmentId));
        return err(
          AppError.businessRule('inventory.adjust.offsetAccountMissing', { code: offsetCode }),
        );
      }

      const absAmount = (netDelta < 0n ? -netDelta : netDelta).toString();

      const journalLines =
        netDelta < 0n
          ? [
              {
                accountId: offsetAccountId,
                locationId: adj.locationId,
                description: `${adj.reason}: ${firstLine.productId}`,
                debit: absAmount,
                credit: '0',
              },
              {
                accountId: invAccount,
                locationId: adj.locationId,
                description: `Stock Adjustment ${adj.number}`,
                debit: '0',
                credit: absAmount,
              },
            ]
          : [
              {
                accountId: invAccount,
                locationId: adj.locationId,
                description: `Stock Adjustment ${adj.number}`,
                debit: absAmount,
                credit: '0',
              },
              {
                accountId: offsetAccountId,
                locationId: adj.locationId,
                description: `${adj.reason}: gain`,
                debit: '0',
                credit: absAmount,
              },
            ];

      const jeResult = await createJournal(
        {
          postingDate: adj.adjustmentDate,
          locationId: adj.locationId,
          description: `Stock Adjustment ${adj.number} — ${adj.reason}`,
          referenceType: 'manual',
          referenceId: adj.id,
          lines: journalLines,
        },
        ctx,
        { skipPermissionCheck: true },
      );
      if (!jeResult.ok) {
        // Roll the status claim back so the adjustment can be retried.
        await db
          .update(stockAdjustments)
          .set({ status: 'submitted', approvedBy: null, approvedAt: null, version: adj.version })
          .where(eq(stockAdjustments.id, data.adjustmentId));
        return jeResult;
      }
      journalEntryId = jeResult.value.id;
    }

    // 9. Insert stock movements (qty deltas — historical record).
    const movementValues = lines.map((line) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: adj.locationId,
      occurredAt: new Date(),
      stockLocationId: null as unknown as string,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      qtyDelta: line.qtyDelta,
      uom: line.uom,
      reason: 'adjustment' as const,
      referenceType: 'stock_adjustment' as const,
      referenceId: adj.id,
      unitCost: line.unitCost,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    // 9b. Execute stock movements insert.
    await db.insert(stockMovements).values(movementValues);

    // 10. Update / insert stock_levels. Pass the qtyAfter string directly
    //     to preserve the original decimal precision.
    for (const line of lines) {
      const variantCondition = line.variantId
        ? eq(stockLevels.variantId, line.variantId)
        : isNull(stockLevels.variantId);

      const existing = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.tenantId, ctx.tenantId),
            eq(stockLevels.locationId, adj.locationId),
            eq(stockLevels.productId, line.productId),
            variantCondition,
          ),
        )
        .then((r) => r[0]);

      if (existing) {
        await db
          .update(stockLevels)
          .set({
            qtyOnHand: line.qtyAfter,
            qtyAvailable: line.qtyAfter,
            updatedBy: ctx.userId,
            lastMovementAt: new Date(),
          })
          .where(eq(stockLevels.id, existing.id));
      } else {
        await db.insert(stockLevels).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          locationId: adj.locationId,
          stockLocationId: null as unknown as string,
          productId: line.productId,
          variantId: line.variantId ?? null,
          batchNo: line.batchNo ?? null,
          expiryDate: line.expiryDate ?? null,
          qtyOnHand: line.qtyAfter,
          qtyReserved: '0',
          qtyAvailable: line.qtyAfter,
          uom: line.uom,
          avgUnitCost: line.unitCost,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }
    }

    // 11. Audit
    await auditRecord({
      action: 'approve',
      entityType: 'stock_adjustment',
      entityId: data.adjustmentId,
      before: { status: 'submitted' },
      after: {
        status: 'approved',
        approvedBy: ctx.userId,
        movementCount: movementValues.length,
        journalEntryId,
        netValue: netDelta.toString(),
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({
      id: adj.id,
      number: adj.number,
      adjustmentDate: adj.adjustmentDate,
      reason: adj.reason as AdjustmentReason,
      notes: adj.notes,
      status: 'approved',
      lines: lines.map(buildLineResult),
      journalEntryId,
    });
  } catch (e) {
    return err(AppError.internal('inventory.adjust.approveFailed', e));
  }
}

// ─── Reject ──────────────────────────────────────────────────────────────────

/**
 * Reject a submitted adjustment.
 * Transitions: submitted → rejected.
 * Only a user with the 'director' role can reject.
 */
export async function rejectAdjustment(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<AdjustmentResult>> {
  const parsed = RejectAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  try {
    const adj = await db
      .select()
      .from(stockAdjustments)
      .where(
        and(
          eq(stockAdjustments.tenantId, ctx.tenantId),
          eq(stockAdjustments.id, data.adjustmentId),
        ),
      )
      .then((r) => r[0]);

    if (!adj) {
      return err(
        AppError.notFound('inventory.adjust.notFound', { adjustmentId: data.adjustmentId }),
      );
    }

    const permCheck = await requirePermission(ctx.userId, 'inventory.adjust.approve', {
      locationId: adj.locationId,
    });
    if (!permCheck.ok) return permCheck;

    if (adj.status !== 'submitted') {
      return err(
        AppError.businessRule('inventory.adjust.notSubmitted', { currentStatus: adj.status }),
      );
    }
    if (adj.version !== data.version) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    const claimed = await db
      .update(stockAdjustments)
      .set({
        status: 'rejected',
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        updatedBy: ctx.userId,
        notes: data.reason,
        version: adj.version + 1,
      })
      .where(
        and(
          eq(stockAdjustments.id, data.adjustmentId),
          eq(stockAdjustments.version, adj.version),
          eq(stockAdjustments.status, 'submitted'),
        ),
      )
      .returning({ id: stockAdjustments.id });
    if (!claimed || claimed.length === 0) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    const lines = await db
      .select()
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, data.adjustmentId))
      .orderBy(stockAdjustmentLines.lineNo);

    await auditRecord({
      action: 'reject',
      entityType: 'stock_adjustment',
      entityId: data.adjustmentId,
      before: { status: adj.status },
      after: { status: 'rejected', rejectionReason: data.reason },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({
      id: adj.id,
      number: adj.number,
      adjustmentDate: adj.adjustmentDate,
      reason: adj.reason as AdjustmentReason,
      notes: data.reason,
      status: 'rejected',
      lines: lines.map(buildLineResult),
      journalEntryId: null,
    });
  } catch (e) {
    return err(AppError.internal('inventory.adjust.rejectFailed', e));
  }
}
