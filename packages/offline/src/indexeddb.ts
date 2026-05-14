/**
 * @erp/offline — IndexedDB schema for POS PWA offline support
 *
 * Schema per SD §14.3, §35.1.1:
 *   indexeddb: aroadri-pos
 *     ├─ products       (key: id)
 *     ├─ variants       (key: id, index: productId)
 *     ├─ modifiers      (key: id)
 *     ├─ promotions     (key: id; filter active)
 *     ├─ tax_rates      (key: code)
 *     ├─ shifts         (key: id; only "open" shift)
 *     ├─ pending_orders (key: client_order_uuid)
 *     └─ meta           (key: string — last_synced, master_version, ...)
 *
 * Used by: apps/web POS (client-side), POS demo mode (SD §34).
 * The outbox table `pending_orders` is the critical piece for RPO = 0.
 */

import { type IDBPDatabase, openDB } from 'idb';

// ─── Database constants ────────────────────────────────────────────────────────

export const DB_NAME = 'aroadri-pos';
export const DB_VERSION = 1;

/** Object store names. */
export const STORE = {
  PRODUCTS: 'products',
  VARIANTS: 'variants',
  MODIFIERS: 'modifiers',
  PROMOTIONS: 'promotions',
  TAX_RATES: 'tax_rates',
  SHIFTS: 'shifts',
  PENDING_ORDERS: 'pending_orders',
  META: 'meta',
} as const;

// ─── Raw data types ────────────────────────────────────────────────────────────

export interface DbProduct {
  id: string;
  sku: string;
  name: string; // may be JSON { id, en, zh }
  categoryId: string;
  defaultSellPrice: string; // stored as string for bigint serialization
  imageUrl: string | null;
  kind: string;
  updatedAt: string; // ISO date string
}

export interface DbVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  sellPrice: string;
  attributes: Record<string, string>;
  sortOrder: number;
}

export interface DbModifier {
  id: string;
  name: string;
  price: string; // bigint as string
  category: string;
  isActive: boolean;
}

export interface DbPromotion {
  id: string;
  name: string;
  type: string;
  rules: Record<string, unknown>;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface DbTaxRate {
  code: string;
  name: string;
  rate: string; // decimal as string e.g. "0.10"
  calculation: 'inclusive' | 'exclusive';
  appliesTo: string[];
}

export interface DbShift {
  id: string;
  locationId: string;
  status: 'open' | 'closed';
  openedBy: string;
  openedAt: string;
  openingCash: string;
}

/**
 * Outbox entry — SD §14.4, §35.1.1
 * Each entry represents one POS transaction waiting to sync.
 */
export interface DbPendingOrder {
  /** ULID — also used as Idempotency-Key in HTTP header */
  clientOrderUuid: string;
  /** Client-side creation timestamp */
  createdAtClient: string;
  /** Full sale payload passed to createSale service */
  payload: unknown;
  /** Number of sync attempts (0 = never tried) */
  attempts: number;
  /** Last error message string */
  lastError: string | null;
  /** ISO timestamp for next retry (null = retry immediately) */
  nextRetryAt: string | null;
  /** True once server returns 2xx */
  synced: boolean;
  /** Server-assigned sale number (filled after sync) */
  serverSaleNumber: string | null;
}

/** Key-value meta store — key: string, value: string */
export type DbMetaValue = {
  key: string;
  value: string;
};

// ─── DB upgrade (migration) ─────────────────────────────────────────────────────

/**
 * Open (or create) the offline database.
 * Call this once at app startup; the DB is cached.
 */
export async function openOfflineDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Products cache
      if (!db.objectStoreNames.contains(STORE.PRODUCTS)) {
        db.createObjectStore(STORE.PRODUCTS, { keyPath: 'id' });
      }

      // 2. Variants cache (indexed by productId for fast lookup)
      if (!db.objectStoreNames.contains(STORE.VARIANTS)) {
        const store = db.createObjectStore(STORE.VARIANTS, { keyPath: 'id' });
        store.createIndex('byProduct', 'productId');
      }

      // 3. Modifiers cache
      if (!db.objectStoreNames.contains(STORE.MODIFIERS)) {
        db.createObjectStore(STORE.MODIFIERS, { keyPath: 'id' });
      }

      // 4. Promotions cache
      if (!db.objectStoreNames.contains(STORE.PROMOTIONS)) {
        db.createObjectStore(STORE.PROMOTIONS, { keyPath: 'id' });
      }

      // 5. Tax rates cache
      if (!db.objectStoreNames.contains(STORE.TAX_RATES)) {
        db.createObjectStore(STORE.TAX_RATES, { keyPath: 'code' });
      }

      // 6. Current open shift
      if (!db.objectStoreNames.contains(STORE.SHIFTS)) {
        db.createObjectStore(STORE.SHIFTS, { keyPath: 'id' });
      }

      // 7. Pending orders outbox (CRITICAL for RPO = 0)
      // UNIQUE constraint on clientOrderUuid via keyPath prevents duplicates
      if (!db.objectStoreNames.contains(STORE.PENDING_ORDERS)) {
        db.createObjectStore(STORE.PENDING_ORDERS, { keyPath: 'clientOrderUuid' });
      }

      // 8. Meta key-value store
      if (!db.objectStoreNames.contains(STORE.META)) {
        db.createObjectStore(STORE.META, { keyPath: 'key' });
      }
    },
  });
}

// ─── Cached DB instance ────────────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getOfflineDb(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openOfflineDb();
  }
  return _db;
}

