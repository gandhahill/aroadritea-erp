/**
 * @erp/offline — Demo Mode IndexedDB (SD §34, ADR-0008)
 *
 * Separate IndexedDB (`aroadri-pos-demo`) for training/demo mode.
 * Perfect isolation from production — different DB name = different origin.
 *
 * Stores: products, variants, modifiers, tax_rates (master data snapshot).
 * No `pending_orders` — demo never syncs to server by design.
 *
 * Master snapshot timestamp is tracked so we can warn when data is stale (>24h).
 */

import { type IDBPDatabase, openDB } from 'idb';
import type { DbModifier, DbProduct, DbPromotion, DbTaxRate, DbVariant } from './indexeddb';

// ─── Database constants ────────────────────────────────────────────────────────

export const DEMO_DB_NAME = 'aroadri-pos-demo';
export const DEMO_DB_VERSION = 1;

/** Object store names — subset of production (no pending_orders). */
export const DEMO_STORE = {
  PRODUCTS: 'products',
  VARIANTS: 'variants',
  MODIFIERS: 'modifiers',
  PROMOTIONS: 'promotions',
  TAX_RATES: 'tax_rates',
  META: 'meta',
} as const;

// ─── Meta keys ─────────────────────────────────────────────────────────────────

export const DEMO_META_KEYS = {
  MASTER_SNAPSHOT_AT: 'master_snapshot_at',
  MASTER_VERSION: 'master_version',
  DEMO_ORDER_COUNTER: 'demo_order_counter',
} as const;

// ─── DB upgrade ────────────────────────────────────────────────────────────────

export async function openDemoDb(): Promise<IDBPDatabase> {
  return openDB(DEMO_DB_NAME, DEMO_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(DEMO_STORE.PRODUCTS)) {
        db.createObjectStore(DEMO_STORE.PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DEMO_STORE.VARIANTS)) {
        const store = db.createObjectStore(DEMO_STORE.VARIANTS, { keyPath: 'id' });
        store.createIndex('byProduct', 'productId');
      }
      if (!db.objectStoreNames.contains(DEMO_STORE.MODIFIERS)) {
        db.createObjectStore(DEMO_STORE.MODIFIERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DEMO_STORE.PROMOTIONS)) {
        db.createObjectStore(DEMO_STORE.PROMOTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DEMO_STORE.TAX_RATES)) {
        db.createObjectStore(DEMO_STORE.TAX_RATES, { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains(DEMO_STORE.META)) {
        db.createObjectStore(DEMO_STORE.META, { keyPath: 'key' });
      }
    },
  });
}

// ─── Cached instance ───────────────────────────────────────────────────────────

let _demoDb: IDBPDatabase | null = null;

export async function getDemoDb(): Promise<IDBPDatabase> {
  if (!_demoDb) {
    _demoDb = await openDemoDb();
  }
  return _demoDb;
}

// ─── Meta helpers ──────────────────────────────────────────────────────────────

export async function setDemoMeta(key: string, value: string): Promise<void> {
  const db = await getDemoDb();
  await db.put(DEMO_STORE.META, { key, value });
}

export async function getDemoMeta(key: string): Promise<string | undefined> {
  const db = await getDemoDb();
  const row = await db.get(DEMO_STORE.META, key);
  return row?.value;
}

/** Returns age of the master snapshot in milliseconds, or null if no snapshot. */
export async function getMasterSnapshotAgeMs(): Promise<number | null> {
  const snapshotAt = await getDemoMeta(DEMO_META_KEYS.MASTER_SNAPSHOT_AT);
  if (!snapshotAt) return null;
  return Date.now() - new Date(snapshotAt).getTime();
}

export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function isMasterStale(): Promise<boolean> {
  const age = await getMasterSnapshotAgeMs();
  if (age === null) return true; // no snapshot = stale
  return age > STALE_THRESHOLD_MS;
}

// ─── Demo order counter (for DEMO-XXX order numbers) ──────────────────────────

export async function getNextDemoOrderNumber(): Promise<string> {
  const counterKey = DEMO_META_KEYS.DEMO_ORDER_COUNTER;
  const currentStr = await getDemoMeta(counterKey);
  const current = currentStr ? Number.parseInt(currentStr, 10) : 0;
  const next = current + 1;
  await setDemoMeta(counterKey, String(next));
  return `DEMO-${String(next).padStart(5, '0')}`;
}

// ─── Wipe demo DB (full reset on "Keluar Mode Demo") ─────────────────────────

export async function wipeDemoDb(): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(Object.values(DEMO_STORE), 'readwrite');
  await Promise.all(Object.values(DEMO_STORE).map((s) => tx.objectStore(s).clear()));
  await tx.done;
  _demoDb = null; // force re-init on next access
}

// ─── Demo CRUD for master data (write to demo DB) ─────────────────────────────

export async function upsertDemoProducts(products: DbProduct[]): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(DEMO_STORE.PRODUCTS, 'readwrite');
  await Promise.all([...products.map((p) => tx.store.put(p)), tx.done]);
}

export async function upsertDemoVariants(variants: DbVariant[]): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(DEMO_STORE.VARIANTS, 'readwrite');
  await Promise.all([...variants.map((v) => tx.store.put(v)), tx.done]);
}

export async function upsertDemoModifiers(modifiers: DbModifier[]): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(DEMO_STORE.MODIFIERS, 'readwrite');
  await Promise.all([...modifiers.map((m) => tx.store.put(m)), tx.done]);
}

export async function upsertDemoPromotions(promos: DbPromotion[]): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(DEMO_STORE.PROMOTIONS, 'readwrite');
  await Promise.all([...promos.map((p) => tx.store.put(p)), tx.done]);
}

export async function upsertDemoTaxRates(rates: DbTaxRate[]): Promise<void> {
  const db = await getDemoDb();
  const tx = db.transaction(DEMO_STORE.TAX_RATES, 'readwrite');
  await Promise.all([...rates.map((r) => tx.store.put(r)), tx.done]);
}

// ─── Demo QR prefix ───────────────────────────────────────────────────────────

/** Build a demo QR payload (never sent to Naixer). */
export function buildDemoQrPayload(productCode: string, modifierCodes?: string[]): string {
  const mods = modifierCodes?.join('-') ?? '';
  return `DEMO-${productCode}${mods ? `-${mods}` : ''}`;
}
