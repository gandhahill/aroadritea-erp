/**
 * Inventory seed from manager spreadsheet:
 * D:\KERJA\Aroadri Tea\2026\05\Malioboro Mall Mei.xlsx
 *
 * The workbook records weekly menu sales and derived packaging/consumable
 * usage. We seed it into the manual movement staging table, not directly
 * into stock_levels, so inventory can review and reconcile with physical
 * store counts before applying movements.
 */

import { generateId } from '@erp/shared/id';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { locations } from '../schema/auth';
import { productCategories, products } from '../schema/inventory';
import { stockMovementManual } from '../schema/stock-opname';

const n = (id: string, en: string, zh: string) => ({ id, en, zh });

const CATEGORY = {
  id: 'cat-packaging-supplies',
  code: 'PACKAGING_SUPPLY',
  name: n('Perlengkapan Packaging', 'Packaging Supplies', '包装耗材'),
};

const DAILY_MONTHLY = ['daily', 'monthly'] as const;
const WEEKLY_MONTHLY = ['weekly', 'monthly'] as const;

const SUPPLIES = [
  { sku: 'PACK-CUP-CLEAR', name: 'Cup Bening', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-CUP-PAPER', name: 'Cup Kertas', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-LID-WHITE', name: 'Tutup Putih', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-LID-BLACK', name: 'Tutup Hitam', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-STRAW-THIN', name: 'Pipet Tipis', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-STRAW-THICK', name: 'Pipet Tebal', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-TAKEAWAY-LARGE', name: 'Take Away Large', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'PACK-TAKEAWAY-SMALL', name: 'Take Away Small', uom: 'pcs', frequencies: DAILY_MONTHLY },
  { sku: 'TOP-OAT-PEARL', name: 'Oat Pearl', uom: 'pcs', frequencies: WEEKLY_MONTHLY },
  { sku: 'TOP-BARLEY-PEARL', name: 'Barley Pearl', uom: 'pcs', frequencies: WEEKLY_MONTHLY },
  { sku: 'TOP-CRYSTAL-PEARL', name: 'Crystal Pearl', uom: 'pcs', frequencies: WEEKLY_MONTHLY },
  { sku: 'TOP-CHEESE-PEARL', name: 'Cheese Pearl', uom: 'pcs', frequencies: WEEKLY_MONTHLY },
  { sku: 'INV-LEMON-PIECE', name: 'Lemon', uom: 'pcs', frequencies: WEEKLY_MONTHLY },
] as const;

const WEEKLY_USAGE = [
  {
    date: '2026-05-03',
    reference: 'Malioboro Mall Mei.xlsx / Minggu 1 / 1-3 Mei 2026',
    qty: {
      'PACK-CUP-CLEAR': 32,
      'PACK-CUP-PAPER': 82,
      'PACK-LID-WHITE': 32,
      'PACK-LID-BLACK': 82,
      'PACK-STRAW-THIN': 94,
      'PACK-STRAW-THICK': 20,
      'PACK-TAKEAWAY-LARGE': 4,
      'PACK-TAKEAWAY-SMALL': 4,
      'TOP-OAT-PEARL': 1,
      'TOP-BARLEY-PEARL': 1,
      'TOP-CRYSTAL-PEARL': 5,
      'TOP-CHEESE-PEARL': 5,
      'DST-EGG-TART': 60,
      'INV-LEMON-PIECE': 22,
    },
  },
  {
    date: '2026-05-10',
    reference: 'Malioboro Mall Mei.xlsx / Minggu 2 / 4-10 Mei 2026',
    qty: {
      'PACK-CUP-CLEAR': 43,
      'PACK-CUP-PAPER': 71,
      'PACK-LID-WHITE': 43,
      'PACK-LID-BLACK': 71,
      'PACK-STRAW-THIN': 91,
      'PACK-STRAW-THICK': 23,
      'PACK-TAKEAWAY-LARGE': 6,
      'PACK-TAKEAWAY-SMALL': 4,
      'TOP-OAT-PEARL': 1,
      'TOP-BARLEY-PEARL': 8,
      'TOP-CRYSTAL-PEARL': 7,
      'TOP-CHEESE-PEARL': 6,
      'DST-EGG-TART': 40,
      'INV-LEMON-PIECE': 23,
    },
  },
  {
    date: '2026-05-17',
    reference: 'Malioboro Mall Mei.xlsx / Minggu 3 / 11-17 Mei 2026',
    qty: {
      'PACK-CUP-CLEAR': 60,
      'PACK-CUP-PAPER': 158,
      'PACK-LID-WHITE': 60,
      'PACK-LID-BLACK': 158,
      'PACK-STRAW-THIN': 182,
      'PACK-STRAW-THICK': 36,
      'PACK-TAKEAWAY-LARGE': 43,
      'PACK-TAKEAWAY-SMALL': 18,
      'TOP-OAT-PEARL': 7,
      'TOP-BARLEY-PEARL': 2,
      'TOP-CRYSTAL-PEARL': 16,
      'TOP-CHEESE-PEARL': 3,
      'DST-EGG-TART': 41,
      'INV-LEMON-PIECE': 62,
    },
  },
] as const;

