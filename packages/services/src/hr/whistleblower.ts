/**
 * Whistleblower service — SD §9.10, AGENTS.md "audit trail ANONIM".
 *
 * Submission rules (anonymity):
 *  - `submitWhistleblowerReport` MUST NOT receive or store the reporter's
 *    user id, IP, or user-agent. Only the tenantId is required so the row
 *    lands in the correct tenant slice.
 *  - The function MUST NOT call `auditRecord` for the submission itself —
 *    the audit log writes `userId` and `metadata.ip/userAgent`, which would
 *    leak the reporter's identity for any admin with `audit.read` even when
 *    the public table omits it.
 *  - Admin actions (list / update status) DO write audit entries because
 *    the actor in that path is the HR admin handling the report, not the
 *    reporter.
 */
import { randomUUID } from 'node:crypto';
import { and, db, desc, eq } from '@erp/db';
import { whistleblowerReports } from '@erp/db/schema/whistleblower';
import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export interface SubmitWhistleblowerInput {
  tenantId: string;
  title: string;
  category: string;
  content: string;
  attachmentUrl?: string;
}

export async function submitWhistleblowerReport(
  input: SubmitWhistleblowerInput,
): Promise<Result<{ id: string }>> {
  const title = input.title?.trim() ?? '';
  const category = input.category?.trim() ?? '';
  const content = input.content?.trim() ?? '';
  const tenantId = input.tenantId?.trim() ?? '';

  if (!tenantId) return err(AppError.validation('hr.whistleblower.invalidTenant'));
  if (!title) return err(AppError.validation('hr.whistleblower.invalidTitle'));
  if (!category) return err(AppError.validation('hr.whistleblower.invalidCategory'));
  if (!content) return err(AppError.validation('hr.whistleblower.invalidContent'));
  if (title.length > 200) return err(AppError.validation('hr.whistleblower.titleTooLong'));
  if (content.length > 8000) return err(AppError.validation('hr.whistleblower.contentTooLong'));

  const id = randomUUID();

  await db.insert(whistleblowerReports).values({
    id,
    title,
    description: `[Category: ${category}] ${content}`,
    status: 'open',
    tenantId,
    attachmentUrl: input.attachmentUrl?.trim() || null,
  });

  // No auditRecord here — see file-level docs. The whistleblower table is
  // the only persistent trace of a submission and it intentionally has no
  // createdByUserId column.

  // Notify report handlers (anyone with hr.whistleblower.read) that a new
  // report needs review. The notification carries ONLY the category and a
  // link to the secure list — never the reporter's identity (which is not
  // stored) nor the free-text content. Best-effort: notifyByPermission
  // swallows its own errors and must not affect the submission result.
  const { notifyByPermission } = await import('../notification');
  await notifyByPermission({
    tenantId,
    kind: 'whistleblower',
    title: 'Laporan whistleblowing baru',
    body: `Kategori: ${category}. Menunggu peninjauan.`,
    link: '/hr/whistleblower',
    permission: 'hr.whistleblower.read',
  });

  return ok({ id });
}

export async function listWhistleblowerReports(
  ctx: AuditContext,
): Promise<Result<Array<typeof whistleblowerReports.$inferSelect>>> {
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
  input: {
    id: string;
    status: 'open' | 'investigating' | 'resolved';
    resolutionNotes?: string;
  },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.whistleblower.write', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const existing = await db
    .select()
    .from(whistleblowerReports)
    .where(
      and(eq(whistleblowerReports.tenantId, ctx.tenantId), eq(whistleblowerReports.id, input.id)),
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
      and(eq(whistleblowerReports.tenantId, ctx.tenantId), eq(whistleblowerReports.id, input.id)),
    );

  // Audit the admin's status change — actor here is the investigator,
  // never the original reporter.
  await auditRecord({
    action: 'update',
    entityType: 'whistleblower_report',
    entityId: input.id,
    before: { status: existing.status, resolutionNotes: existing.resolutionNotes ?? null },
    after: { status: input.status, resolutionNotes: input.resolutionNotes ?? null },
    metadata: { ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
    ctx,
  });

  return ok({ id: input.id });
}
