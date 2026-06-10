/**
 * SOP service — User Req 2 (2026-05-24).
 *
 * Management uploads procedures, employees read them. The file itself
 * lives in `apps/web/storage/uploads/private/sop/...` via the existing
 * upload route; this service only manages the SOP metadata row.
 *
 * Permissions:
 *  - hr.sop.manage — create / update / delete / publish / archive
 *  - hr.sop.read   — list + download
 *
 * Every mutation writes to `audit_log` via auditRecord so SOP changes
 * remain traceable (operational accountability).
 */

import { and, db, desc, eq, ilike, inArray, isNull, or, sql } from '@erp/db';
import { sopDocuments } from '@erp/db/schema/sop';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

const SOP_CATEGORIES = ['general', 'operations', 'hr', 'finance', 'safety', 'service'] as const;

export const CreateSopInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(SOP_CATEGORIES).optional().default('general'),
  locationId: z.string().min(1).optional(),
  fileKey: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  fileSize: z.number().int().nonnegative(),
  publish: z.boolean().optional().default(false),
});
/**
 * Use `z.input<>` here so callers may omit `category`/`publish` and let
 * the schema apply its defaults — `z.infer<>` would require those
 * fields and force every action wrapper to pass them.
 */
export type CreateSopInput = z.input<typeof CreateSopInputSchema>;

export const UpdateSopInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(SOP_CATEGORIES).optional(),
  locationId: z.string().min(1).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});
export type UpdateSopInput = z.infer<typeof UpdateSopInputSchema>;

export const ListSopInputSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category: z.enum(SOP_CATEGORIES).optional(),
  locationId: z.string().min(1).optional(),
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListSopInput = z.infer<typeof ListSopInputSchema>;

export interface SopRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  locationId: string | null;
  fileKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  publishedAt: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

function rowOf(raw: typeof sopDocuments.$inferSelect): SopRow {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    category: raw.category,
    locationId: raw.locationId ?? null,
    fileKey: raw.fileKey,
    fileName: raw.fileName,
    mimeType: raw.mimeType,
    fileSize: Number(raw.fileSize),
    status: raw.status,
    publishedAt: raw.publishedAt,
    version: raw.version,
    createdAt: raw.createdAt!,
    updatedAt: raw.updatedAt!,
    createdBy: raw.createdBy,
    updatedBy: raw.updatedBy,
  };
}

export async function listSopDocuments(
  input: ListSopInput,
  ctx: AuditContext,
): Promise<Result<{ items: SopRow[]; total: number }>> {
  const parsed = ListSopInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.sop.validationFailed', { issues: parsed.error.issues }));
  }
  const { getAuthorizedLocations } = await import('../iam/permission-engine');
  const authLocs = await getAuthorizedLocations(ctx.userId, 'hr.sop.read');

  if (authLocs.scope === 'location' && authLocs.locationIds.length === 0) {
    return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.read' }));
  }

  const data = parsed.data;
  const conditions = [eq(sopDocuments.tenantId, ctx.tenantId), isNull(sopDocuments.deletedAt)];
  if (data.status) conditions.push(eq(sopDocuments.status, data.status));
  if (data.category) conditions.push(eq(sopDocuments.category, data.category));

  if (authLocs.scope === 'location') {
    if (data.locationId) {
      if (!authLocs.locationIds.includes(data.locationId)) {
        return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.read' }));
      }
      conditions.push(
        or(eq(sopDocuments.locationId, data.locationId), isNull(sopDocuments.locationId))!,
      );
    } else {
      conditions.push(
        or(
          inArray(sopDocuments.locationId, authLocs.locationIds),
          isNull(sopDocuments.locationId),
        )!,
      );
    }
  } else {
    // Global scope
    if (data.locationId) {
      conditions.push(
        or(eq(sopDocuments.locationId, data.locationId), isNull(sopDocuments.locationId))!,
      );
    }
  }

  if (data.search) {
    const q = `%${data.search.toLowerCase()}%`;
    conditions.push(or(ilike(sopDocuments.title, q), ilike(sopDocuments.description, q))!);
  }

  const whereClause = and(...conditions);
  const [{ count = 0 } = { count: 0 }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(sopDocuments)
    .where(whereClause);

  const rows = await db
    .select()
    .from(sopDocuments)
    .where(whereClause)
    .orderBy(desc(sopDocuments.updatedAt))
    .limit(data.limit)
    .offset(data.offset);

  return ok({ items: rows.map(rowOf), total: count });
}

