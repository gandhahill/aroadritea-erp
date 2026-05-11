/**
 * @erp/offline — POS PWA offline support barrel
 */

// Production (online + offline sync)
export * from './indexeddb.js';
export * from './sync.js';

// Demo mode (client-side sandbox, never syncs to server)
export * from './demo-db.js';
export * from './demo-store.js';
export * from './demo-master.js';

// Re-exports
export type {
  DbProduct,
  DbVariant,
  DbModifier,
  DbPromotion,
  DbTaxRate,
  DbShift,
  DbPendingOrder,
} from './indexeddb.js';
export type {
  DemoCartLine,
  DemoCartPayment,
  DemoCartState,
  DemoOrder,
} from './demo-store.js';
export type { SnapshotResult } from './demo-master.js';
