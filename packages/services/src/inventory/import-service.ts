/**
 * inventory.import — Excel import for stock opname (SD §25.9.2)
 *
 * Sheet 1 — Master data: upsert products + product categories.
 *   Matches by SKU → update; creates if not exists.
 *   Maps KATEGORI to product_categories via keyword matching.
 *
 * Sheet 2 — Manual movements: insert into stock_movement_manual staging table.
 *   Processed separately by a cron/worker job.
 *
 * Permission: inventory.product.upsert (Sheet 1)
 * Permission: inventory.stock.write  (Sheet 2)
 */

import { db } from '@erp/db';
import {
  productCategories,
  productVariants,
  products,
  stockLevels,
  stockLocations,
} from '@erp/db/schema/inventory';
import { stockMovementManual } from '@erp/db/schema/stock-opname';
import { generateId } from '@erp/shared/id';
import { type Result, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Sheet 1 row — master product import.
 * Columns from the opname Excel template Sheet 1.
 */
export interface Sheet1MasterRow {
  KODE: string; // SKU / kode barang
  KATEGORI: string; // kategori (Teh, Cup, Gula, etc.)
  NAMA_BARANG: string; // nama produk Bahasa Indonesia
  SATUAN: string; // Bungkus / Pcs / Kaleng / Botol / Gen
  STOK_AWAL: number; // qty numeric
  HARGA_JUAL: number; // sell price in rupiah (no decimals)
  HARGA_MODAL: number; // cost price in rupiah (no decimals)
  GAMBAR_URL?: string;
  LINK_URL?: string;
  JENIS?: string; // finished_good | raw_material | merchandise | consumable | service
}

/**
 * Sheet 2 row — manual movement log.
 * Columns from the opname Excel template Sheet 2.
 */
export interface Sheet2MovementRow {
  TANGGAL: string; // YYYY-MM-DD
  KODE: string; // SKU
  VARIANT_SKU?: string; // optional variant SKU
  NO_BATCH?: string;
  QTY_IN: number; // positive increase
  QTY_OUT: number; // positive decrease
  KETERANGAN?: string; // notes / reason
}

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface ImportResult {
  createdProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  createdCategories: number;
  totalRowsProcessed: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface MovementImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export function normalizeInventoryImportCode(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function variantMatchesImportCode(
  input: string,
  variant: { sku: string; attributes: Record<string, string> | null },
): boolean {
  const normalized = normalizeInventoryImportCode(input);
  const attributes = variant.attributes ?? {};
  const candidates = [
    variant.sku,
    attributes.managerInventoryCode,
    ...(attributes.managerInventoryAliases ?? '').split('|'),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeInventoryImportCode);
  return candidates.includes(normalized);
}

// ─── Category Keyword Map ──────────────────────────────────────────────────────

/**
 * Maps Sheet 1 KATEGORI keywords → category codes.
 * Case-insensitive matching applied.
 * New categories created when no match found.
 */
const CATEGORY_KEYWORD_MAP: Record<string, string> = {
  // Tea & beverages
  teh: 'TEA',
  'teh ceylon': 'TEA',
  'teh susu': 'TEA',
  tea: 'TEA',
  minuman: 'BEV',
  beverage: 'BEV',
  drink: 'BEV',
  // Packaging
  cup: 'CUP',
  'cup seal': 'CUP',
  cupping: 'CUP',
  gelas: 'CUP',
  packaging: 'CUP',
  // Toppings
  topping: 'TOP',
  extras: 'TOP',
  extra: 'TOP',
  bubbles: 'TOP',
  boba: 'TOP',
  jelly: 'TOP',
  puding: 'TOP',
  coconut: 'TOP',
  // Ingredients
  gula: 'ING',
  sugar: 'ING',
  sirup: 'ING',
  syrup: 'ING',
  milk: 'ING',
  susu: 'ING',
  creamer: 'ING',
  kental: 'ING',
  dairy: 'ING',
  // Raw materials
  bahan: 'RAW',
  raw: 'RAW',
  'bahan baku': 'RAW',
  powder: 'RAW',
  bubuk: 'RAW',
  essence: 'ING',
  esen: 'ING',
  extract: 'ING',
  // Food
  makanan: 'FOOD',
  food: 'FOOD',
  snack: 'FOOD',
  dimsum: 'FOOD',
  camilan: 'FOOD',
  // Merchandise
  merchandise: 'MERCH',
  gift: 'MERCH',
  souvenir: 'MERCH',
  // Service
  service: 'SVC',
};

const VALID_PRODUCT_KINDS = [
  'finished_good',
  'raw_material',
  'merchandise',
  'consumable',
  'service',
] as const;

type ProductKind = (typeof VALID_PRODUCT_KINDS)[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCategoryKeyword(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Match a Sheet 1 KATEGORI value to an existing category by keyword code map
 * or ILIKE fallback on the name JSON field.
 */
async function matchCategoryCode(
  tenantId: string,
  rawCategory: string,
): Promise<{ code: string; id: string } | null> {
  const keyword = normalizeCategoryKeyword(rawCategory);
  const mappedCode = CATEGORY_KEYWORD_MAP[keyword];

  if (mappedCode) {
    const found = await db
      .select({ code: productCategories.code, id: productCategories.id })
      .from(productCategories)
      .where(and(eq(productCategories.tenantId, tenantId), eq(productCategories.code, mappedCode)))
      .limit(1)
      .then((r) => r[0]);

    if (found) return found;
  }

  // Fallback: ILIKE search on name_id (stored as JSON, so we search the raw text)
  const fallback = await db
    .select({ code: productCategories.code, id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.tenantId, tenantId),
        ilike(productCategories.name, `%${rawCategory}%`),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  return fallback ?? null;
}

/**
 * Create a new category with a generated code.
 */
async function createCategoryFromImport(
  tenantId: string,
  rawCategory: string,
  userId: string,
): Promise<{ code: string; id: string }> {
  const slug = rawCategory
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .slice(0, 16);
  const count = await db
    .select({ c: sql<number>`count(*)` })
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId))
    .then((r) => Number(r[0]?.c ?? 0));

  const code = `${slug}-${String(count + 1).padStart(3, '0')}`;
  const id = generateId();

  await db.insert(productCategories).values({
    id,
    tenantId,
    code,
    name: { id: rawCategory.trim(), en: rawCategory.trim(), zh: rawCategory.trim() },
    sortOrder: 0,
    isActive: true,
    createdBy: userId,
  });

  return { code, id };
}

// ─── Sheet 1: Master Product Import ───────────────────────────────────────────

export async function importMasterFromExcel(
  rows: Sheet1MasterRow[],
  locationId: string,
  ctx: AuditContext,
): Promise<Result<ImportResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.product.upsert', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!Array.isArray(rows) || rows.length === 0) {
    return ok({
      createdProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      createdCategories: 0,
      totalRowsProcessed: 0,
      errors: [],
    });
  }

  const errors: ImportError[] = [];
  let createdProducts = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;
  let createdCategories = 0;
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Sheet1MasterRow;
    const rowNum = i + 2; // Excel row 1 = header row

    if (!row.KODE?.trim()) {
      errors.push({ row: rowNum, field: 'KODE', message: 'KODE is required' });
      skippedProducts++;
      continue;
    }
    if (!row.NAMA_BARANG?.trim()) {
      errors.push({ row: rowNum, field: 'NAMA_BARANG', message: 'NAMA_BARANG is required' });
      skippedProducts++;
      continue;
    }

    const sku = row.KODE.trim();
    const productName = row.NAMA_BARANG.trim();

    // ── Resolve or create category ──
    const matchedCategory = await matchCategoryCode(tenantId, row.KATEGORI || '');

    let categoryId: string;
    if (matchedCategory) {
      categoryId = matchedCategory.id;
    } else if (row.KATEGORI?.trim()) {
      const newCat = await createCategoryFromImport(tenantId, row.KATEGORI, userId);
      categoryId = newCat.id;
      createdCategories++;
    } else {
      errors.push({
        row: rowNum,
        field: 'KATEGORI',
        message: 'KATEGORI is required and no category matched; product skipped',
      });
      skippedProducts++;
      continue;
    }

    // ── Parse numerics ──
    const stokAwal = Math.max(0, Math.round(Number(row.STOK_AWAL) || 0));
    const hargaJual = BigInt(Math.max(0, Math.round(Number(row.HARGA_JUAL) || 0)));
    const hargaModal = BigInt(Math.max(0, Math.round(Number(row.HARGA_MODAL) || 0)));
    const uom = row.SATUAN?.trim() || 'pcs';
    const rawKind = row.JENIS?.toLowerCase().trim() || 'finished_good';
    const kind: ProductKind = VALID_PRODUCT_KINDS.includes(rawKind as ProductKind)
      ? (rawKind as ProductKind)
      : 'finished_good';

    // ── Check if product exists by SKU ──
    const existingProduct = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.sku, sku)))
      .limit(1)
      .then((r) => r[0]);

    if (existingProduct) {
      // ── UPDATE ──
      const setClause: Record<string, unknown> = {
        name: { id: productName, en: productName, zh: productName },
        categoryId,
        uom,
        defaultSellPrice: hargaJual,
        defaultCostPrice: hargaModal,
        isActive: true,
        updatedBy: userId,
        updatedAt: new Date(),
        version: sql`${products.version} + 1`,
      };
      if (row.GAMBAR_URL) setClause.imageUrl = row.GAMBAR_URL;
      if (rawKind) setClause.kind = kind;

      await db.update(products).set(setClause).where(eq(products.id, existingProduct.id));
      updatedProducts++;
    } else {
      // ── CREATE ──
      const newProductId = generateId();

      await db.insert(products).values({
        id: newProductId,
        tenantId,
        sku,
        name: { id: productName, en: productName, zh: productName },
        categoryId,
        kind,
        uom,
        defaultSellPrice: hargaJual,
        defaultCostPrice: hargaModal,
        isSellable: true,
        isPurchasable: stokAwal > 0,
        isActive: true,
        createdBy: userId,
      });

      // If STOK_AWAL > 0, create stock level at the specified location
      if (stokAwal > 0) {
        await db.insert(stockLevels).values({
          id: generateId(),
          tenantId,
          locationId,
          productId: newProductId,
          variantId: null,
          qtyOnHand: String(stokAwal),
          qtyReserved: '0',
          qtyAvailable: String(stokAwal),
          uom,
          avgUnitCost: hargaModal,
          lastMovementAt: new Date(),
          createdBy: userId,
        });
      }

      createdProducts++;
    }
  }

  // ── Audit log ──
  await auditRecord({
    action: 'master_import',
    entityType: 'import',
    entityId: ctx.tenantId,
    after: {
      rowsProcessed: rows.length,
      createdProducts,
      updatedProducts,
      skippedProducts,
      createdCategories,
    },
    ctx,
  });

  return ok({
    createdProducts,
    updatedProducts,
    skippedProducts,
    createdCategories,
    totalRowsProcessed: rows.length,
    errors,
  });
}

