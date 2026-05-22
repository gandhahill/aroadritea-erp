/**
 * @erp/offline — Demo Master Data Snapshot
 *
 * SD §34, ADR-0008.
 *
 * Snapshots master data from production IndexedDB (`aroadri-pos`)
 * into demo IndexedDB (`aroadri-pos-demo`) on demo mode activation.
 *
 * Products, variants, modifiers, promotions, tax_rates are snapshot.
 * The snapshot timestamp is stored in demo meta so we can warn if >24h old.
 */

import {
  DEMO_META_KEYS,
  getDemoMeta,
  getMasterSnapshotAgeMs,
  isMasterStale,
  setDemoMeta,
  upsertDemoModifiers,
  upsertDemoProducts,
  upsertDemoPromotions,
  upsertDemoTaxRates,
  upsertDemoVariants,
} from './demo-db';
import type { DbModifier, DbProduct, DbPromotion, DbTaxRate, DbVariant } from './indexeddb';
import {
  getActivePromotions,
  getModifiers,
  getProducts,
  getTaxRates,
  getVariants,
} from './indexeddb';

export interface DemoMasterDataSource {
  products: DbProduct[];
  variants: DbVariant[];
  modifiers: DbModifier[];
  promotions: DbPromotion[];
  taxRates: DbTaxRate[];
}

/** Result of a snapshot operation. */
export interface SnapshotResult {
  success: boolean;
  productCount: number;
  variantCount: number;
  modifierCount: number;
  promotionCount: number;
  taxRateCount: number;
  snapshotAt: string;
  errors: string[];
}

async function writeDemoMasterData(
  source: DemoMasterDataSource,
  snapshotAt: string,
): Promise<SnapshotResult> {
  await Promise.all([
    upsertDemoProducts(source.products),
    upsertDemoVariants(source.variants),
    upsertDemoModifiers(source.modifiers),
    upsertDemoPromotions(source.promotions),
    upsertDemoTaxRates(source.taxRates),
  ]);

  await setDemoMeta(DEMO_META_KEYS.MASTER_SNAPSHOT_AT, snapshotAt);

  return {
    success: true,
    productCount: source.products.length,
    variantCount: source.variants.length,
    modifierCount: source.modifiers.length,
    promotionCount: source.promotions.length,
    taxRateCount: source.taxRates.length,
    snapshotAt,
    errors: [],
  };
}

/**
 * Snapshot master data supplied by ERP UI/server actions into demo IndexedDB.
 * This lets demo POS work even when production POS has not been opened in this
 * browser yet. It remains a client-side sandbox because only master data is
 * copied; demo transactions still never sync to the production database.
 */
export async function snapshotMasterDataFromSource(
  source: DemoMasterDataSource,
): Promise<SnapshotResult> {
  const snapshotAt = new Date().toISOString();
  try {
    return await writeDemoMasterData(source, snapshotAt);
  } catch (err) {
    return {
      success: false,
      productCount: 0,
      variantCount: 0,
      modifierCount: 0,
      promotionCount: 0,
      taxRateCount: 0,
      snapshotAt,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

/**
 * Snapshot all master data from production IndexedDB into demo IndexedDB.
 * Should be called when user activates demo mode.
 *
 * Re-snapshotting replaces existing data (idempotent — same product, same id).
 */
export async function snapshotMasterData(): Promise<SnapshotResult> {
  const errors: string[] = [];
  const snapshotAt = new Date().toISOString();

  try {
    // Read from production IndexedDB
    const [products, variants, modifiers, promotions, taxRates] = await Promise.all([
      getProducts(),
      getVariants(),
      getModifiers(),
      getActivePromotions(),
      getTaxRates(),
    ]);

    return writeDemoMasterData({ products, variants, modifiers, promotions, taxRates }, snapshotAt);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      productCount: 0,
      variantCount: 0,
      modifierCount: 0,
      promotionCount: 0,
      taxRateCount: 0,
      snapshotAt,
      errors,
    };
  }
}

/** Age of the current master snapshot, or null if none. */
export async function getMasterSnapshotAgeHuman(): Promise<string | null> {
  const ageMs = await getMasterSnapshotAgeMs();
  if (ageMs === null) return null;
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const minutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
}

/** Returns true if the demo has no master data (never snapshot). */
export async function hasNoMasterData(): Promise<boolean> {
  const products = await getProducts();
  return products.length === 0;
}
