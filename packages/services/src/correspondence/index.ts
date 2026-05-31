/**
 * Correspondence service — administrative letter register.
 *
 * All mutations are tenant-scoped, permission-guarded, soft-delete aware,
 * and logged to audit_log for ISO 27001 / COBIT traceability.
 */

import { db } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { correspondenceRecords } from '@erp/db/schema/correspondence';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requirePermission } from '../iam';

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const CorrespondenceDirectionSchema = z.enum(['incoming', 'outgoing', 'internal']);
export const CorrespondenceChannelSchema = z.enum([
  'physical',
  'email',
  'whatsapp',
  'courier',
  'other',
]);
export const CorrespondenceClassificationSchema = z.enum([
  'general',
  'legal',
  'finance',
  'hr',
  'procurement',
  'tax',
  'other',
]);
export const CorrespondencePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const CorrespondenceStatusSchema = z.enum([
  'draft',
  'registered',
  'in_progress',
  'sent',
  'closed',
  'archived',
]);

export const DispositionSchema = z.object({
  id: z.string().optional(),
  action: z.string().min(1).max(500),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export const CreateCorrespondenceInputSchema = z.object({
  locationId: z.string().min(1),
  direction: CorrespondenceDirectionSchema,
  documentNo: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(240),
  counterparty: z.string().trim().max(160).optional().nullable(),
  documentDate: DateStringSchema,
  dueDate: DateStringSchema.optional().nullable(),
  channel: CorrespondenceChannelSchema.default('physical'),
  classification: CorrespondenceClassificationSchema.default('general'),
  priority: CorrespondencePrioritySchema.default('normal'),
  ownerUserId: z.string().trim().max(120).optional().nullable(),
  summary: z.string().trim().max(2000).optional().nullable(),
  storageUrl: z.string().trim().max(500).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  attachments: z.array(z.string().trim()).default([]),
  dispositions: z.array(DispositionSchema).default([]),
});

export const UpdateCorrespondenceInputSchema = CreateCorrespondenceInputSchema.partial().extend({
  status: CorrespondenceStatusSchema.optional(),
});

export const ListCorrespondenceInputSchema = z.object({
  status: CorrespondenceStatusSchema.optional(),
  direction: CorrespondenceDirectionSchema.optional(),
  classification: CorrespondenceClassificationSchema.optional(),
  locationId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export type CreateCorrespondenceInput = z.infer<typeof CreateCorrespondenceInputSchema>;
export type UpdateCorrespondenceInput = z.infer<typeof UpdateCorrespondenceInputSchema>;
export type ListCorrespondenceInput = z.infer<typeof ListCorrespondenceInputSchema>;
export type CorrespondenceRecord = ReturnType<typeof toResult>;

function toResult(row: typeof correspondenceRecords.$inferSelect) {
  return {
    id: row.id,
    locationId: row.locationId,
    direction: row.direction,
    documentNo: row.documentNo,
    subject: row.subject,
    counterparty: row.counterparty,
    documentDate: row.documentDate,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    dueDate: row.dueDate,
    channel: row.channel,
    classification: row.classification,
    priority: row.priority,
    status: row.status,
    ownerUserId: row.ownerUserId,
    summary: row.summary,
    storageUrl: row.storageUrl,
    tags: row.tags,
    agendaNo: row.agendaNo,
    attachments: row.attachments,
    dispositions: row.dispositions,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function scopedLocation(locationId?: string) {
  return locationId && locationId !== 'global' ? locationId : undefined;
}

async function insertAudit(
  ctx: AuditContext,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action,
    entityType: 'correspondence_record',
    entityId,
    before,
    after,
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
  });
}

export async function createCorrespondence(
  input: CreateCorrespondenceInput,
  ctx: AuditContext,
): Promise<Result<CorrespondenceRecord>> {
  const parsed = CreateCorrespondenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('correspondence.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;
  const perm = await requirePermission(ctx.userId, 'correspondence.create', {
    locationId: data.locationId,
  });
  if (!perm.ok) return perm;

  return tryCatch(
    async () => {
      const id = generateId();
      const [row] = await db
        .insert(correspondenceRecords)
        .values({
          id,
          tenantId: ctx.tenantId,
          locationId: data.locationId,
          direction: data.direction,
          documentNo: data.documentNo,
          subject: data.subject,
          counterparty: data.counterparty ?? null,
          documentDate: data.documentDate,
          dueDate: data.dueDate ?? null,
          channel: data.channel,
          classification: data.classification,
          priority: data.priority,
          status: data.direction === 'outgoing' ? 'draft' : 'registered',
          ownerUserId: data.ownerUserId ?? null,
          summary: data.summary ?? null,
          storageUrl: data.storageUrl ?? null,
          tags: data.tags,
          agendaNo: `AGD-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
          attachments: data.attachments,
          dispositions: data.dispositions,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();
      await insertAudit(ctx, 'create', id, null, row);
      return toResult(row!);
    },
    (e) => AppError.internal('correspondence.createFailed', e),
  );
}

export async function listCorrespondence(
  input: Partial<ListCorrespondenceInput>,
  ctx: AuditContext,
): Promise<Result<{ items: CorrespondenceRecord[]; total: number }>> {
  const parsed = ListCorrespondenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('correspondence.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;
  const locationScope = data.locationId ?? scopedLocation(ctx.locationId);
  const perm = await requirePermission(
    ctx.userId,
    'correspondence.view',
    locationScope ? { locationId: locationScope } : undefined,
  );
  if (!perm.ok) return perm;

  return tryCatch(
    async () => {
      const conditions = [
        eq(correspondenceRecords.tenantId, ctx.tenantId),
        isNull(correspondenceRecords.deletedAt),
      ];
      if (data.status) conditions.push(eq(correspondenceRecords.status, data.status));
      if (data.direction) conditions.push(eq(correspondenceRecords.direction, data.direction));
      if (data.classification)
        conditions.push(eq(correspondenceRecords.classification, data.classification));
      if (locationScope) conditions.push(eq(correspondenceRecords.locationId, locationScope));
      const whereClause = and(...conditions);
      const [{ count = 0 } = { count: 0 }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(correspondenceRecords)
        .where(whereClause);
      const rows = await db
        .select()
        .from(correspondenceRecords)
        .where(whereClause)
        .orderBy(desc(correspondenceRecords.documentDate), desc(correspondenceRecords.createdAt))
        .limit(data.limit)
        .offset(data.offset);
      return { items: rows.map(toResult), total: count };
    },
    (e) => AppError.internal('correspondence.listFailed', e),
  );
}

export async function getCorrespondence(
  id: string,
  ctx: AuditContext,
): Promise<Result<CorrespondenceRecord>> {
  const row = await db
    .select()
    .from(correspondenceRecords)
    .where(
      and(
        eq(correspondenceRecords.id, id),
        eq(correspondenceRecords.tenantId, ctx.tenantId),
        isNull(correspondenceRecords.deletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!row) return err(AppError.notFound('correspondence.notFound'));
  const perm = await requirePermission(ctx.userId, 'correspondence.view', {
    locationId: row.locationId,
  });
  if (!perm.ok) return perm;
  return ok(toResult(row));
}

export async function updateCorrespondence(
  id: string,
  input: UpdateCorrespondenceInput,
  ctx: AuditContext,
): Promise<Result<CorrespondenceRecord>> {
  const parsed = UpdateCorrespondenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('correspondence.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const current = await db
    .select()
    .from(correspondenceRecords)
    .where(
      and(
        eq(correspondenceRecords.id, id),
        eq(correspondenceRecords.tenantId, ctx.tenantId),
        isNull(correspondenceRecords.deletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!current) return err(AppError.notFound('correspondence.notFound'));

  const perm = await requirePermission(ctx.userId, 'correspondence.update', {
    locationId: parsed.data.locationId ?? current.locationId,
  });
  if (!perm.ok) return perm;

  return tryCatch(
    async () => {
      const data = parsed.data;
      const [row] = await db
        .update(correspondenceRecords)
        .set({
          ...(data.locationId !== undefined && { locationId: data.locationId }),
          ...(data.direction !== undefined && { direction: data.direction }),
          ...(data.documentNo !== undefined && { documentNo: data.documentNo }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.counterparty !== undefined && { counterparty: data.counterparty ?? null }),
          ...(data.documentDate !== undefined && { documentDate: data.documentDate }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate ?? null }),
          ...(data.channel !== undefined && { channel: data.channel }),
          ...(data.classification !== undefined && { classification: data.classification }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.ownerUserId !== undefined && { ownerUserId: data.ownerUserId ?? null }),
          ...(data.summary !== undefined && { summary: data.summary ?? null }),
          ...(data.storageUrl !== undefined && { storageUrl: data.storageUrl ?? null }),
          ...(data.tags !== undefined && { tags: data.tags }),
          ...(data.attachments !== undefined && { attachments: data.attachments }),
          ...(data.dispositions !== undefined && { dispositions: data.dispositions }),
          updatedBy: ctx.userId,
          updatedAt: new Date(),
          version: sql`${correspondenceRecords.version} + 1`,
        })
        .where(
          and(eq(correspondenceRecords.id, id), eq(correspondenceRecords.tenantId, ctx.tenantId)),
        )
        .returning();
      await insertAudit(ctx, 'update', id, toResult(current), row ? toResult(row) : null);
      return toResult(row!);
    },
    (e) => AppError.internal('correspondence.updateFailed', e),
  );
}

export async function deleteCorrespondence(id: string, ctx: AuditContext): Promise<Result<true>> {
  const current = await db
    .select()
    .from(correspondenceRecords)
    .where(
      and(
        eq(correspondenceRecords.id, id),
        eq(correspondenceRecords.tenantId, ctx.tenantId),
        isNull(correspondenceRecords.deletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!current) return err(AppError.notFound('correspondence.notFound'));
  const perm = await requirePermission(ctx.userId, 'correspondence.delete', {
    locationId: current.locationId,
  });
  if (!perm.ok) return perm;

  return tryCatch(
    async () => {
      await db
        .update(correspondenceRecords)
        .set({
          deletedAt: new Date(),
          status: 'archived',
          updatedAt: new Date(),
          updatedBy: ctx.userId,
          version: sql`${correspondenceRecords.version} + 1`,
        })
        .where(
          and(eq(correspondenceRecords.id, id), eq(correspondenceRecords.tenantId, ctx.tenantId)),
        );
      await insertAudit(ctx, 'delete', id, toResult(current), {
        deletedAt: 'now',
        status: 'archived',
      });
      return true as const;
    },
    (e) => AppError.internal('correspondence.deleteFailed', e),
  );
}
