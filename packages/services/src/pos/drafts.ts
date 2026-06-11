/**
 * pos.drafts — T-0296
 *
 * Server-side drafts for the POS manual data-entry forms (manual sales
 * closing and consumed ingredients). A draft stores the raw client form
 * state as an opaque payload; it is validated by the regular posting path
 * only when the user actually posts it. This exists so a failed posting
 * (e.g. the 2026-06-11 ingredientUomMismatch incident) never costs the
 * cashier their typed-in lines.
 *
 * Permission: pos.transact (same gate as the forms themselves).
 */

import { db } from '@erp/db';
import { posDrafts } from '@erp/db/schema/pos';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

export const PosDraftKindSchema = z.enum(['manual_sales', 'consumed_ingredients']);
export type PosDraftKind = z.infer<typeof PosDraftKindSchema>;

const SavePosDraftInputSchema = z.object({
  draftId: z.string().min(1).optional(),
  kind: PosDraftKindSchema,
  locationId: z.string().min(1),
  title: z.string().max(200).default(''),
  payload: z.record(z.string(), z.unknown()),
});
export type SavePosDraftInput = z.infer<typeof SavePosDraftInputSchema>;

export interface PosDraftResult {
  id: string;
  kind: PosDraftKind;
  locationId: string;
  title: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  createdBy: string | null;
}

function toResult(row: typeof posDrafts.$inferSelect): PosDraftResult {
  return {
    id: row.id,
    kind: row.kind as PosDraftKind,
    locationId: row.locationId,
    title: row.title,
    payload: row.payload,
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy ?? null,
  };
}

/** Create a new draft, or overwrite an existing one when draftId is given. */
export async function savePosDraft(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<PosDraftResult>> {
  const parsed = SavePosDraftInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(AppError.validation('pos.drafts.validationFailed', { issues: parsed.error.issues }));
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: data.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const now = new Date();

  if (data.draftId) {
    const existing = await db
      .select()
      .from(posDrafts)
      .where(
        and(
          eq(posDrafts.tenantId, ctx.tenantId),
          eq(posDrafts.id, data.draftId),
          eq(posDrafts.kind, data.kind),
          isNull(posDrafts.deletedAt),
        ),
      )
      .then((r) => r[0]);
    if (!existing) return err(AppError.notFound('pos.drafts.notFound'));

    const [updated] = await db
      .update(posDrafts)
      .set({
        locationId: data.locationId,
        title: data.title,
        payload: data.payload,
        updatedAt: now,
        updatedBy: ctx.userId,
        version: existing.version + 1,
      })
      .where(eq(posDrafts.id, existing.id))
      .returning();
    if (!updated) return err(AppError.notFound('pos.drafts.notFound'));

    await auditRecord({
      action: 'update',
      entityType: 'pos_draft',
      entityId: existing.id,
      before: { title: existing.title, locationId: existing.locationId },
      after: { title: data.title, locationId: data.locationId, kind: data.kind },
      ctx,
    });
    return ok(toResult(updated));
  }

  const id = generateId();
  const [inserted] = await db
    .insert(posDrafts)
    .values({
      id,
      tenantId: ctx.tenantId,
      locationId: data.locationId,
      kind: data.kind,
      title: data.title,
      payload: data.payload,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  if (!inserted) return err(AppError.internal('pos.drafts.saveFailed'));

  await auditRecord({
    action: 'create',
    entityType: 'pos_draft',
    entityId: id,
    before: null,
    after: { kind: data.kind, title: data.title, locationId: data.locationId },
    ctx,
  });
  return ok(toResult(inserted));
}

/** List active drafts of one kind for the tenant, newest first. */
export async function listPosDrafts(
  kind: PosDraftKind,
  ctx: AuditContext,
): Promise<Result<PosDraftResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const rows = await db
    .select()
    .from(posDrafts)
    .where(
      and(
        eq(posDrafts.tenantId, ctx.tenantId),
        eq(posDrafts.kind, kind),
        isNull(posDrafts.deletedAt),
      ),
    )
    .orderBy(desc(posDrafts.updatedAt))
    .limit(50);

  return ok(rows.map(toResult));
}

/** Soft-delete a draft (used by the Hapus button and after a successful post). */
export async function deletePosDraft(
  draftId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const existing = await db
    .select()
    .from(posDrafts)
    .where(
      and(
        eq(posDrafts.tenantId, ctx.tenantId),
        eq(posDrafts.id, draftId),
        isNull(posDrafts.deletedAt),
      ),
    )
    .then((r) => r[0]);
  if (!existing) return err(AppError.notFound('pos.drafts.notFound'));

  const permCheck = await requirePermission(ctx.userId, 'pos.transact', {
    locationId: existing.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const now = new Date();
  await db
    .update(posDrafts)
    .set({ deletedAt: now, updatedAt: now, updatedBy: ctx.userId })
    .where(eq(posDrafts.id, draftId));

  await auditRecord({
    action: 'delete',
    entityType: 'pos_draft',
    entityId: draftId,
    before: { kind: existing.kind, title: existing.title },
    after: { deleted: true },
    ctx,
  });
  return ok({ id: draftId });
}
