/**
 * accounting.reimbursement — SD §25.8
 *
 * Reimbursement workflow: draft → submitted → approved → disbursed (or rejected).
 * Auto-escalation after 48h handled by worker cron.
 */

import { db } from '@erp/db';
import { reimbursementRequests } from '@erp/db/schema/accounting';
import { auditLog } from '@erp/db/schema/audit';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, lt } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  type CreateReimbursementInput,
  CreateReimbursementSchema,
  type ListReimbursementsInput,
  ListReimbursementsSchema,
  type RejectReimbursementInput,
  RejectReimbursementSchema,
} from './schemas';

// --- Return types ---

export interface ReimbursementResult {
  id: string;
  requesterId: string;
  locationId: string;
  amount: string;
  category: string;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  disbursedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReimbursementListResult {
  items: ReimbursementResult[];
  total: number;
}

// --- Helpers ---

function toResult(row: typeof reimbursementRequests.$inferSelect): ReimbursementResult {
  return {
    id: row.id,
    requesterId: row.requesterId,
    locationId: row.locationId,
    amount: row.amount.toString(),
    category: row.category,
    description: row.description,
    attachmentUrl: row.attachmentUrl,
    attachmentName: row.attachmentName,
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    disbursedAt: row.disbursedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['disbursed'],
};

// --- Service functions ---

/**
 * Create a reimbursement request (draft).
 */
export async function createReimbursement(
  input: CreateReimbursementInput,
  ctx: AuditContext,
): Promise<Result<ReimbursementResult>> {
  const parsed = CreateReimbursementSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.reimbursement.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.reimbursement.create', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const id = generateId();
      const rows = await db
        .insert(reimbursementRequests)
        .values({
          id,
          tenantId: ctx.tenantId,
          requesterId: ctx.userId,
          locationId: data.locationId,
          amount: BigInt(data.amount),
          category: data.category,
          description: data.description,
          attachmentUrl: data.attachmentUrl ?? null,
          attachmentName: data.attachmentName ?? null,
          status: 'draft',
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      await auditRecord({
        action: 'create',
        entityType: 'reimbursement_request',
        entityId: id,
        before: null,
        after: {
          id,
          amount: data.amount,
          category: data.category,
          description: data.description,
          status: 'draft',
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return toResult(rows[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.reimbursement.createFailed', e);
    },
  );
}

/**
 * Submit a draft reimbursement for approval.
 */
export async function submitReimbursement(
  id: string,
  ctx: AuditContext,
): Promise<Result<ReimbursementResult>> {
  return transitionStatus(id, 'submitted', ctx, 'accounting.reimbursement.create');
}

/**
 * Approve a submitted reimbursement.
 */
export async function approveReimbursement(
  id: string,
  ctx: AuditContext,
): Promise<Result<ReimbursementResult>> {
  return transitionStatus(id, 'approved', ctx, 'accounting.reimbursement.approve');
}

/**
 * Mark an approved reimbursement as disbursed.
 */
export async function disburseReimbursement(
  id: string,
  ctx: AuditContext,
): Promise<Result<ReimbursementResult>> {
  return transitionStatus(id, 'disbursed', ctx, 'accounting.reimbursement.disburse');
}

/**
 * Reject a submitted reimbursement with reason.
 */
export async function rejectReimbursement(
  input: RejectReimbursementInput,
  ctx: AuditContext,
): Promise<Result<ReimbursementResult>> {
  const parsed = RejectReimbursementSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.reimbursement.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { id, reason } = parsed.data;

  const rows = await db
    .select()
    .from(reimbursementRequests)
    .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, ctx.tenantId)))
    .limit(1);

  const req = rows[0];
  if (!req) {
    return err(AppError.notFound('accounting.reimbursement.notFound', { id }));
  }

  // Scope permission to the request's location, not the caller's
  // current locationId — otherwise an approver at one outlet could
  // reject another outlet's expense.
  const permCheck = await requirePermission(ctx.userId, 'accounting.reimbursement.approve', {
    locationId: req.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const allowed = VALID_TRANSITIONS[req.status];
  if (!allowed?.includes('rejected')) {
    return err(
      AppError.businessRule('accounting.reimbursement.invalidTransition', {
        currentStatus: req.status,
        targetStatus: 'rejected',
      }),
    );
  }

  return tryCatch(
    async () => {
      const updated = await db
        .update(reimbursementRequests)
        .set({
          status: 'rejected',
          rejectionReason: reason,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.status, req.status)))
        .returning();

      if (!updated || updated.length === 0) {
        throw AppError.conflict('accounting.reimbursement.concurrentModification', {
          id,
          expectedStatus: req.status,
        });
      }

      await auditRecord({
        action: 'reject',
        entityType: 'reimbursement_request',
        entityId: id,
        before: { status: req.status },
        after: { status: 'rejected', rejectionReason: reason },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return toResult(updated[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.reimbursement.rejectFailed', e);
    },
  );
}

/**
 * List reimbursement requests with optional filters.
 */
export async function listReimbursements(
  input: ListReimbursementsInput,
  ctx: AuditContext,
): Promise<Result<ReimbursementListResult>> {
  const parsed = ListReimbursementsSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('accounting.reimbursement.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const { locationId, status, limit, offset } = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'accounting.reimbursement.view', {
    locationId: locationId ?? ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const conditions = [eq(reimbursementRequests.tenantId, ctx.tenantId)];
  if (locationId) conditions.push(eq(reimbursementRequests.locationId, locationId));
  if (status) conditions.push(eq(reimbursementRequests.status, status));

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(reimbursementRequests)
      .where(and(...conditions))
      .orderBy(desc(reimbursementRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ id: reimbursementRequests.id })
      .from(reimbursementRequests)
      .where(and(...conditions)),
  ]);

  return ok({
    items: rows.map(toResult),
    total: countRows.length,
  });
}

/**
 * Escalate old submitted reimbursements (>48h). Called by worker cron.
 */
export async function getStaleReimbursements(
  tenantId: string,
): Promise<(typeof reimbursementRequests.$inferSelect)[]> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return db
    .select()
    .from(reimbursementRequests)
    .where(
      and(
        eq(reimbursementRequests.tenantId, tenantId),
        eq(reimbursementRequests.status, 'submitted'),
        lt(reimbursementRequests.createdAt, cutoff),
      ),
    );
}

// --- Internal helper ---

async function transitionStatus(
  id: string,
  targetStatus: string,
  ctx: AuditContext,
  permission: string,
): Promise<Result<ReimbursementResult>> {
  const rows = await db
    .select()
    .from(reimbursementRequests)
    .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.tenantId, ctx.tenantId)))
    .limit(1);

  const req = rows[0];
  if (!req) {
    return err(AppError.notFound('accounting.reimbursement.notFound', { id }));
  }

  // Scope permission to the request's actual location, not the caller's
  // current location (cross-outlet privilege escalation guard).
  const permCheck = await requirePermission(ctx.userId, permission as PermissionCode, {
    locationId: req.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const allowed = VALID_TRANSITIONS[req.status];
  if (!allowed?.includes(targetStatus)) {
    return err(
      AppError.businessRule('accounting.reimbursement.invalidTransition', {
        currentStatus: req.status,
        targetStatus,
      }),
    );
  }

  return tryCatch(
    async () => {
      const setFields: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      };

      if (targetStatus === 'approved') {
        setFields.approvedBy = ctx.userId;
        setFields.approvedAt = new Date();
      } else if (targetStatus === 'disbursed') {
        setFields.disbursedAt = new Date();
      }

      // Atomic claim: only one concurrent caller can perform the
      // transition. Prevents double-approve / double-disburse races
      // that would otherwise write duplicate audit rows and (for
      // disburse) duplicate journal entries.
      const updated = await db
        .update(reimbursementRequests)
        .set(setFields)
        .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.status, req.status)))
        .returning();

      if (!updated || updated.length === 0) {
        throw AppError.conflict('accounting.reimbursement.concurrentModification', {
          id,
          expectedStatus: req.status,
        });
      }

      const action =
        targetStatus === 'submitted'
          ? 'submit'
          : targetStatus === 'approved'
            ? 'approve'
            : targetStatus === 'disbursed'
              ? 'disburse'
              : 'update';

      await db.insert(auditLog).values({
        id: generateId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action,
        entityType: 'reimbursement_request',
        entityId: id,
        before: { status: req.status },
        after: { status: targetStatus },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      });

      return toResult(updated[0]!);
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('accounting.reimbursement.transitionFailed', e);
    },
  );
}

import type { PermissionCode } from '@erp/shared/types';
