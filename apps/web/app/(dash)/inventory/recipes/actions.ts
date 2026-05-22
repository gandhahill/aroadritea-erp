'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, isNull, sql } from '@erp/db';
import { auditLog } from '@erp/db/schema/audit';
import { bomLines, boms, products } from '@erp/db/schema/inventory';
import { requirePermission } from '@erp/services/iam';
import { generateId } from '@erp/shared/id';
import { revalidatePath } from 'next/cache';

async function ctx() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
  };
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  uom: string;
  kind: string;
}

export interface RecipeRow {
  bomId: string;
  productId: string;
  productSku: string;
  productName: string;
  variantId: string | null;
  description: string | null;
  lineCount: number;
  isActive: boolean;
}

export interface RecipeLineRow {
  id: string;
  lineNo: number;
  ingredientId: string;
  ingredientSku: string;
  ingredientName: string;
  qty: string;
  uom: string;
  isOptional: boolean;
  autoDeduct: boolean;
}

function pickName(name: unknown, fallback: string): string {
  if (!name) return fallback;
  if (typeof name === 'string') return name;
  if (typeof name !== 'object') return fallback;
  const obj = name as Record<string, string>;
  return obj.id ?? obj.en ?? obj.zh ?? fallback;
}

export async function fetchRecipes(): Promise<{
  recipes: RecipeRow[];
  finishedGoods: ProductOption[];
  ingredients: ProductOption[];
}> {
  const c = await ctx();
  if (!c) return { recipes: [], finishedGoods: [], ingredients: [] };

  const bomRows = await db
    .select({
      id: boms.id,
      productId: boms.productId,
      variantId: boms.variantId,
      description: boms.description,
      isActive: boms.isActive,
      productName: products.name,
      productSku: products.sku,
    })
    .from(boms)
    .leftJoin(products, and(eq(boms.productId, products.id), eq(products.tenantId, c.tenantId)))
    .where(and(eq(boms.tenantId, c.tenantId), isNull(boms.deletedAt)));

  const counts = await db
    .select({
      bomId: bomLines.bomId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(bomLines)
    .groupBy(bomLines.bomId);
  const countMap = new Map(counts.map((r) => [r.bomId, r.count]));

  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      uom: products.uom,
      kind: products.kind,
      isActive: products.isActive,
    })
    .from(products)
    .where(and(eq(products.tenantId, c.tenantId), eq(products.isActive, true)))
    .orderBy(products.sku);

  const finishedGoods: ProductOption[] = productRows
    .filter((p) => p.kind === 'finished_good')
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: pickName(p.name, p.sku),
      uom: p.uom,
      kind: p.kind,
    }));
  const ingredients: ProductOption[] = productRows
    .filter((p) => p.kind === 'raw_material' || p.kind === 'consumable' || p.kind === 'merchandise')
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: pickName(p.name, p.sku),
      uom: p.uom,
      kind: p.kind,
    }));

  const recipes: RecipeRow[] = bomRows.map((b) => ({
    bomId: b.id,
    productId: b.productId,
    productSku: b.productSku ?? '—',
    productName: pickName(b.productName, b.productSku ?? '—'),
    variantId: b.variantId,
    description: b.description,
    lineCount: countMap.get(b.id) ?? 0,
    isActive: b.isActive,
  }));

  return { recipes, finishedGoods, ingredients };
}

export async function fetchRecipeLines(bomId: string): Promise<RecipeLineRow[]> {
  const c = await ctx();
  if (!c) return [];
  const rows = await db
    .select({
      id: bomLines.id,
      lineNo: bomLines.lineNo,
      ingredientId: bomLines.ingredientId,
      qty: bomLines.qty,
      uom: bomLines.uom,
      isOptional: bomLines.isOptional,
      autoDeduct: bomLines.autoDeduct,
      ingredientSku: products.sku,
      ingredientName: products.name,
    })
    .from(bomLines)
    .leftJoin(
      products,
      and(eq(bomLines.ingredientId, products.id), eq(products.tenantId, c.tenantId)),
    )
    .where(eq(bomLines.bomId, bomId));
  return rows
    .sort((a, b) => a.lineNo - b.lineNo)
    .map((r) => ({
      id: r.id,
      lineNo: r.lineNo,
      ingredientId: r.ingredientId,
      ingredientSku: r.ingredientSku ?? '—',
      ingredientName: pickName(r.ingredientName, r.ingredientSku ?? '—'),
      qty: String(r.qty ?? '0'),
      uom: r.uom,
      isOptional: r.isOptional,
      autoDeduct: r.autoDeduct,
    }));
}