export async function seedMalioboroMayInventory(db: Database, tenantId: string) {
  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.code, 'MLI')))
    .limit(1);
  if (!location) return { products: 0, movements: 0 };

  await db
    .insert(productCategories)
    .values({
      id: CATEGORY.id,
      tenantId,
      code: CATEGORY.code,
      name: CATEGORY.name,
      sortOrder: 98,
    })
    .onConflictDoUpdate({
      target: [productCategories.tenantId, productCategories.code],
      set: { name: CATEGORY.name, sortOrder: 98, isActive: true, updatedAt: new Date() },
    });

  const [category] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.tenantId, tenantId), eq(productCategories.code, CATEGORY.code)))
    .limit(1);
  const categoryId = category?.id ?? CATEGORY.id;

  for (const supply of SUPPLIES) {
    await db
      .insert(products)
      .values({
        id: `inv-${supply.sku.toLowerCase()}`,
        tenantId,
        sku: supply.sku,
        name: n(supply.name, supply.name, supply.name),
        categoryId,
        kind: 'consumable',
        opnameFrequency: supply.frequencies[0],
        opnameFrequencies: [...supply.frequencies],
        uom: supply.uom,
        isSellable: false,
        isPurchasable: true,
        defaultSellPrice: 0n,
        defaultCostPrice: 0n,
      })
      .onConflictDoUpdate({
        target: [products.tenantId, products.sku],
        set: {
          name: n(supply.name, supply.name, supply.name),
          categoryId,
          kind: 'consumable',
          opnameFrequency: supply.frequencies[0],
          opnameFrequencies: [...supply.frequencies],
          uom: supply.uom,
          isSellable: false,
          isPurchasable: true,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }

  const productRows = await db
    .select({ id: products.id, sku: products.sku, uom: products.uom })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const bySku = new Map(productRows.map((row) => [row.sku, row]));

  let movements = 0;
  for (const week of WEEKLY_USAGE) {
    for (const [sku, qty] of Object.entries(week.qty)) {
      const product = bySku.get(sku);
      if (!product || qty <= 0) continue;

      const [existing] = await db
        .select({ id: stockMovementManual.id })
        .from(stockMovementManual)
        .where(
          and(
            eq(stockMovementManual.tenantId, tenantId),
            eq(stockMovementManual.locationId, location.id),
            eq(stockMovementManual.productId, product.id),
            eq(stockMovementManual.movementDate, week.date),
            eq(stockMovementManual.reference, week.reference),
          ),
        )
        .limit(1);
      if (existing) continue;

      await db.insert(stockMovementManual).values({
        id: generateId(),
        tenantId,
        locationId: location.id,
        movementDate: week.date,
        productId: product.id,
        qtyDelta: `-${qty}`,
        uom: product.uom,
        reason: 'manual_import',
        reference: week.reference,
        processed: false,
      });
      movements++;
    }
  }

  return { products: SUPPLIES.length, movements };
}
