'use server';

import { getSession } from '@/lib/auth';
import { and, count, db, eq } from '@erp/db';
import { productCategories, products } from '@erp/db/schema/inventory';
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

export async function createCategoryAction(formData: FormData) {
  const ctx = await getAuditContext();

  const code = String(formData.get('categoryCode') ?? '').trim();
  const nameId = String(formData.get('categoryNameId') ?? '').trim();
  const nameEn = String(formData.get('categoryNameEn') ?? '').trim();
  const nameZh = String(formData.get('categoryNameZh') ?? '').trim();

  if (!code || !nameId) {
    return { ok: false, error: 'Code and Name ID are required' };
  }

  const result = await createCategory(
    {
      code,
      name: { id: nameId, en: nameEn || nameId, zh: nameZh || nameId },
      sortOrder: 0,
    },
    ctx,
  );

  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }

  revalidatePath('/inventory/categories');
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAuditContext();

  // Check if category has active products — prevent deletion
  const [productRow] = await db
    .select({ count: count() })
    .from(products)
    .where(
      and(
        eq(products.categoryId, id),
        eq(products.tenantId, ctx.tenantId),
        eq(products.isActive, true),
      ),
    );

  if (productRow && productRow.count > 0) {
    return {
      ok: false,
      error: `Category has ${productRow.count} active product(s). Move or deactivate them first.`,
    };
  }

  const [cat] = await db
    .select({ version: productCategories.version })
    .from(productCategories)
    .where(and(eq(productCategories.id, id), eq(productCategories.tenantId, ctx.tenantId)))
    .limit(1);
  if (!cat) return { ok: false, error: 'Category not found.' };

  const result = await updateCategory(
    { categoryId: id, isActive: false, version: cat.version },
    ctx,
  );
  if (!result.ok) return { ok: false, error: result.error.message };

  revalidatePath('/inventory/categories');
  return { ok: true };
}

export async function updateCategoryAction(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const code = String(formData.get('categoryCode') ?? '').trim();
  const nameId = String(formData.get('categoryNameId') ?? '').trim();
  const nameEn = String(formData.get('categoryNameEn') ?? '').trim();
  const nameZh = String(formData.get('categoryNameZh') ?? '').trim();

  if (!code || !nameId) {
    return { ok: false, error: 'Code and Name ID are required.' };
  }

  const ctx = await getAuditContext();
  const [cat] = await db
    .select({ version: productCategories.version })
    .from(productCategories)
    .where(and(eq(productCategories.id, id), eq(productCategories.tenantId, ctx.tenantId)))
    .limit(1);
  if (!cat) return { ok: false, error: 'Category not found.' };

  const result = await updateCategory(
    {
      categoryId: id,
      code,
      name: { id: nameId, en: nameEn || nameId, zh: nameZh || nameId },
      version: cat.version,
    },
    ctx,
  );
  if (!result.ok) return { ok: false, error: result.error.message };

  revalidatePath('/inventory/categories');
  return { ok: true };
}
