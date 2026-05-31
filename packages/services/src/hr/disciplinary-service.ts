/**
 * Disciplinary Actions Service — SD §21.8 §Surat Peringatan
 *
 * SP1 / SP2 / SP3 workflow:
 * 1. createDisciplinaryAction — HR/director creates SP1/SP2/SP3
 * 2. acknowledgeDisciplinaryAction — employee acknowledges receipt
 * 3. attachDocument — store attachment URL
 *
 * Permission: hr.disciplinary.write (create/acknowledge)
 * Permission: hr.disciplinary.read (list/view)
 */

import { db } from '@erp/db';
import { disciplinaryActions } from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

// ─── Schema ─────────────────────────────────────────────────────────────────

export const CreateDisciplinaryInputSchema = z.object({
  employeeId: z.string().min(1),
  level: z.enum(['SP1', 'SP2', 'SP3']),
  reason: z.string().min(10, 'hr.disciplinary.reasonTooShort'),
  incidentDate: z.string().datetime(),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
});

export const AcknowledgeDisciplinaryInputSchema = z.object({
  disciplinaryId: z.string().min(1),
});

export const ListDisciplinaryInputSchema = z.object({
  employeeId: z.string().optional(),
  level: z.enum(['SP1', 'SP2', 'SP3']).optional(),
  status: z.enum(['issued', 'acknowledged', 'escalated']).optional(),
  limit: z.number().min(1).max(100).default(50),
});

export const AttachDocumentInputSchema = z.object({
  disciplinaryId: z.string().min(1),
  attachmentUrl: z.string().url('hr.disciplinary.invalidUrl'),
});

export type CreateDisciplinaryInput = z.infer<typeof CreateDisciplinaryInputSchema>;
export type AcknowledgeDisciplinaryInput = z.infer<typeof AcknowledgeDisciplinaryInputSchema>;
export type ListDisciplinaryInput = z.infer<typeof ListDisciplinaryInputSchema>;
export type AttachDocumentInput = z.infer<typeof AttachDocumentInputSchema>;

// ─── createDisciplinaryAction ──────────────────────────────────────────────

