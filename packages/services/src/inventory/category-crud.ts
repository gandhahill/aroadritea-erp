/**
 * inventory.createCategory / updateCategory / listCategories — SD §9.3
 *
 * Category CRUD for organizing products.
 * Permission: inventory.category.create / .update / .read
 */

import { db } from '@erp/db';
import { productCategories } from '@erp/db/schema/inventory';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import {
  type CreateCategoryInput,
  CreateCategoryInputSchema,
  type UpdateCategoryInput,
  UpdateCategoryInputSchema,
} from './schemas';

// --- Types ---

export interface CategoryResult {
  id: string;
  code: string;
  name: { id: string; en: string; zh: string };
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  version: number;
}

export interface CategoryTreeItem extends CategoryResult {
  children: CategoryTreeItem[];
}

// --- Create category ---

export async function createCategory(
  input: CreateCategoryInput,
  ctx: AuditContext,
): Promise<Result<CategoryResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.category.create', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = CreateCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.category.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  // Check code uniqueness
  const [existing] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.tenantId, ctx.tenantId), eq(productCategories.code, data.code)))
    .limit(1);

  if (existing) {
    return err(AppError.conflict('inventory.category.codeDuplicate', { code: data.code }));
  }

  // Validate parent if provided
  if (data.parentId) {
    const [parent] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(eq(productCategories.tenantId, ctx.tenantId), eq(productCategories.id, data.parentId)),
      )
      .limit(1);

    if (!parent) {
      return err(
        AppError.notFound('inventory.category.parentNotFound', { parentId: data.parentId }),
      );
    }
  }

  const categoryId = generateId();

  return tryCatch(
    async () => {
      await db.insert(productCategories).values({
        id: categoryId,
        tenantId: ctx.tenantId,
        code: data.code,
        name: data.name,
        parentId: data.parentId ?? null,
        sortOrder: data.sortOrder,
        isActive: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      await auditRecord({
        action: 'create',
        entityType: 'product_category',
        entityId: categoryId,
        before: null,
        after: { id: categoryId, code: data.code, name: data.name },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: categoryId,
        code: data.code,
        name: data.name,
        parentId: data.parentId ?? null,
        sortOrder: data.sortOrder,
        isActive: true,
        version: 1,
      } satisfies CategoryResult;
    },
    (e) => AppError.internal('inventory.category.createFailed', e),
  );
}

// --- Update category ---

export async function updateCategory(
  input: UpdateCategoryInput,
  ctx: AuditContext,
): Promise<Result<CategoryResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.category.update', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  const parsed = UpdateCategoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('inventory.category.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  // Fetch existing
  const [existing] = await db
    .select()
    .from(productCategories)
    .where(
      and(eq(productCategories.tenantId, ctx.tenantId), eq(productCategories.id, data.categoryId)),
    )
    .limit(1);

  if (!existing) {
    return err(AppError.notFound('inventory.category.notFound', { categoryId: data.categoryId }));
  }

  if (existing.version !== data.version) {
    return err(AppError.conflict('inventory.category.versionConflict', { message: 'Category was modified by someone else' }));
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: ctx.userId,
    version: existing.version + 1,
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.parentId !== undefined) updates.parentId = data.parentId;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  return tryCatch(
    async () => {
      // Tenant-scope the update too (defense-in-depth, even though the
      // existing-row fetch above already verified ownership).
      const [updated] = await db
        .update(productCategories)
        .set(updates)
        .where(
          and(
            eq(productCategories.id, data.categoryId),
            eq(productCategories.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      if (!updated) {
        throw AppError.internal('inventory.category.updateFailed');
      }

      // Determine audit action: if isActive goes from true→false, it's a soft-delete
      const auditAction =
        data.isActive === false && existing.isActive === true ? 'delete' : 'update';

      await auditRecord({
        action: auditAction,
        entityType: 'product_category',
        entityId: data.categoryId,
        before: { code: existing.code, name: existing.name, isActive: existing.isActive },
        after: updates,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: updated.id,
        code: updated.code,
        name: updated.name as { id: string; en: string; zh: string },
        parentId: updated.parentId,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        version: updated.version,
      } satisfies CategoryResult;
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('inventory.category.updateFailed', e);
    },
  );
}

// --- List categories (flat list + tree builder) ---

export async function listCategories(ctx: AuditContext): Promise<Result<CategoryResult[]>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.category.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const rows = await db
        .select({
          id: productCategories.id,
          code: productCategories.code,
          name: productCategories.name,
          parentId: productCategories.parentId,
          sortOrder: productCategories.sortOrder,
          isActive: productCategories.isActive,
          version: productCategories.version,
        })
        .from(productCategories)
        .where(eq(productCategories.tenantId, ctx.tenantId))
        .orderBy(productCategories.sortOrder, productCategories.code);

      return rows.map((r) => ({
        ...r,
        name: r.name as { id: string; en: string; zh: string },
      }));
    },
    (e) => AppError.internal('inventory.category.listFailed', e),
  );
}

/**
 * Build a tree from flat category list (utility function for UI).
 */
export function buildCategoryTree(categories: CategoryResult[]): CategoryTreeItem[] {
  const map = new Map<string, CategoryTreeItem>();
  const roots: CategoryTreeItem[] = [];

  // Initialize all nodes
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  // Build tree
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
