/**
 * purchasing/workflow.ts — PO state transitions (SD §21.6)
 *
 * submitPO:  draft → submitted
 * approvePO: submitted → approved (creates AP journal entry)
 * cancelPO:  any non-closed → cancelled
 */

import { db } from '@erp/db';
import {
  purchaseOrders,
  purchaseOrderLines,
} from '@erp/db/schema/purchasing';
import { accounts, accountingPeriods } from '@erp/db/schema/accounting';
import { roles, userRoles } from '@erp/db/schema/auth';
import { products } from '@erp/db/schema/inventory';
import { eq, and } from 'drizzle-orm';
import { type Result, ok, err } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import { type AuditContext } from '@erp/shared/types';
import { requirePermission } from '../iam';
import { auditRecord } from '../audit';
import { createJournal } from '../accounting/create-journal';
import {
  SubmitPOInputSchema,
  ApprovePOInputSchema,
  CancelPOInputSchema,
} from './schemas';

// ─── Constants ───────────────────────────────────────────────────────────────

const AP_ACCOUNT_CODE = '2-1010'; // Utang Usaha
const DEFAULT_INVENTORY_ACCOUNT_CODE = '1-1210'; // Persediaan Barang Dagangan

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveAccountId(
  tenantId: string,
  code: string,
): Promise<string | null> {
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
  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = SubmitPOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input', {
      detail: parsed.error.message,
    }));
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        eq(purchaseOrders.id, parsed.data.poId),
      ),
    )
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  if (po.status !== 'draft') {
    return err(AppError.businessRule('purchasing.errors.not_draft', {
      currentStatus: po.status,
    }));
  }

  await db
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
      ),
    );

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
  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.approve', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = ApprovePOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input', {
      detail: parsed.error.message,
    }));
  }

  const director = await isDirector(ctx);
  if (!director) {
    return err(AppError.forbidden('purchasing.errors.not_director'));
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        eq(purchaseOrders.id, parsed.data.poId),
      ),
    )
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  if (po.status !== 'submitted') {
    return err(AppError.businessRule('purchasing.errors.not_submitted', {
      currentStatus: po.status,
    }));
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
      and(
        eq(accountingPeriods.tenantId, ctx.tenantId),
        eq(accountingPeriods.code, periodCode),
      ),
    )
    .limit(1);

  if (!period) {
    return err(AppError.businessRule('accounting.journal.periodNotFound', {
      periodCode,
    }));
  }
  if (period.status !== 'open') {
    return err(AppError.businessRule('accounting.journal.periodClosed', {
      periodCode,
      periodStatus: period.status,
    }));
  }

  // Resolve AP account ID
  const apAccountId = await resolveAccountId(ctx.tenantId, AP_ACCOUNT_CODE);
  if (!apAccountId) {
    return err(AppError.businessRule('purchasing.errors.ap_account_not_found'));
  }

  // Resolve inventory account per first product (simplified: single DR line)
  const firstProduct = lines[0]!;
  const invAccountId = await resolveInventoryAccountForProduct(
    ctx.tenantId,
    firstProduct.productId,
  );

  // Create AP journal entry: DR Inventory/Expense, CR AP
  const grandTotal = po.grandTotal.toString();
  const jeResult = await createJournal(
    {
      postingDate: po.orderDate,
      locationId: po.locationId,
      description: `Purchase Order ${po.number} — AP recognition`,
      referenceType: 'purchase',
      referenceId: po.id,
      lines: [
        {
          accountId: invAccountId,
          locationId: po.locationId,
          description: `PO ${po.number} inventory`,
          debit: grandTotal,
          credit: '0',
          partnerId: po.supplierId,
        },
        {
          accountId: apAccountId,
          locationId: po.locationId,
          description: `PO ${po.number} accounts payable`,
          debit: '0',
          credit: grandTotal,
          partnerId: po.supplierId,
        },
      ],
    },
    ctx,
  );

  let journalEntryId: string | null = null;
  if (jeResult.ok) {
    journalEntryId = jeResult.value.id;
  }

  // Update PO status
  await db
    .update(purchaseOrders)
    .set({
      status: 'approved',
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      journalEntryId,
      updatedBy: ctx.userId,
      version: po.version + 1,
    })
    .where(
      and(
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.version, po.version),
      ),
    );

  await auditRecord({
    action: 'approve',
    entityType: 'purchase_order',
    entityId: po.id,
    before: { status: 'submitted' },
    after: {
      status: 'approved',
      approvedBy: ctx.userId,
      journalEntryId,
      grandTotal: grandTotal,
    },
    ctx,
  });

  return ok({
    id: po.id,
    number: po.number,
    status: 'approved',
    journalEntryId,
  });
}

// ─── Cancel PO ──────────────────────────────────────────────────────────────

export async function cancelPO(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<POWorkflowResult>> {
  const permCheck = await requirePermission(ctx.userId, 'purchasing.po.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CancelPOInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('purchasing.errors.invalid_input', {
      detail: parsed.error.message,
    }));
  }

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        eq(purchaseOrders.id, parsed.data.poId),
      ),
    )
    .limit(1);

  if (!po) {
    return err(AppError.notFound('purchasing.errors.po_not_found'));
  }

  const NON_CANCELLABLE = new Set(['closed', 'cancelled', 'received']);
  if (NON_CANCELLABLE.has(po.status)) {
    return err(AppError.businessRule('purchasing.errors.cannot_cancel', {
      currentStatus: po.status,
    }));
  }

  // Approved POs: only creator or director can cancel
  if (po.status === 'approved') {
    const isCreator = po.createdBy === ctx.userId;
    const director = await isDirector(ctx);
    if (!isCreator && !director) {
      return err(AppError.forbidden('purchasing.errors.cancel_not_authorized'));
    }
  }

  await db
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
      ),
    );

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
