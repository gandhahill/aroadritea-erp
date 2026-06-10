'use server';

import { getSession } from '@/lib/auth';
import {
  createCategory,
  createProduct,
  createVariant,
  deactivateProduct,
  deleteProductPermanently,
  getProduct,
  importMasterFromExcel,
  listCategories,
  listProducts,
  reactivateProduct,
  updateProduct,
  updateVariant,
} from '@erp/services/inventory';
import type {
  CategoryResult,
  ProductDetailResult,
  ProductListItem,
  Sheet1MasterRow,
} from '@erp/services/inventory';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';

type ProductKind = 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service';
type OpnameFrequency = 'daily' | 'weekly' | 'monthly';

export interface ProductMasterData {
  products: ProductListItem[];
  total: number;
  categories: CategoryResult[];
  error?: string;
}

export interface ActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
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

function opnameFrequency(formData: FormData): OpnameFrequency {
  const value = text(formData, 'opnameFrequency');
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return 'monthly';
}

function opnameFrequencies(formData: FormData): OpnameFrequency[] {
  const values = formData.getAll('opnameFrequencies').map((value) => String(value));
  const valid = values.filter(
    (value): value is OpnameFrequency =>
      value === 'daily' || value === 'weekly' || value === 'monthly',
  );
  return [...new Set(valid)];
}

function positiveNumber(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function hppCategory(formData: FormData): 'hpp' | 'supply_expense' | null {
  const value = text(formData, 'hppCategory');
  if (value === 'hpp' || value === 'supply_expense') return value;
  return null;
}

function localeName(formData: FormData, prefix: string) {
  // Some forms post one primary language only (product uses `nameEn`,
  // variant uses `variantNameId`). Mirror the first non-empty value so
  // the JSONB `{id,en,zh}` schema remains valid.
  const enRaw = optionalText(formData, `${prefix}En`);
  const idRaw = optionalText(formData, `${prefix}Id`);
  const zhRaw = optionalText(formData, `${prefix}Zh`);
  const fallback = enRaw ?? idRaw ?? zhRaw ?? '';
  return { id: idRaw ?? fallback, en: enRaw ?? fallback, zh: zhRaw ?? fallback };
}

function nullableLocaleDescription(formData: FormData) {
  const en = optionalText(formData, 'descriptionEn');
  const id = optionalText(formData, 'descriptionId') ?? en;
  const zh = optionalText(formData, 'descriptionZh') ?? en;
  return en ? { id: id ?? en, en, zh: zh ?? en } : undefined;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message);
    const cause =
      'cause' in error && error.cause ? ` (${String((error as { cause: unknown }).cause)})` : '';
    return msg + cause;
  }
  return String(error);
}

function validationFieldErrors(error: unknown): Record<string, string> | undefined {
  if (!error || typeof error !== 'object' || !('details' in error)) return undefined;
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== 'object' || !('issues' in details)) return undefined;
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return undefined;

  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const pathValue = (issue as { path?: unknown }).path;
    const path = Array.isArray(pathValue) ? pathValue.map(String).join('.') : '';
    const message = String((issue as { message?: unknown }).message ?? '');
    if (path && message) fieldErrors[path] = message;
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

// Kinds that belong on the "Produk & Menu" page (i.e. things actually
// sold to customers). Raw materials and consumables live under
// /inventory/supplies — even if their isSellable flag was set true by
// accident, this whitelist keeps them out of the customer-facing list.
const SELLABLE_KINDS: ProductKind[] = ['finished_good', 'merchandise', 'service'];

export async function fetchProductMasterData(
  search?: string,
  kind?: ProductKind,
): Promise<ProductMasterData> {
  const ctx = await getAuditContext();
  if (!ctx) return { products: [], total: 0, categories: [], error: 'Unauthenticated' };

  // When the operator picks a specific kind tab (e.g. "Bahan Baku")
  // honor it. When no tab is picked ("Semua") restrict to sellable
  // items so the produk-jual catalog isn't polluted with raw materials
  // and consumables — those live under their own tab/page.
  const listInput = kind
    ? { search, kind, limit: 200, offset: 0 }
    : { search, isSellable: true, limit: 200, offset: 0 };

  const [categoryResult, productResult] = await Promise.all([
    listCategories(ctx),
    listProducts(listInput, ctx),
  ]);

  // Post-fetch whitelist when no kind filter was applied — guards against
  // raw_material/consumable rows that have isSellable=true by mistake.
  const rawProducts = productResult.ok ? productResult.value.items : [];
  const products = kind
    ? rawProducts
    : rawProducts.filter((p) => SELLABLE_KINDS.includes(p.kind as ProductKind));

  return {
    categories: categoryResult.ok ? categoryResult.value : [],
    products,
    total: kind ? (productResult.ok ? productResult.value.total : 0) : products.length,
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
      opnameFrequency: opnameFrequency(formData),
      opnameFrequencies: opnameFrequencies(formData),
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
      hppCategory: hppCategory(formData),
      initialStocks: Array.from(formData.entries())
        .filter(([key]) => key.startsWith('initialStock_'))
        .map(([key, value]) => ({
          locationId: key.replace('initialStock_', ''),
          qty: String(value).trim() || '0',
        }))
        .filter((s) => Number.parseFloat(s.qty) > 0),
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');
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
      opnameFrequency: opnameFrequency(formData),
      opnameFrequencies: opnameFrequencies(formData),
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
      hppCategory: hppCategory(formData),
      isActive: formData.get('isActive') === 'on',
    },
    ctx,
  );

  if (!result.ok) return { error: errorMessage(result.error) };
  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');
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

  if (!result.ok) {
    return { error: errorMessage(result.error), fieldErrors: validationFieldErrors(result.error) };
  }
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

