'use server';

import { getSession } from '@/lib/auth';
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

export async function fetchCategories() {
  const ctx = await getAuditContext();
  const result = await listCategories(ctx);
  if (!result.ok) return [];
  return result.value.filter((category) => category.isActive);
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

export async function deleteCategoryAction(id: string) {
  const ctx = await getAuditContext();
  const result = await updateCategory({ categoryId: id, isActive: false, version: 1 }, ctx);
  if (!result.ok) throw new Error(result.error.message);

  revalidatePath('/inventory/categories');
}
