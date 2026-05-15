'use server';

import { getSession } from '@/lib/auth';
import { db, eq } from '@erp/db';
import { productCategories } from '@erp/db/schema/inventory';
import { generateId } from '@erp/shared/id';

export async function fetchCategories() {
  const session = await getSession();
  const tenantId = ((session?.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  
  return db
    .select({
      id: productCategories.id,
      name: productCategories.name,
      sortOrder: productCategories.sortOrder,
    })
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId))
    .orderBy(productCategories.sortOrder);
}

export async function createCategoryAction(name: string) {
  const session = await getSession();
  const tenantId = ((session?.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  
  await db.insert(productCategories).values({
    id: generateId(),
    tenantId,
    name: { id: name, en: name, zh: name },
    sortOrder: 0,
  });
}

export async function deleteCategoryAction(id: string) {
  const session = await getSession();
  const tenantId = ((session?.user as Record<string, unknown>)?.tenantId as string) ?? 'default';
  
  await db.delete(productCategories)
    .where(eq(productCategories.id, id))
    .where(eq(productCategories.tenantId, tenantId));
}
