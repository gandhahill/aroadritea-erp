/**
 * @erp/offline — POS PWA offline support barrel
 */

export * from './indexeddb.js';
export * from './sync.js';

// Re-export types for consumers
export type { DbProduct, DbVariant, DbModifier, DbPromotion, DbTaxRate, DbShift, DbPendingOrder } from './indexeddb.js';