export async function getSopDocument(id: string, ctx: AuditContext): Promise<Result<SopRow>> {
  const { getAuthorizedLocations } = await import('../iam/permission-engine');
  const authLocs = await getAuthorizedLocations(ctx.userId, 'hr.sop.read');

  if (authLocs.scope === 'location' && authLocs.locationIds.length === 0) {
    return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.read' }));
  }

  const [row] = await db
    .select()
    .from(sopDocuments)
    .where(
      and(
        eq(sopDocuments.tenantId, ctx.tenantId),
        eq(sopDocuments.id, id),
        isNull(sopDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return err(AppError.notFound('hr.sop.notFound', { id }));

  if (authLocs.scope === 'location') {
    if (row.locationId && !authLocs.locationIds.includes(row.locationId)) {
      return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.read' }));
    }
  }

  return ok(rowOf(row));
}

export async function createSopDocument(
  input: CreateSopInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = CreateSopInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.sop.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  if (data.locationId) {
    const perm = await requirePermission(ctx.userId, 'hr.sop.manage', {
      locationId: data.locationId,
    });
    if (!perm.ok) return perm;
  } else {
    const { canGlobally } = await import('../iam/permission-engine');
    const hasGlobal = await canGlobally(ctx.userId, 'hr.sop.manage');
    if (!hasGlobal)
      return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.manage' }));
  }

  const id = generateId();
  const now = new Date();

  return tryCatch(
    async () => {
      await db.insert(sopDocuments).values({
        id,
        tenantId: ctx.tenantId,
        locationId: data.locationId ?? null,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category,
        fileKey: data.fileKey,
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        status: data.publish ? 'published' : 'draft',
        publishedAt: data.publish ? now.toISOString() : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'sop_document',
        entityId: id,
        before: null,
        after: {
          title: data.title,
          category: data.category,
          status: data.publish ? 'published' : 'draft',
          fileName: data.fileName,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id };
    },
    (e) => (e instanceof AppError ? e : AppError.internal('hr.sop.createFailed', e)),
  );
}

export async function updateSopDocument(
  input: UpdateSopInput,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpdateSopInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('hr.sop.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  const [existing] = await db
    .select()
    .from(sopDocuments)
    .where(
      and(
        eq(sopDocuments.tenantId, ctx.tenantId),
        eq(sopDocuments.id, data.id),
        isNull(sopDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) return err(AppError.notFound('hr.sop.notFound', { id: data.id }));

  const targetLocationId = data.locationId !== undefined ? data.locationId : existing.locationId;

  if (targetLocationId) {
    const perm = await requirePermission(ctx.userId, 'hr.sop.manage', {
      locationId: targetLocationId,
    });
    if (!perm.ok) return perm;
  } else {
    const { canGlobally } = await import('../iam/permission-engine');
    const hasGlobal = await canGlobally(ctx.userId, 'hr.sop.manage');
    if (!hasGlobal)
      return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.manage' }));
  }

  const now = new Date();
  const nextStatus = data.status ?? existing.status;
  const publishedAt =
    nextStatus === 'published' && !existing.publishedAt ? now.toISOString() : existing.publishedAt;

  await db
    .update(sopDocuments)
    .set({
      title: data.title?.trim() ?? existing.title,
      description:
        data.description !== undefined ? (data.description?.trim() ?? null) : existing.description,
      category: data.category ?? existing.category,
      locationId: data.locationId !== undefined ? data.locationId : existing.locationId,
      status: nextStatus,
      publishedAt,
      updatedAt: now,
      updatedBy: ctx.userId,
    })
    .where(and(eq(sopDocuments.tenantId, ctx.tenantId), eq(sopDocuments.id, data.id)));

  await auditRecord({
    action: 'update',
    entityType: 'sop_document',
    entityId: data.id,
    before: {
      title: existing.title,
      category: existing.category,
      status: existing.status,
    },
    after: {
      title: data.title ?? existing.title,
      category: data.category ?? existing.category,
      status: nextStatus,
    },
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    ctx,
  });

  return ok({ id: data.id });
}

export async function deleteSopDocument(id: string, ctx: AuditContext): Promise<Result<void>> {
  const [existing] = await db
    .select()
    .from(sopDocuments)
    .where(
      and(
        eq(sopDocuments.tenantId, ctx.tenantId),
        eq(sopDocuments.id, id),
        isNull(sopDocuments.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) return err(AppError.notFound('hr.sop.notFound', { id }));

  if (existing.locationId) {
    const perm = await requirePermission(ctx.userId, 'hr.sop.manage', {
      locationId: existing.locationId,
    });
    if (!perm.ok) return perm;
  } else {
    const { canGlobally } = await import('../iam/permission-engine');
    const hasGlobal = await canGlobally(ctx.userId, 'hr.sop.manage');
    if (!hasGlobal)
      return err(AppError.forbidden('common.errors.forbidden', { permission: 'hr.sop.manage' }));
  }

  const now = new Date();
  await db
    .update(sopDocuments)
    .set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId, status: 'archived' })
    .where(and(eq(sopDocuments.tenantId, ctx.tenantId), eq(sopDocuments.id, id)));

  await auditRecord({
    action: 'delete',
    entityType: 'sop_document',
    entityId: id,
    before: { title: existing.title, status: existing.status },
    after: { deletedAt: now.toISOString(), status: 'archived' },
    metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
    ctx,
  });

  return ok(undefined);
}