export async function createDisciplinaryAction(
  input: CreateDisciplinaryInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; employeeId: string; level: string; status: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.disciplinary.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateDisciplinaryInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.disciplinary.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  try {
    const id = generateId();
    await db.insert(disciplinaryActions).values({
      id,
      tenantId: ctx.tenantId,
      locationId: ctx.locationId,
      employeeId: data.employeeId,
      level: data.level,
      reason: data.reason,
      incidentDate: new Date(data.incidentDate),
      attachmentUrl: data.attachmentUrl || null,
      status: 'issued',
      issuedBy: ctx.userId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // SP1/SP2/SP3 affect labor records that may lead to termination,
    // so the issuance MUST be on the immutable audit log (ISO 38500 +
    // UU Cipta Kerja documentation requirements).
    await auditRecord({
      action: 'create',
      entityType: 'disciplinary_action',
      entityId: id,
      before: null,
      after: {
        employeeId: data.employeeId,
        level: data.level,
        reason: data.reason,
        incidentDate: data.incidentDate,
        status: 'issued',
        issuedBy: ctx.userId,
      },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ id, employeeId: data.employeeId, level: data.level, status: 'issued' });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.disciplinary.createFailed', e));
  }
}

// ─── acknowledgeDisciplinaryAction ─────────────────────────────────────────

export async function acknowledgeDisciplinaryAction(
  input: AcknowledgeDisciplinaryInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.disciplinary.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = AcknowledgeDisciplinaryInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.disciplinary.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  try {
    const [action] = await db
      .select()
      .from(disciplinaryActions)
      .where(
        and(
          eq(disciplinaryActions.tenantId, ctx.tenantId),
          eq(disciplinaryActions.id, data.disciplinaryId),
          isNull(disciplinaryActions.deletedAt),
        ),
      )
      .limit(1);

    if (!action) {
      return err(AppError.notFound('hr.disciplinary.notFound', { id: data.disciplinaryId }));
    }

    // Atomic claim: only transitions from `issued` to `acknowledged`.
    // A double-acknowledge (employee tapping twice) does NOT write a
    // second audit row.
    const claimed = await db
      .update(disciplinaryActions)
      .set({
        status: 'acknowledged',
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(disciplinaryActions.tenantId, ctx.tenantId),
          eq(disciplinaryActions.id, data.disciplinaryId),
          eq(disciplinaryActions.status, 'issued'),
          isNull(disciplinaryActions.deletedAt),
        ),
      )
      .returning({ id: disciplinaryActions.id });
    if (!claimed || claimed.length === 0) {
      return err(
        AppError.businessRule('hr.disciplinary.notIssued', {
          currentStatus: action.status,
        }),
      );
    }

    await auditRecord({
      action: 'acknowledge',
      entityType: 'disciplinary_action',
      entityId: data.disciplinaryId,
      before: { status: action.status },
      after: { status: 'acknowledged', acknowledgedBy: ctx.userId },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ id: data.disciplinaryId, status: 'acknowledged' });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.disciplinary.acknowledgeFailed', e));
  }
}

// ─── listDisciplinaryActions ───────────────────────────────────────────────

export async function listDisciplinaryActions(
  input: ListDisciplinaryInput,
  ctx: AuditContext,
): Promise<
  Result<
    Array<{
      id: string;
      employeeId: string;
      level: string;
      reason: string;
      incidentDate: Date;
      status: string;
      issuedBy: string;
      attachmentUrl: string | null;
    }>
  >
> {
  const permCheck = await requirePermission(ctx.userId, 'hr.disciplinary.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const conditions = [
      eq(disciplinaryActions.tenantId, ctx.tenantId),
      isNull(disciplinaryActions.deletedAt),
    ];
    if (input.employeeId) conditions.push(eq(disciplinaryActions.employeeId, input.employeeId));
    if (input.level) conditions.push(eq(disciplinaryActions.level, input.level));
    if (input.status) conditions.push(eq(disciplinaryActions.status, input.status));

    const rows = await db
      .select({
        id: disciplinaryActions.id,
        employeeId: disciplinaryActions.employeeId,
        level: disciplinaryActions.level,
        reason: disciplinaryActions.reason,
        incidentDate: disciplinaryActions.incidentDate,
        status: disciplinaryActions.status,
        issuedBy: disciplinaryActions.issuedBy,
        attachmentUrl: disciplinaryActions.attachmentUrl,
      })
      .from(disciplinaryActions)
      .where(and(...conditions))
      .orderBy(desc(disciplinaryActions.createdAt))
      .limit(input.limit);

    return ok(rows);
  } catch (e) {
    return err(AppError.internal('hr.disciplinary.listFailed', e));
  }
}

// ─── attachDocument ───────────────────────────────────────────────────────

export async function attachDocument(
  input: AttachDocumentInput,
  ctx: AuditContext,
): Promise<Result<{ id: string; attachmentUrl: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.disciplinary.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  try {
    const [action] = await db
      .select({
        id: disciplinaryActions.id,
        attachmentUrl: disciplinaryActions.attachmentUrl,
      })
      .from(disciplinaryActions)
      .where(
        and(
          eq(disciplinaryActions.tenantId, ctx.tenantId),
          eq(disciplinaryActions.id, input.disciplinaryId),
          isNull(disciplinaryActions.deletedAt),
        ),
      )
      .limit(1);

    if (!action) {
      return err(AppError.notFound('hr.disciplinary.notFound', { id: input.disciplinaryId }));
    }

    await db
      .update(disciplinaryActions)
      .set({
        attachmentUrl: input.attachmentUrl,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(disciplinaryActions.tenantId, ctx.tenantId),
          eq(disciplinaryActions.id, input.disciplinaryId),
          isNull(disciplinaryActions.deletedAt),
        ),
      );

    await auditRecord({
      action: 'update',
      entityType: 'disciplinary_action',
      entityId: input.disciplinaryId,
      before: { attachmentUrl: action.attachmentUrl },
      after: { attachmentUrl: input.attachmentUrl },
      metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
      ctx,
    });

    return ok({ id: input.disciplinaryId, attachmentUrl: input.attachmentUrl });
  } catch (e) {
    if (e instanceof AppError) return err(e);
    return err(AppError.internal('hr.disciplinary.attachFailed', e));
  }
}
