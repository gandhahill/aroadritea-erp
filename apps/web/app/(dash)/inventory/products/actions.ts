'use server';

import { getSession } from '@/lib/auth';
import {
  createCategory,
  createProduct,
  createVariant,
  getProduct,
  listCategories,
  listProducts,
  updateProduct,
  updateVariant,
} from '@erp/services/inventory';
import type { CategoryResult, ProductDetailResult, ProductListItem } from '@erp/services/inventory';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';

export interface ProductMasterData {
  products: ProductListItem[];
  total: number;
  categories: CategoryResult[];
  error?: string;
}

export interface ActionState {
  ok?: boolean;
  error?: string;
  productId?: string;
}

async function getAuditContext(): Promise<AuditContext | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : undefined;
}

function money(formData: FormData, key: string) {
  const value = text(formData, key).replace(/[^\d]/g, '');
  return value.length > 0 ? value : '0';
}

function productKind(formData: FormData): ProductKind {
  const value = text(formData, 'kind');
  if (
    value === 'raw_material' ||
    value === 'merchandise' ||
    value === 'consumable' ||
    value === 'service'
  ) {
    return value;
  }
  return 'finished_good';
}

function positiveNumber(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function localeName(formData: FormData, prefix: string) {
  const id = text(formData, `${prefix}Id`);
  const en = optionalText(formData, `${prefix}En`) ?? id;
  const zh = optionalText(formData, `${prefix}Zh`) ?? id;
  return { id, en, zh };
}

function nullableLocaleDescription(formData: FormData) {
  const id = optionalText(formData, 'descriptionId');
  const en = optionalText(formData, 'descriptionEn') ?? id;
  const zh = optionalText(formData, 'descriptionZh') ?? id;
  return id ? { id, en: en ?? id, zh: zh ?? id } : undefined;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export async function fetchProductMasterData(search?: string): Promise<ProductMasterData> {
  const ctx = await getAuditContext();
  if (!ctx) return { products: [], total: 0, categories: [], error: 'Unauthenticated' };

  const [categoryResult, productResult] = await Promise.all([
    listCategories(ctx),
    listProducts({ search, limit: 200, offset: 0 }, ctx),
  ]);

  return {
    categories: categoryResult.ok ? categoryResult.value : [],
    products: productResult.ok ? productResult.value.items : [],
    total: productResult.ok ? productResult.value.total : 0,
    error: !categoryResult.ok
      ? errorMessage(categoryResult.error)
      : !productResult.ok
        ? errorMessage(productResult.error)
        : undefined,
  };
}

export async function fetchProductDetail(productId: string): Promise<{
  product: ProductDetailResult | null;
  categories: CategoryResult[];
  error?: string;
}> {
  const ctx = await getAuditContext();
  if (!ctx) return { product: null, categories: [], error: 'Unauthenticated' };

  const [categoryResult, productResult] = await Promise.all([
    listCategories(ctx),
    getProduct(productId, ctx),
  ]);

  return {
    categories: categoryResult.ok ? categoryResult.value : [],
    product: productResult.ok ? productResult.value : null,
    error: !categoryResult.ok
      ? errorMessage(categoryResult.error)
      : !productResult.ok
        ? errorMessage(productResult.error)
        : undefined,
  };
}

export async function createProductAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const result = await createProduct(
    {
      sku: text(formData, 'sku'),
      name: localeName(formData, 'name'),
      description: nullableLocaleDescription(formData),
      categoryId: text(formData, 'categoryId'),
      kind: productKind(formData),
      uom: text(formData, 'uom') || 'pcs',
      isSellable: formData.get('isSellable') === 'on',
      isPurchasable: formData.get('isPurchasable') === 'on',
      trackBatch: formData.get('trackBatch') === 'on',
      trackExpiry: formData.get('trackExpiry') === 'on',
      shelfLifeDays: positiveNumber(formData, 'shelfLifeDays'),
      defaultSellPrice: money(formData, 'defaultSellPrice'),
      defaultCostPrice: money(formData, 'defaultCostPrice'),
      imageUrl: optionalText(formData, 'imageUrl'),
      taxCode: optionalText(formData, 'taxCode'),
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/inventory/products');
  return { ok: true, productId: result.value.id };
}

export async function updateProductAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const result = await updateProduct(
    {
      productId,
      version: Number.parseInt(text(formData, 'version'), 10),
      name: localeName(formData, 'name'),
      description: nullableLocaleDescription(formData) ?? null,
      categoryId: text(formData, 'categoryId'),
      kind: productKind(formData),
      uom: text(formData, 'uom') || 'pcs',
      isSellable: formData.get('isSellable') === 'on',
      isPurchasable: formData.get('isPurchasable') === 'on',
      trackBatch: formData.get('trackBatch') === 'on',
      trackExpiry: formData.get('trackExpiry') === 'on',
      shelfLifeDays: positiveNumber(formData, 'shelfLifeDays') ?? null,
      defaultSellPrice: money(formData, 'defaultSellPrice'),
      defaultCostPrice: money(formData, 'defaultCostPrice'),
      imageUrl: optionalText(formData, 'imageUrl') ?? null,
      taxCode: optionalText(formData, 'taxCode') ?? null,
      isActive: formData.get('isActive') === 'on',
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/inventory/products');
  revalidatePath(`/inventory/products/${productId}`);
  return { ok: true, productId };
}

export async function createCategoryAction(formData: FormData) {
  const ctx = await getAuditContext();
  if (!ctx) return { ok: false, error: 'Unauthenticated' };

  const result = await createCategory(
    {
      code: text(formData, 'categoryCode'),
      name: localeName(formData, 'categoryName'),
      parentId: optionalText(formData, 'parentId'),
      sortOrder: Number.parseInt(text(formData, 'sortOrder') || '0', 10),
    },
    ctx,
  );

  if (!result.ok) return { ok: false, error: errorMessage(result.error) };
  revalidatePath('/inventory/products');
  return { ok: true };
}

export async function createVariantAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const size = optionalText(formData, 'size');
  const temperature = optionalText(formData, 'temperature');
  const attributes: Record<string, string> = {};
  if (size) attributes.size = size;
  if (temperature) attributes.temperature = temperature;

  const result = await createVariant(
    {
      productId,
      sku: text(formData, 'variantSku'),
      name: localeName(formData, 'variantName'),
      sellPrice: money(formData, 'variantSellPrice'),
      costPrice: money(formData, 'variantCostPrice'),
      attributes,
      sortOrder: Number.parseInt(text(formData, 'variantSortOrder') || '0', 10),
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath(`/inventory/products/${productId}`);
  return { ok: true, productId };
}

export async function toggleVariantStatusAction(formData: FormData): Promise<void> {
  const ctx = await getAuditContext();
  if (!ctx) return;

  const productId = text(formData, 'productId');
  const variantId = text(formData, 'variantId');
  const version = Number.parseInt(text(formData, 'version'), 10);
  const isActive = text(formData, 'isActive') === 'true';

  await updateVariant({ variantId, version, isActive }, ctx);
  revalidatePath(`/inventory/products/${productId}`);
}