// ─── Products ────────────────────────────────────────────────────────────────────

export async function upsertProducts(products: DbProduct[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(STORE.PRODUCTS, 'readwrite');
  await Promise.all([...products.map((p) => tx.store.put(p)), tx.done]);
}

export async function getProducts(): Promise<DbProduct[]> {
  const db = await getOfflineDb();
  return db.getAll(STORE.PRODUCTS);
}

export async function clearProducts(): Promise<void> {
  const db = await getOfflineDb();
  return db.clear(STORE.PRODUCTS);
}

// ─── Variants ──────────────────────────────────────────────────────────────────

export async function upsertVariants(variants: DbVariant[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(STORE.VARIANTS, 'readwrite');
  await Promise.all([...variants.map((v) => tx.store.put(v)), tx.done]);
}

export async function getVariants(): Promise<DbVariant[]> {
  const db = await getOfflineDb();
  return db.getAll(STORE.VARIANTS);
}

export async function clearVariants(): Promise<void> {
  const db = await getOfflineDb();
  return db.clear(STORE.VARIANTS);
}

// ─── Modifiers ─────────────────────────────────────────────────────────────────

export async function upsertModifiers(modifiers: DbModifier[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(STORE.MODIFIERS, 'readwrite');
  await Promise.all([...modifiers.map((m) => tx.store.put(m)), tx.done]);
}

export async function getModifiers(): Promise<DbModifier[]> {
  const db = await getOfflineDb();
  return db.getAll(STORE.MODIFIERS);
}

// ─── Promotions ────────────────────────────────────────────────────────────────

export async function upsertPromotions(promos: DbPromotion[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(STORE.PROMOTIONS, 'readwrite');
  await Promise.all([...promos.map((p) => tx.store.put(p)), tx.done]);
}

export async function getActivePromotions(): Promise<DbPromotion[]> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORE.PROMOTIONS);
  const now = new Date().toISOString();
  return all.filter((p) => p.isActive && p.startDate <= now && p.endDate >= now);
}

// ─── Tax rates ────────────────────────────────────────────────────────────────

export async function upsertTaxRates(rates: DbTaxRate[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(STORE.TAX_RATES, 'readwrite');
  await Promise.all([...rates.map((r) => tx.store.put(r)), tx.done]);
}

export async function getTaxRates(): Promise<DbTaxRate[]> {
  const db = await getOfflineDb();
  return db.getAll(STORE.TAX_RATES);
}

// ─── Shift ────────────────────────────────────────────────────────────────────

export async function setOpenShift(shift: DbShift): Promise<void> {
  const db = await getOfflineDb();
  await db.clear(STORE.SHIFTS);
  await db.put(STORE.SHIFTS, shift);
}

export async function getOpenShift(): Promise<DbShift | undefined> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORE.SHIFTS);
  return all.find((s) => s.status === 'open');
}

export async function clearShift(): Promise<void> {
  const db = await getOfflineDb();
  return db.clear(STORE.SHIFTS);
}

// ─── Pending Orders (outbox) — critical ──────────────────────────────────────

/**
 * Add a new sale to the outbox.
 * Called when POS is offline (or always as backup even when online).
 */
export async function enqueueOrder(order: DbPendingOrder): Promise<void> {
  const db = await getOfflineDb();
  await db.put(STORE.PENDING_ORDERS, order);
}

/**
 * Get all unsynced orders, oldest first.
 */
export async function getPendingOrders(): Promise<DbPendingOrder[]> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORE.PENDING_ORDERS);
  return all
    .filter((o) => !o.synced)
    .sort((a, b) => a.createdAtClient.localeCompare(b.createdAtClient));
}

/**
 * Mark an order as successfully synced.
 */
export async function markOrderSynced(
  clientOrderUuid: string,
  serverSaleNumber: string,
): Promise<void> {
  const db = await getOfflineDb();
  const order = await db.get(STORE.PENDING_ORDERS, clientOrderUuid);
  if (order) {
    order.synced = true;
    order.serverSaleNumber = serverSaleNumber;
    await db.put(STORE.PENDING_ORDERS, order);
  }
}

/**
 * Update retry metadata on a failed sync attempt.
 */
export async function markOrderRetry(
  clientOrderUuid: string,
  error: string,
  nextRetryAt: string,
): Promise<void> {
  const db = await getOfflineDb();
  const order = await db.get(STORE.PENDING_ORDERS, clientOrderUuid);
  if (order) {
    order.attempts += 1;
    order.lastError = error;
    order.nextRetryAt = nextRetryAt;
    await db.put(STORE.PENDING_ORDERS, order);
  }
}

/**
 * Count of unsynced orders (for UI banner).
 */
export async function countPendingOrders(): Promise<number> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORE.PENDING_ORDERS);
  return all.filter((o) => !o.synced).length;
}

/**
 * Highest failed retry count among unsynced orders.
 */
export async function maxPendingOrderAttempts(): Promise<number> {
  const db = await getOfflineDb();
  const all = await db.getAll(STORE.PENDING_ORDERS);
  return all.filter((o) => !o.synced).reduce((max, order) => Math.max(max, order.attempts), 0);
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put(STORE.META, { key, value });
}

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getOfflineDb();
  const row = await db.get(STORE.META, key);
  return row?.value;
}

export const META_KEYS = {
  LAST_SYNCED: 'last_synced',
  MASTER_VERSION: 'master_version',
  LAST_PRODUCT_REFRESH: 'last_product_refresh',
} as const;
