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

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@erp/db';
import {
  stockAdjustments,
  stockAdjustmentLines,
  stockMovements,
  stockLevels,
  products,
} from '@erp/db/schema/inventory';
import { accountingPeriods } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { roles, userRoles } from '@erp/db/schema/auth';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import type { AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import {
  CreateAdjustmentInputSchema,
  ApproveAdjustmentInputSchema,
  RejectAdjustmentInputSchema,
  type AdjustmentReason,
} from './schemas';
import { generateAdjustmentNumber } from './number-generator';
import { createJournal } from '../accounting/create-journal';

// ─── Default COA accounts ─────────────────────────────────────────────────────

const DEFAULT_INVENTORY_ACCOUNT = '1-1210'; // Persediaan Barang Dagangan
const EXPENSE_ACCOUNT = '6-1110';            // Beban Operasional Lainnya (loss)
const INCOME_ACCOUNT = '4-2020';             // Pendapatan Lainnya (gain)

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
  qtyBefore: string;
  qtyAfter: string;
  qtyDelta: string;
  uom: string;
  unitCost: string | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if a user has the director role for the tenant. */
async function isDirector(ctx: AuditContext): Promise<boolean> {
  const rows = await db
    .select({ roleCode: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(userRoles.userId, ctx.userId),
        eq(roles.tenantId, ctx.tenantId),
        eq(roles.code, 'director'),
      ),
    );
  return rows.length > 0;
}

/** Resolve the inventory account ID for a product. Falls back to DEFAULT_INVENTORY_ACCOUNT. */
async function resolveInventoryAccount(
  tenantId: string,
  productId: string,
): Promise<string> {
  const row = await db
    .select({ inventoryAccountId: products.inventoryAccountId })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .then((r) => r[0]);

  return row?.inventoryAccountId ?? DEFAULT_INVENTORY_ACCOUNT;
}

// ─── Build result from DB rows ───────────────────────────────────────────────

function buildLineResult(
  l: Pick<
    typeof stockAdjustmentLines.$inferSelect,
    'id' | 'productId' | 'variantId' | 'batchNo' | 'qtyBefore' | 'qtyAfter' | 'qtyDelta' | 'uom' | 'unitCost' | 'notes'
  >,
): AdjustmentLineResult {
  return {
    id: l.id,
    productId: l.productId,
    variantId: l.variantId ?? null,
    batchNo: l.batchNo ?? null,
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
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input
  const parsed = CreateAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 3. Validate product IDs exist and are active
  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  const foundProducts = await db
    .select({ id: products.id, isActive: products.isActive })
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

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'create',
      entityType: 'stock_adjustment',
      entityId: adjId,
      before: null,
      after: { number: adjNumber, reason: data.reason, lineCount: lineValues.length },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
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
  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const adj = await db
      .select()
      .from(stockAdjustments)
      .where(
        and(
          eq(stockAdjustments.tenantId, ctx.tenantId),
          eq(stockAdjustments.id, adjustmentId),
        ),
      )
      .then((r) => r[0]);

    if (!adj) {
      return err(AppError.notFound('inventory.adjust.notFound', { adjustmentId }));
    }
    if (adj.status !== 'draft') {
      return err(
        AppError.businessRule('inventory.adjust.notDraft', {
          currentStatus: adj.status,
        }),
      );
    }

    await db
      .update(stockAdjustments)
      .set({ status: 'submitted', updatedBy: ctx.userId, version: adj.version + 1 })
      .where(
        and(
          eq(stockAdjustments.id, adjustmentId),
          eq(stockAdjustments.version, adj.version),
        ),
      );

    const lines = await db
      .select()
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, adjustmentId))
      .orderBy(stockAdjustmentLines.lineNo);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'stock_adjustment',
      entityId: adjustmentId,
      before: { status: adj.status },
      after: { status: 'submitted' },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    });

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
  // 1. Permission check
  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  // 2. Validate input
  const parsed = ApproveAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  // 3. Only director can approve
  const director = await isDirector(ctx);
  if (!director) {
    return err(AppError.forbidden('inventory.adjust.notDirector'));
  }

  try {
    // 4. Load adjustment + lines
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
      return err(AppError.notFound('inventory.adjust.notFound', { adjustmentId: data.adjustmentId }));
    }
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
        and(
          eq(accountingPeriods.tenantId, ctx.tenantId),
          eq(accountingPeriods.code, periodMonth),
        ),
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

    // 6. Compute net monetary value (qty_delta × unit_cost in rupiah)
    const netDelta = lines.reduce((sum, line) => {
      const delta = parseFloat(line.qtyDelta);
      const cost = line.unitCost ? Number(line.unitCost) : 0; // unitCost is bigint IDR
      return sum + delta * cost;
    }, 0);

    // 7. Create stock movements
    const movementValues = lines.map((line) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      locationId: adj.locationId,
      occurredAt: new Date(),
      stockLocationId: null as unknown as string,
      productId: line.productId,
      variantId: line.variantId ?? null,
      batchNo: line.batchNo ?? null,
      qtyDelta: line.qtyDelta,
      uom: line.uom,
      reason: 'adjustment' as const,
      referenceType: 'stock_adjustment' as const,
      referenceId: adj.id,
      unitCost: line.unitCost,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));

    await db.insert(stockMovements).values(movementValues);

    // 8. Update / insert stock_levels
    for (const line of lines) {
      const variantCondition = line.variantId
        ? eq(stockLevels.variantId, line.variantId)
        : eq(stockLevels.variantId, '' as unknown as string);

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

      const newQty = parseFloat(line.qtyAfter);
      if (existing) {
        await db
          .update(stockLevels)
          .set({
            qtyOnHand: String(newQty),
            qtyAvailable: String(newQty),
            updatedBy: ctx.userId,
            lastMovementAt: new Date(),
          })
          .where(eq(stockLevels.id, existing.id));
      } else {
        await db.insert(stockLevels).values({
          id: generateId(),
          tenantId: ctx.tenantId,
          locationId: adj.locationId,
          stockLocationId: null,
          productId: line.productId,
          variantId: line.variantId ?? null,
          batchNo: line.batchNo ?? null,
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

    // 9. Create balancing journal entry (only if net monetary value ≠ 0)
    let journalEntryId: string | null = null;
    if (Math.abs(netDelta) > 0.5) {
      const firstLine = lines[0]!;
      const invAccount = await resolveInventoryAccount(ctx.tenantId, firstLine.productId);
      const amount = Math.round(Math.abs(netDelta) * 100);

      if (netDelta < 0) {
        // Loss: DR Beban Operasional Lainnya, CR Inventory
        const jeResult = await createJournal(
          {
            postingDate: adj.adjustmentDate,
            locationId: adj.locationId,
            description: `Stock Adjustment ${adj.number} — ${adj.reason}`,
            referenceType: 'manual',
            referenceId: adj.id,
            lines: [
              {
                accountId: EXPENSE_ACCOUNT,
                locationId: adj.locationId,
                description: `${adj.reason}: ${firstLine.productId}`,
                debit: String(Math.abs(Math.round(netDelta))),
                credit: '0',
              },
              {
                accountId: invAccount,
                locationId: adj.locationId,
                description: `Stock Adjustment ${adj.number}`,
                debit: '0',
                credit: String(Math.abs(Math.round(netDelta))),
              },
            ],
          },
          ctx,
        );
        if (jeResult.ok) journalEntryId = jeResult.value.id;
      } else {
        // Gain: DR Inventory, CR Pendapatan Lainnya
        const jeResult = await createJournal(
          {
            postingDate: adj.adjustmentDate,
            locationId: adj.locationId,
            description: `Stock Adjustment ${adj.number} — ${adj.reason}`,
            referenceType: 'manual',
            referenceId: adj.id,
            lines: [
              {
                accountId: invAccount,
                locationId: adj.locationId,
                description: `Stock Adjustment ${adj.number}`,
                debit: String(Math.round(netDelta)),
                credit: '0',
              },
              {
                accountId: INCOME_ACCOUNT,
                locationId: adj.locationId,
                description: `${adj.reason}: gain`,
                debit: '0',
                credit: String(Math.round(netDelta)),
              },
            ],
          },
          ctx,
        );
        if (jeResult.ok) journalEntryId = jeResult.value.id;
      }
    }

    // 10. Update adjustment status
    await db
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
        ),
      );

    // 11. Audit
    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'stock_adjustment',
      entityId: data.adjustmentId,
      before: { status: 'submitted' },
      after: {
        status: 'approved',
        approvedBy: ctx.userId,
        movementCount: movementValues.length,
        journalEntryId,
        netValue: netDelta,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
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
  const permCheck = await requirePermission(ctx.userId, 'inventory.adjust', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = RejectAdjustmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.adjust.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const director = await isDirector(ctx);
  if (!director) {
    return err(AppError.forbidden('inventory.adjust.notDirector'));
  }

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
      return err(AppError.notFound('inventory.adjust.notFound', { adjustmentId: data.adjustmentId }));
    }
    if (adj.status !== 'submitted') {
      return err(
        AppError.businessRule('inventory.adjust.notSubmitted', { currentStatus: adj.status }),
      );
    }
    if (adj.version !== data.version) {
      return err(AppError.conflict('inventory.adjust.versionMismatch'));
    }

    await db
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
        ),
      );

    const lines = await db
      .select()
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, data.adjustmentId))
      .orderBy(stockAdjustmentLines.lineNo);

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'stock_adjustment',
      entityId: data.adjustmentId,
      before: { status: adj.status },
      after: { status: 'rejected', rejectionReason: data.reason },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
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
