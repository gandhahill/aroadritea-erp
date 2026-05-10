/**
 * @erp/db — Database package barrel export.
 */

// Client
export { db } from './client';
export type { Database } from './client';

// Schema — IAM
export {
  apiTokens,
  locations,
  permissions,
  rolePermissions,
  roles,
  sessions,
  tenants,
  userRoles,
  users,
} from './schema/auth';

// Schema — Accounting
export {
  accountingPeriods,
  accounts,
  journalEntries,
  journalLines,
  partners,
  journalAttachments,
  pettyCashAccounts,
  pettyCashTransactions,
  reimbursementRequests,
  taxRates,
  taxRules,
} from './schema/accounting';

// Schema — Audit
export { auditLog } from './schema/audit';

// Schema — Inventory (SD §9.3)
export {
  productCategories,
  products,
  productVariants,
  productModifierGroups,
  productModifierOptions,
  productModifierLinks,
  boms,
  bomLines,
  bomSubstitutes,
  stockLocations,
  stockMovements,
  stockLevels,
  stockAdjustments,
  stockAdjustmentLines,
  stockTransfers,
  stockTransferLines,
} from './schema/inventory';

// Schema — POS / Sales (SD §9.5)
export {
  shifts,
  salesOrders,
  salesOrderLines,
  payments,
  refunds,
  refundLines,
  idempotencyRecords,
} from './schema/pos';

// Schema — Purchasing (SD §9.4)
export {
  purchaseOrders,
  purchaseOrderLines,
  goodsReceiptNotes,
  grnLines,
  purchaseInvoices,
  purchaseInvoiceLines,
} from './schema/purchasing';

// Schema — Scheduled Jobs
export { scheduledJobs } from './schema/scheduled-jobs';

// Schema — Common helpers
export {
  auditCols,
  isActive,
  isActiveFlag,
  locationCol,
  pk,
  tenantCol,
  versionCol,
} from './schema/common';

// Schema — Stock Opname (SD §25.9)
export {
  stockOpnameSessions,
  stockOpnameLines,
  stockMovementManual,
} from './schema/stock-opname';

// Schema — Kitchen / KDS (SD §21.7, §33.2)
export {
  kdsOrderItems,
  naixerProductCodes,
  naixerModifierCodes,
  naixerQrFormatConfig,
} from './schema/kitchen';

// Drizzle-ORM operators (re-exported for downstream consumers)
export { eq, and, or, not, lte, gte, lt, gt, isNull, isNotNull, sql, inArray, desc, asc, ilike } from 'drizzle-orm';