export async function updateVariantAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const variantId = text(formData, 'variantId');
  const version = Number.parseInt(text(formData, 'version'), 10);

  const result = await updateVariant(
    {
      variantId,
      version,
      sellPrice: money(formData, 'editSellPrice'),
      costPrice: money(formData, 'editCostPrice'),
    },
    ctx,
  );

  if (!result.ok) {
    return { error: errorMessage(result.error), fieldErrors: validationFieldErrors(result.error) };
  }
  revalidatePath(`/inventory/products/${productId}`);
  return { ok: true, productId };
}

export async function deactivateProductAction(formData: FormData): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const result = await deactivateProduct(productId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');
  return { ok: true, productId };
}

export async function reactivateProductAction(formData: FormData): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const result = await reactivateProduct(productId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');
  return { ok: true, productId };
}

export async function deleteProductAction(formData: FormData): Promise<ActionState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const productId = text(formData, 'productId');
  const result = await deleteProductPermanently(productId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');
  return { ok: true, productId };
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

export interface ImportCsvState {
  ok?: boolean;
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim().length > 0)) rows.push(row);
  return rows;
}

export async function importCsvAction(
  _prev: ImportCsvState | null,
  formData: FormData,
): Promise<ImportCsvState> {
  const ctx = await getAuditContext();
  if (!ctx) return { error: 'Unauthenticated' };

  const locationId = text(formData, 'locationId');
  if (!locationId) return { error: 'Location is required' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'CSV file is required' };
  if (file.size > 2 * 1024 * 1024) return { error: 'File too large (max 2 MB)' };

  const csvText = await file.text();
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length < 2) return { error: 'CSV has no data rows' };

  const headerRow = rawRows[0]!;
  const headers = headerRow.map((h) => h.trim().toUpperCase().replace(/\s+/g, '_'));

  const colIdx = (name: string) => headers.indexOf(name);
  const kodeIdx = colIdx('KODE');
  const kategoriIdx = colIdx('KATEGORI');
  const namaIdx = colIdx('NAMA_BARANG');
  const satuanIdx = colIdx('SATUAN');
  const stokIdx = colIdx('STOK_AWAL');
  const hargaJualIdx = colIdx('HARGA_JUAL');
  const hargaModalIdx = colIdx('HARGA_MODAL');
  const jenisIdx = colIdx('JENIS');
  const gambarIdx = colIdx('GAMBAR_URL');

  if (kodeIdx === -1) return { error: 'Column KODE not found in CSV header' };
  if (namaIdx === -1) return { error: 'Column NAMA_BARANG not found in CSV header' };

  const masterRows: Sheet1MasterRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const cols = rawRows[i]!;
    const kode = cols[kodeIdx]?.trim() ?? '';
    const nama = cols[namaIdx]?.trim() ?? '';
    if (!kode && !nama) continue;

    masterRows.push({
      KODE: kode,
      KATEGORI: cols[kategoriIdx]?.trim() ?? '',
      NAMA_BARANG: nama,
      SATUAN: cols[satuanIdx]?.trim() ?? 'pcs',
      STOK_AWAL: Number(cols[stokIdx]?.replace(/[^\d.-]/g, '') || '0'),
      HARGA_JUAL: Number(cols[hargaJualIdx]?.replace(/[^\d.-]/g, '') || '0'),
      HARGA_MODAL: Number(cols[hargaModalIdx]?.replace(/[^\d.-]/g, '') || '0'),
      JENIS: cols[jenisIdx]?.trim() ?? undefined,
      GAMBAR_URL: cols[gambarIdx]?.trim() ?? undefined,
    });
  }

  if (masterRows.length === 0) return { error: 'No valid data rows found' };

  const result = await importMasterFromExcel(masterRows, locationId, ctx);
  if (!result.ok) return { error: errorMessage(result.error) };

  revalidatePath('/inventory/products');
  revalidatePath('/inventory/supplies');

  return {
    ok: true,
    created: result.value.createdProducts,
    updated: result.value.updatedProducts,
    skipped: result.value.skippedProducts,
    errors: result.value.errors,
  };
}
