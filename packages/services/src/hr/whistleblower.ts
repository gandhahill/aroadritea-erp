import { db, eq, desc } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { auditLog } from '@erp/db/schema/audit';
import { type Result, err, ok } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { randomUUID } from 'crypto';

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

  await db.insert(auditLog).values({
    id: randomUUID(),
    tenantId: ctx.tenantId,
    userId: 'anonymous_whistleblower', // Anonimkan untuk melindungi pelapor
    action: 'create',
    entityType: 'whistleblower_report',
    entityId: id,
    before: null,
    after: { id, title: input.title, description: `[Category: ${input.category}] ${input.content}`, status: 'open', attachmentUrl: input.attachmentUrl || null },
    metadata: null, // JANGAN simpan IP Address atau User Agent untuk privasi pelapor
  });

  return ok({ id });
}

export async function listWhistleblowerReports(ctx: AuditContext): Promise<Result<any[]>> {
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
  const existing = await db
    .select()
    .from(whistleblowerReports)
    .where(eq(whistleblowerReports.id, input.id))
    .then((r) => r[0]);

  await db
    .update(whistleblowerReports)
    .set({
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      updatedAt: new Date(),
      updatedByUserId: ctx.userId,
    })
    .where(eq(whistleblowerReports.id, input.id));

  if (existing) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'update',
      entityType: 'whistleblower_report',
      entityId: input.id,
      before: existing,
      after: { ...existing, status: input.status, resolutionNotes: input.resolutionNotes },
      metadata: { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
    });
  }

  return ok({ id: input.id });
}
