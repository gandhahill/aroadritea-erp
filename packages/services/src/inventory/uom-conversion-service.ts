/**
 * inventory.uomConversions — T-0297
 *
 * CRUD for the uom_conversions table that backs convertQty/toProductUom
 * (T-0295): a registered conversion is the only way a document line entered
 * in a unit other than the product master uom can be accepted into stock.
 *
 * Permission: inventory.product.read (list) / inventory.product.update (write)
 * — conversions are product master data.
 */

import { db } from '@erp/db';
import { products, uomConversions } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { normalizeUom } from './uom-service';

const UpsertUomConversionInputSchema = z.object({
  conversionId: z.string().min(1).optional(),
  productId: z.string().min(1).nullable().optional(),
  fromUom: z.string().min(1).max(32),
  toUom: z.string().min(1).max(32),
  /** fromUom × multiplyBy = toUom; positive decimal string (e.g. "25", "0.001"). */
  multiplyBy: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'multiplyBy must be a positive decimal string')
    .refine((value) => Number.parseFloat(value) > 0, 'multiplyBy must be > 0'),
});
export type UpsertUomConversionInput = z.infer<typeof UpsertUomConversionInputSchema>;

export interface UomConversionResult {
  id: string;
  productId: string | null;
  productSku: string | null;
  productName: unknown;
  fromUom: string;
  toUom: string;
  multiplyBy: string;
  updatedAt: string;
}

export async function listUomConversions(
  ctx: AuditContext,
): Promise<Result<UomConversionResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const rows = await db
    .select({
      id: uomConversions.id,
      productId: uomConversions.productId,
      productSku: products.sku,
      productName: products.name,
      fromUom: uomConversions.fromUom,
      toUom: uomConversions.toUom,
      multiplyBy: uomConversions.multiplyBy,
      updatedAt: uomConversions.updatedAt,
    })
    .from(uomConversions)
    .leftJoin(products, eq(products.id, uomConversions.productId))
    .where(and(eq(uomConversions.tenantId, ctx.tenantId), isNull(uomConversions.deletedAt)))
    .orderBy(desc(uomConversions.updatedAt));

  return ok(
    rows.map((row) => ({
      ...row,
      productName: row.productName ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  );
}

export async function upsertUomConversion(
  input: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = UpsertUomConversionInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.uomConversions.validationFailed', {
        issues: parsed.error.issues,
      }),
    );
  }
  const data = parsed.data;

  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const fromUom = normalizeUom(data.fromUom);
  const toUom = normalizeUom(data.toUom);
  if (fromUom === toUom) {
    return err(AppError.businessRule('inventory.uomConversions.sameUom', { fromUom, toUom }));
  }

  const productId = data.productId ?? null;
  if (productId) {
    const product = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, ctx.tenantId), eq(products.id, productId)))
      .then((r) => r[0]);
    if (!product) {
      return err(AppError.notFound('inventory.uomConversions.productNotFound', { productId }));
    }
  }

  // Reject a duplicate pair (either direction — convertQty resolves inverses).
  const existingRows = await db
    .select({ id: uomConversions.id, fromUom: uomConversions.fromUom, toUom: uomConversions.toUom })
    .from(uomConversions)
    .where(
      and(
        eq(uomConversions.tenantId, ctx.tenantId),
        productId ? eq(uomConversions.productId, productId) : isNull(uomConversions.productId),
        isNull(uomConversions.deletedAt),
      ),
    );
  const duplicate = existingRows.find(
    (row) =>
      row.id !== data.conversionId &&
      ((row.fromUom === fromUom && row.toUom === toUom) ||
        (row.fromUom === toUom && row.toUom === fromUom)),
  );
  if (duplicate) {
    return err(
      AppError.businessRule('inventory.uomConversions.duplicate', { fromUom, toUom, productId }),
    );
  }

  const now = new Date();
  if (data.conversionId) {
    const existing = await db
      .select()
      .from(uomConversions)
      .where(
        and(
          eq(uomConversions.tenantId, ctx.tenantId),
          eq(uomConversions.id, data.conversionId),
          isNull(uomConversions.deletedAt),
        ),
      )
      .then((r) => r[0]);
    if (!existing) return err(AppError.notFound('inventory.uomConversions.notFound'));

    await db
      .update(uomConversions)
      .set({
        productId,
        fromUom,
        toUom,
        multiplyBy: data.multiplyBy,
        updatedAt: now,
        updatedBy: ctx.userId,
      })
      .where(eq(uomConversions.id, existing.id));

    await auditRecord({
      action: 'update',
      entityType: 'uom_conversion',
      entityId: existing.id,
      before: {
        productId: existing.productId,
        fromUom: existing.fromUom,
        toUom: existing.toUom,
        multiplyBy: existing.multiplyBy,
      },
      after: { productId, fromUom, toUom, multiplyBy: data.multiplyBy },
      ctx,
    });
    return ok({ id: existing.id });
  }

  const id = generateId();
  await db.insert(uomConversions).values({
    id,
    tenantId: ctx.tenantId,
    productId,
    fromUom,
    toUom,
    multiplyBy: data.multiplyBy,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await auditRecord({
    action: 'create',
    entityType: 'uom_conversion',
    entityId: id,
    before: null,
    after: { productId, fromUom, toUom, multiplyBy: data.multiplyBy },
    ctx,
  });
  return ok({ id });
}

export async function deleteUomConversion(
  conversionId: string,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const existing = await db
    .select()
    .from(uomConversions)
    .where(
      and(
        eq(uomConversions.tenantId, ctx.tenantId),
        eq(uomConversions.id, conversionId),
        isNull(uomConversions.deletedAt),
      ),
    )
    .then((r) => r[0]);
  if (!existing) return err(AppError.notFound('inventory.uomConversions.notFound'));

  // Hard delete: the (tenant, product, from, to) unique index would block
  // re-creating the same pair after a soft delete; the audit record below
  // preserves the history.
  await db.delete(uomConversions).where(eq(uomConversions.id, conversionId));

  await auditRecord({
    action: 'delete',
    entityType: 'uom_conversion',
    entityId: conversionId,
    before: {
      productId: existing.productId,
      fromUom: existing.fromUom,
      toUom: existing.toUom,
      multiplyBy: existing.multiplyBy,
    },
    after: { deleted: true },
    ctx,
  });
  return ok({ id: conversionId });
}
