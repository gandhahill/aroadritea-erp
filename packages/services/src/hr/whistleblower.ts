import { db, eq, desc, and } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { requirePermission } from '../iam';
import { type Result, err, ok } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { randomUUID } from 'crypto';
import { auditRecord } from "../audit";

export async function submitWhistleblowerReport(
  input: { title: string; category: string; content: string; attachmentUrl?: string },
  ctx: AuditContext
): Promise<Result<{ id: string }>> {
  if (!ctx.userId) {
    return err(AppError.unauthenticated());
  }

  const id = randomUUID();

  await db.insert(whistleblowerReports).values({
    id,
    title: input.title,
    description: `[Category: ${input.category}] ${input.content}`,
    status: 'open',
    tenantId: ctx.tenantId,
    attachmentUrl: input.attachmentUrl || null,
  });

  await auditRecord({
      action: 'create',
      entityType: 'whistleblower_report',
      entityId: id,
      before: null,
      after: { id, title: input.title, description: `[Category: ${input.category}] ${input.content}`, status: 'open', attachmentUrl: input.attachmentUrl || null },
      metadata: null,
      ctx,
    });

  return ok({ id });
}

export async function listWhistleblowerReports(ctx: AuditContext): Promise<Result<any[]>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.whistleblower.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const reports = await db
    .select()
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.tenantId, ctx.tenantId))
    .orderBy(desc(whistleblowerReports.createdAt));

  return ok(reports);
}

export async function updateWhistleblowerReportStatus(
  input: { id: string; status: 'open' | 'investigating' | 'resolved'; resolutionNotes?: string },
  ctx: AuditContext
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.manage_employees', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const existing = await db
    .select()
    .from(whistleblowerReports)
    .where(
      and(
        eq(whistleblowerReports.tenantId, ctx.tenantId),
        eq(whistleblowerReports.id, input.id)
      )
    )
    .then((r) => r[0]);

  if (!existing) {
    return err(AppError.notFound('hr.whistleblower.notFound', { id: input.id }));
  }

  await db
    .update(whistleblowerReports)
    .set({
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      updatedAt: new Date(),
      updatedByUserId: ctx.userId,
    })
    .where(
      and(
        eq(whistleblowerReports.tenantId, ctx.tenantId),
        eq(whistleblowerReports.id, input.id)
      )
    );

  if (existing) {
    await auditRecord({
        action: 'update',
        entityType: 'whistleblower_report',
        entityId: input.id,
        before: existing,
        after: { ...existing, status: input.status, resolutionNotes: input.resolutionNotes },
        metadata: { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        ctx,
      });
  }

  return ok({ id: input.id });
}
