/**
 * Initial stock seeding — dessert SKUs that are stocked physically
 * (egg tart, pudding flavours, mousse cake) per outlet.
 *
 * Tea drinks are intentionally NOT seeded here: they are produced
 * on demand from raw materials via BOM, so their stock_levels rows
 * remain absent and the POS treats them as untracked (always
 * available).
 *
 * Raw materials and consumables get a baseline so the inventory
 * dashboard isn't empty on a fresh deploy. Adjust via the
 * inventory UI after physical opname.
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { locations } from '../schema/auth';
import { products, stockLevels } from '../schema/inventory';
import { generateId } from '@erp/shared/id';

interface StockSeedRule {
  /** Product SKU as defined in menu.ts / recipes.ts. */
  sku: string;
  /** Initial qty per active outlet (string for numeric column). */
  qtyOnHand: string;
  /** Unit of measure — must match products.uom. */
  uom: string;
}

/**
 * Desserts that are stock-managed. We seed a modest opening balance per
 * outlet so the POS out-of-stock UI has something to react to in the
 * first hours after go-live.
 */
const DESSERT_STOCK: StockSeedRule[] = [
  { sku: 'DST-EGG-TART', qtyOnHand: '20', uom: 'pcs' },
  { sku: 'DST-FANCY-EGG-TART', qtyOnHand: '15', uom: 'pcs' },
  { sku: 'DST-PUDDING-BAMBOO', qtyOnHand: '12', uom: 'pcs' },
  { sku: 'DST-PUDDING-OSMANTHUS', qtyOnHand: '12', uom: 'pcs' },
  { sku: 'DST-PUDDING-CEYLON', qtyOnHand: '12', uom: 'pcs' },
  { sku: 'DST-PUDDING-ROY', qtyOnHand: '12', uom: 'pcs' },
  { sku: 'DST-MOUSSE-CAKE', qtyOnHand: '10', uom: 'pcs' },
];

/**
 * Raw materials and consumables — enough buffer for the first week.
 * Values are conservative; manager updates after first opname.
 */
const SUPPLY_STOCK: StockSeedRule[] = [
  { sku: 'TEA-BAMBOO-OOLONG', qtyOnHand: '5000', uom: 'ml' },
  { sku: 'TEA-OSMANTHUS-OOLONG', qtyOnHand: '5000', uom: 'ml' },
  { sku: 'TEA-GLUTINOUS-GREEN', qtyOnHand: '5000', uom: 'ml' },
  { sku: 'SYRUP-ICE-SUGAR', qtyOnHand: '2000', uom: 'ml' },
  { sku: 'SYRUP-BASIC', qtyOnHand: '2000', uom: 'ml' },
  { sku: 'CREAMER', qtyOnHand: '3000', uom: 'ml' },
  { sku: 'LEMON-FRESH', qtyOnHand: '2000', uom: 'g' },
  { sku: 'WATER-PURE', qtyOnHand: '20000', uom: 'ml' },
];

const ALL_RULES = [...DESSERT_STOCK, ...SUPPLY_STOCK];

export async function seedInitialStock(db: Database, tenantId: string) {
  // Active store outlets — bahan masuk per outlet
  const outletRows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, tenantId),
        eq(locations.status, 'active'),
        eq(locations.type, 'store'),
      ),
    );

  if (outletRows.length === 0) return { inserted: 0 };

  // Resolve product SKU -> id once
  const productRows = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const skuToId = new Map(productRows.map((r) => [r.sku, r.id]));

  let inserted = 0;
  for (const outlet of outletRows) {
    for (const rule of ALL_RULES) {
      const productId = skuToId.get(rule.sku);
      if (!productId) continue;

      // onConflictDoNothing on the unique (tenant, location, product, variant, batch)
      // — never overwrites an outlet's real stock after the first seed.
      const result = await db
        .insert(stockLevels)
        .values({
          id: generateId(),
          tenantId,
          locationId: outlet.id,
          stockLocationId: null,
          productId,
          variantId: null,
          batchNo: null,
          qtyOnHand: rule.qtyOnHand,
          qtyReserved: '0',
          qtyAvailable: rule.qtyOnHand,
          uom: rule.uom,
          lastMovementAt: new Date(),
        })
        .onConflictDoNothing();
      // Drizzle's neon-http doesn't return affected rows on conflict-do-nothing,
      // so we count attempts, not actual inserts. Idempotency is preserved.
      inserted++;
      void result;
    }
  }

  return { inserted };
}
