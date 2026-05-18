/**
 * @erp/offline — POS PWA offline support barrel
 */

// Production (online + offline sync)
export * from './indexeddb';
export * from './sync';

// Demo mode (client-side sandbox, never syncs to server)
export * from './demo-db';
export * from './demo-store';
export * from './demo-master';

// Re-exports
export type {
  DbProduct,
  DbVariant,
  DbModifier,
  DbPromotion,
  DbTaxRate,
  DbShift,
  DbPendingOrder,
} from './indexeddb';
export type {
  DemoCartCustomer,
  DemoCartLine,
  DemoCartPayment,
  DemoCartState,
  DemoOrder,
} from './demo-store';
export type { SnapshotResult } from './demo-master';
