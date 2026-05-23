import { db, eq, desc } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { type Result, err, ok } from '@erp/shared/result';
import { AppError } from '@erp/shared/errors';
import type { AuditContext } from '@erp/shared/types';
import { randomUUID } from 'crypto';

export async function submitWhistleblowerReport(
  input: { title: string; category: string; content: string; evidencePath?: string },
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
  await db
    .update(whistleblowerReports)
    .set({
      status: input.status,
      resolutionNotes: input.resolutionNotes,
      updatedAt: new Date(),
      updatedByUserId: ctx.userId,
    })
    .where(eq(whistleblowerReports.id, input.id));

  return ok({ id: input.id });
}