// ─── Sheet 2: Manual Movement Import ─────────────────────────────────────────

export async function importMovementsFromExcel(
  rows: Sheet2MovementRow[],
  locationId: string,
  ctx: AuditContext,
): Promise<Result<MovementImportResult>> {
  const permCheck = await requirePermission(ctx.userId, 'inventory.stock.write', {
    locationId,
  });
  if (!permCheck.ok) return permCheck;

  if (!Array.isArray(rows) || rows.length === 0) {
    return ok({ imported: 0, skipped: 0, errors: [] });
  }

  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Sheet2MovementRow;
    const rowNum = i + 2;

    if (!row.KODE?.trim()) {
      errors.push({ row: rowNum, field: 'KODE', message: 'KODE is required' });
      skipped++;
      continue;
    }
    if (!row.TANGGAL?.trim()) {
      errors.push({ row: rowNum, field: 'TANGGAL', message: 'TANGGAL is required' });
      skipped++;
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.TANGGAL.trim())) {
      errors.push({
        row: rowNum,
        field: 'TANGGAL',
        message: `Invalid date "${row.TANGGAL}", expected YYYY-MM-DD`,
      });
      skipped++;
      continue;
    }

    const qtyIn = Math.max(0, Number(row.QTY_IN) || 0);
    const qtyOut = Math.max(0, Number(row.QTY_OUT) || 0);

    if (qtyIn === 0 && qtyOut === 0) {
      errors.push({
        row: rowNum,
        field: 'QTY_IN / QTY_OUT',
        message: 'Both QTY_IN and QTY_OUT are 0; skipping row',
      });
      skipped++;
      continue;
    }

    // Resolve product by SKU
    const product = await db
      .select({ id: products.id, uom: products.uom })
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.sku, row.KODE.trim())))
      .limit(1)
      .then((r) => r[0]);

    if (!product) {
      errors.push({
        row: rowNum,
        field: 'KODE',
        message: `SKU "${row.KODE.trim()}" not found`,
      });
      skipped++;
      continue;
    }

    // Resolve variant by SKU if provided
    let variantId: string | null = null;
    if (row.VARIANT_SKU?.trim()) {
      const variantRows = await db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          attributes: productVariants.attributes,
        })
        .from(productVariants)
        .where(
          and(eq(productVariants.tenantId, tenantId), eq(productVariants.productId, product.id)),
        )
        .then((r) => r);
      const variant = variantRows.find((item) =>
        variantMatchesImportCode(row.VARIANT_SKU ?? '', item),
      );
      if (!variant) {
        errors.push({
          row: rowNum,
          field: 'VARIANT_SKU',
          message: `Variant SKU "${row.VARIANT_SKU.trim()}" not found for SKU "${row.KODE.trim()}"`,
        });
        skipped++;
        continue;
      }
      variantId = variant.id;
    }

    // qtyDelta: positive = stock in, negative = stock out
    const qtyDelta = qtyIn - qtyOut;

    await db.insert(stockMovementManual).values({
      id: generateId(),
      tenantId,
      locationId,
      movementDate: row.TANGGAL.trim(), // YYYY-MM-DD string → Drizzle date column
      productId: product.id,
      variantId,
      batchNo: row.NO_BATCH?.trim() ?? null,
      qtyDelta: String(qtyDelta),
      uom: product.uom ?? 'pcs',
      reason: 'manual_import',
      reference: row.KETERANGAN?.trim() ?? null,
      processed: false,
      createdBy: userId,
    });

    imported++;
  }

  // ── Audit log ──
  await auditRecord({
    action: 'movement_import',
    entityType: 'import',
    entityId: locationId,
    after: {
      rowsProcessed: rows.length,
      imported,
      skipped,
      locationId,
    },
    ctx,
  });

  return ok({ imported, skipped, errors });
}
