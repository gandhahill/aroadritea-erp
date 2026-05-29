/**
 * purchasing/workflow.ts — PO state transitions (SD §21.6)
 *
 * submitPO:  draft → submitted
 * approvePO: submitted → approved (creates AP journal entry)
 * cancelPO:  any non-closed → cancelled
 */

import { db } from '@erp/db';
import { accountingPeriods, accounts, partners } from '@erp/db/schema/accounting';
import { cmsSettings } from '@erp/db/schema/cms';
import { products } from '@erp/db/schema/inventory';
import { purchaseOrderLines, purchaseOrders } from '@erp/db/schema/purchasing';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { createJournal } from '../accounting/create-journal';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { ApprovePOInputSchema, CancelPOInputSchema, SubmitPOInputSchema } from './schemas';

// ─── Constants ───────────────────────────────────────────────────────────────

const AP_ACCOUNT_CODE = '2-1100'; // Utang Usaha
const DEFAULT_INVENTORY_ACCOUNT_CODE = '1-1210'; // Persediaan Barang Dagangan
const AP_SETTING_KEY = 'accounting.payables.accountIds';

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
): Promise<string | null> {
  const [row] = await db
    .select({ inventoryAccountId: products.inventoryAccountId })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);

  if (row?.inventoryAccountId) return row.inventoryAccountId;

  const fallback = await resolveAccountId(tenantId, DEFAULT_INVENTORY_ACCOUNT_CODE);
  return fallback;
}

async function resolvePayablesAccountId(tenantId: string): Promise<string | null> {
  const [setting] = await db
    .select({ value: cmsSettings.value })
    .from(cmsSettings)
    .where(and(eq(cmsSettings.tenantId, tenantId), eq(cmsSettings.key, AP_SETTING_KEY)))
    .limit(1);

  const configuredIds = Array.isArray(setting?.value)
    ? setting.value.filter((value): value is string => typeof value === 'string')
    : [];

  if (configuredIds.length > 0) {
    const rows = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.tenantId, tenantId),
          eq(accounts.isActive, true),
          eq(accounts.isPostable, true),
          isNull(accounts.deletedAt),
          inArray(accounts.id, configuredIds),
        ),
      )
      .limit(1);
    if (rows[0]?.id) return rows[0].id;
  }

  return resolveAccountId(tenantId, AP_ACCOUNT_CODE);
}

// ─── Result types ───────────────────────────────────────────────────────────

export interface POWorkflowResult {
  id: string;
  number: string;
  status: string;
  journalEntryId?: string | null;
}

// ─── Submit PO ──────────────────────────────────────────────────────────────

export async function submitPO(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<POWorkflowResult>> {
  const parsed = SubmitPOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, parsed.data.poId)))
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  // Permission scoped to the PO's own location, not the caller's.
  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: po.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (po.status !== 'draft') {
    return err(
      AppError.businessRule('purchasing.errors.not_draft', {
        currentStatus: po.status,
      }),
    );
  }

  const claimed = await db
    .update(purchaseOrders)
    .set({
      status: 'submitted',
      submittedBy: ctx.userId,
      submittedAt: new Date(),
      updatedBy: ctx.userId,
      version: po.version + 1,
    })
    .where(
      and(
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.version, po.version),
        eq(purchaseOrders.status, 'draft'),
      ),
    )
    .returning({ id: purchaseOrders.id });
  if (!claimed || claimed.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  await auditRecord({
    action: 'submit',
    entityType: 'purchase_order',
    entityId: po.id,
    before: { status: 'draft' },
    after: { status: 'submitted', submittedBy: ctx.userId },
    ctx,
  });

  return ok({
    id: po.id,
    number: po.number,
    status: 'submitted',
  });
}

// ─── Approve PO ─────────────────────────────────────────────────────────────

