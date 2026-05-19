'use server';

import { getSession } from '@/lib/auth';
import { db, eq, and, count } from '@erp/db';
import { products } from '@erp/db/schema/inventory';
import { createCategory, listCategories, updateCategory } from '@erp/services/inventory';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

function slugCode(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (slug || `category_${Date.now()}`).slice(0, 32);
}

async function getAuditContext(): Promise<AuditContext> {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthenticated');

  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export interface CategoryWithCount {
  id: string;
  code: string;
  name: { id: string; en: string; zh: string };
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export async function fetchCategories(): Promise<CategoryWithCount[]> {
  const ctx = await getAuditContext();
  const result = await listCategories(ctx);
  if (!result.ok) return [];

  const activeCategories = result.value.filter((category) => category.isActive);

  // Get product counts per category
  const categoryIds = activeCategories.map((c) => c.id);
  if (categoryIds.length === 0) return [];

  const countRows = await db
    .select({ categoryId: products.categoryId, count: count() })
    .from(products)
    .where(and(eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)))
    .groupBy(products.categoryId);

  const countMap = new Map(countRows.map((r) => [r.categoryId, r.count]));

  return activeCategories.map((cat) => ({
    ...cat,
    productCount: countMap.get(cat.id) ?? 0,
  }));
}

export async function createCategoryAction(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error('Category name is required');

  const ctx = await getAuditContext();
  const result = await createCategory(
    {
      code: slugCode(normalized),
      name: { id: normalized, en: normalized, zh: normalized },
      sortOrder: 0,
    },
    ctx,
  );
  if (!result.ok) throw new Error(result.error.message);

  revalidatePath('/inventory/categories');
}

export async function deleteCategoryAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuditContext();

  // Check if category has active products — prevent deletion
  const [productRow] = await db
    .select({ count: count() })
    .from(products)
    .where(and(eq(products.categoryId, id), eq(products.tenantId, ctx.tenantId), eq(products.isActive, true)));

  if (productRow && productRow.count > 0) {
    return { ok: false, error: `Category has ${productRow.count} active product(s). Move or deactivate them first.` };
  }

  // product_categories has no `version` column — schema requires `min(1)`
  // but no real optimistic-lock check is performed by the service.
  const result = await updateCategory({ categoryId: id, isActive: false, version: 1 }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };

  revalidatePath('/inventory/categories');
  return { ok: true };
}

export async function updateCategoryNameAction(
  id: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const normalized = name.trim();
  if (!normalized) return { ok: false, error: 'Category name is required.' };

  const ctx = await getAuditContext();
  const result = await updateCategory(
    {
      categoryId: id,
      name: { id: normalized, en: normalized, zh: normalized },
      version: 1,
    },
    ctx,
  );
  if (!result.ok) return { ok: false, error: result.error.message };

  revalidatePath('/inventory/categories');
  return { ok: true };
}