export async function createRecipeAction(input: {
  productId: string;
  variantId?: string | null;
  description?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(c.userId, 'inventory.product.update');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  if (!input.productId) return { ok: false, error: 'Produk wajib dipilih.' };

  const id = generateId();
  await db.insert(boms).values({
    id,
    tenantId: c.tenantId,
    productId: input.productId,
    variantId: input.variantId || null,
    bomVersion: 1,
    description: input.description?.trim() || null,
    isActive: true,
    createdBy: c.userId,
    updatedBy: c.userId,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: c.tenantId,
    userId: c.userId,
    action: 'create',
    entityType: 'bom',
    entityId: id,
    after: {
      productId: input.productId,
      variantId: input.variantId || null,
      description: input.description?.trim() || null,
    },
  });

  revalidatePath('/inventory/recipes');
  return { ok: true, id };
}

export async function addRecipeLineAction(input: {
  bomId: string;
  ingredientId: string;
  qty: string;
  uom: string;
  isOptional?: boolean;
  autoDeduct?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(c.userId, 'inventory.product.update');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  if (!input.bomId || !input.ingredientId) return { ok: false, error: 'Data tidak lengkap.' };
  const qtyNum = Number(input.qty);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return { ok: false, error: 'Qty harus angka positif.' };
  }

  const existing = await db
    .select({ lineNo: bomLines.lineNo })
    .from(bomLines)
    .where(eq(bomLines.bomId, input.bomId));
  const nextLineNo = (existing.reduce((m, r) => Math.max(m, r.lineNo), 0) || 0) + 1;

  await db.insert(bomLines).values({
    id: generateId(),
    bomId: input.bomId,
    lineNo: nextLineNo,
    ingredientId: input.ingredientId,
    qty: input.qty,
    uom: input.uom,
    isOptional: input.isOptional ?? false,
    autoDeduct: input.autoDeduct ?? true,
  });

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: c.tenantId,
    userId: c.userId,
    action: 'create',
    entityType: 'bom_line',
    entityId: input.bomId,
    after: {
      ingredientId: input.ingredientId,
      qty: input.qty,
      uom: input.uom,
      isOptional: input.isOptional ?? false,
      autoDeduct: input.autoDeduct ?? true,
    },
  });

  revalidatePath('/inventory/recipes');
  return { ok: true };
}

export async function deleteRecipeLineAction(
  lineId: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(c.userId, 'inventory.product.update');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  await db.delete(bomLines).where(eq(bomLines.id, lineId));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: c.tenantId,
    userId: c.userId,
    action: 'delete',
    entityType: 'bom_line',
    entityId: lineId,
  });

  revalidatePath('/inventory/recipes');
  return { ok: true };
}

export async function deleteRecipeAction(bomId: string): Promise<{ ok: boolean; error?: string }> {
  const c = await ctx();
  if (!c) return { ok: false, error: 'Unauthenticated' };
  const perm = await requirePermission(c.userId, 'inventory.product.update');
  if (!perm.ok) return { ok: false, error: 'Forbidden' };
  await db.delete(bomLines).where(eq(bomLines.bomId, bomId));
  await db
    .update(boms)
    .set({ deletedAt: new Date(), updatedAt: new Date(), updatedBy: c.userId })
    .where(eq(boms.id, bomId));

  await db.insert(auditLog).values({
    id: generateId(),
    tenantId: c.tenantId,
    userId: c.userId,
    action: 'delete',
    entityType: 'bom',
    entityId: bomId,
  });

  revalidatePath('/inventory/recipes');
  return { ok: true };
}