export async function approvePO(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<POWorkflowResult>> {
  const parsed = ApprovePOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, parsed.data.poId)))
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  const HIGH_VALUE_THRESHOLD = 5000000n; // 5,000,000
  const isHighValue = po.grandTotal > HIGH_VALUE_THRESHOLD;
  const requiredPerm = isHighValue ? 'purchasing.po.approve_high_value' : 'purchasing.po.approve';

  // Permission scoped to the PO's own location so a director currently
  // checked in at outlet B cannot approve outlet A's PO unless they
  // have approve permission on A.
  const permCheck = await requirePermission(ctx.userId, requiredPerm as any, {
    locationId: po.locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (po.status !== 'submitted') {
    return err(
      AppError.businessRule('purchasing.errors.not_submitted', {
        currentStatus: po.status,
      }),
    );
  }
  
  // Separation of duties (T-0252): The submitter cannot be the approver
  if (po.submittedBy === ctx.userId) {
    return err(
      AppError.businessRule('purchasing.errors.separation_of_duties', {
        detail: 'The user who submitted the PO cannot also approve it.',
      }),
    );
  }

  // Load PO lines for journal entry
  const lines = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, po.id))
    .orderBy(purchaseOrderLines.lineNo);

  if (lines.length === 0) {
    return err(AppError.businessRule('purchasing.errors.no_lines'));
  }

  // Verify accounting period is open
  const periodCode = po.orderDate.substring(0, 7);
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

  // Resolve AP account ID
  const apAccountId = await resolvePayablesAccountId(ctx.tenantId);
  if (!apAccountId) {
    return err(AppError.businessRule('purchasing.errors.ap_account_not_found'));
  }

  const [supplier] = await db
    .select({ paymentTermsDays: partners.paymentTermsDays })
    .from(partners)
    .where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.id, po.supplierId)))
    .limit(1);
  const apDueDate = addDays(po.orderDate, supplier?.paymentTermsDays ?? 0);

  // Resolve inventory account per first product (simplified: single DR line)
  const firstProduct = lines[0]!;
  const invAccountId = await resolveInventoryAccountForProduct(
    ctx.tenantId,
    firstProduct.productId,
  );
  if (!invAccountId) {
    return err(
      AppError.businessRule('purchasing.errors.inventory_account_not_found', {
        code: DEFAULT_INVENTORY_ACCOUNT_CODE,
      }),
    );
  }

  if (po.approvedBy) {
    return err(AppError.conflict('purchasing.errors.approval_in_progress'));
  }

  // Claim approval authority before creating accounting artifacts. This
  // prevents concurrent approvers from creating duplicate AP journals
  // while the PO still appears submitted.
  const approvalClaimedAt = new Date();
  const approvalClaim = await db
    .update(purchaseOrders)
    .set({
      approvedBy: ctx.userId,
      approvedAt: approvalClaimedAt,
      updatedBy: ctx.userId,
      version: po.version + 1,
    })
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.version, po.version),
        eq(purchaseOrders.status, 'submitted'),
        isNull(purchaseOrders.approvedBy),
      ),
    )
    .returning({ id: purchaseOrders.id });
  if (!approvalClaim || approvalClaim.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  // Removed journal entry creation here to fix double-DR and AP timing.
  // AP is recognized upon goods receipt (GRN) instead.

  // Finalize the approval only if this caller still owns the soft lock.
  const finalized = await db
    .update(purchaseOrders)
    .set({
      status: 'approved',
      updatedBy: ctx.userId,
      version: po.version + 2,
    })
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.version, po.version + 1),
        eq(purchaseOrders.status, 'submitted'),
        eq(purchaseOrders.approvedBy, ctx.userId),
      ),
    )
    .returning({ id: purchaseOrders.id });
  if (!finalized || finalized.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  await auditRecord({
    action: 'approve',
    entityType: 'purchase_order',
    entityId: po.id,
    before: { status: 'submitted' },
    after: {
      status: 'approved',
      approvedBy: ctx.userId,
      grandTotal: po.grandTotal.toString(),
    },
    ctx,
  });

  return ok({
    id: po.id,
    number: po.number,
    status: 'approved',
  });
}

// ─── Cancel PO ──────────────────────────────────────────────────────────────

export async function cancelPO(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<POWorkflowResult>> {
  const parsed = CancelPOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('purchasing.errors.invalid_input', {
        detail: parsed.error.message,
      }),
    );
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantId, ctx.tenantId), eq(purchaseOrders.id, parsed.data.poId)))
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: po.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const NON_CANCELLABLE = new Set(['closed', 'cancelled', 'received']);
  if (NON_CANCELLABLE.has(po.status)) {
    return err(
      AppError.businessRule('purchasing.errors.cannot_cancel', {
        currentStatus: po.status,
      }),
    );
  }

  if (po.status === 'submitted' && po.approvedBy) {
    return err(AppError.conflict('purchasing.errors.approval_in_progress'));
  }

  // Approved POs: only creator or users with approval authority can cancel.
  if (po.status === 'approved') {
    const isCreator = po.createdBy === ctx.userId;
    const approvePerm = await requirePermission(ctx.userId, 'purchasing.po.approve', {
      locationId: po.locationId,
    });
    if (!isCreator && !approvePerm.ok) {
      return err(AppError.forbidden('purchasing.errors.cancel_not_authorized'));
    }
  }

  const claimedCancel = await db
    .update(purchaseOrders)
    .set({
      status: 'cancelled',
      notes: po.notes
        ? `${po.notes}\n[Cancelled] ${parsed.data.reason}`
        : `[Cancelled] ${parsed.data.reason}`,
      updatedBy: ctx.userId,
      version: po.version + 1,
    })
    .where(
      and(
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.version, po.version),
        eq(purchaseOrders.status, po.status),
      ),
    )
    .returning({ id: purchaseOrders.id });
  if (!claimedCancel || claimedCancel.length === 0) {
    return err(AppError.conflict('purchasing.errors.version_mismatch'));
  }

  await auditRecord({
    action: 'cancel',
    entityType: 'purchase_order',
    entityId: po.id,
    before: { status: po.status },
    after: { status: 'cancelled', reason: parsed.data.reason },
    ctx,
  });

  return ok({
    id: po.id,
    number: po.number,
    status: 'cancelled',
  });
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + Math.max(0, days));
  return value.toISOString().slice(0, 10);
}
