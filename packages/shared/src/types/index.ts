/**
 * Common types used across the entire ERP system.
 */

// --- Locale ---

export type Locale = 'id' | 'en' | 'zh';

/** Multi-language string for master data (SD §7.9). Stored as JSONB with CHECK constraint. */
export type LocaleString = Record<Locale, string>;

// --- Pagination ---

export type PaginationParams = {
  page: number;
  pageSize: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// --- Sort & Filter ---

export type SortDirection = 'asc' | 'desc';

export type SortParam = {
  field: string;
  direction: SortDirection;
};

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';

export type FilterParam = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

// --- Audit ---

/** Context passed to every service mutation for audit trail (SD §15, P1). */
export type AuditContext = {
  userId: string;
  tenantId: string;
  locationId: string;
  ipAddress?: string;
  userAgent?: string;
};

// --- Entity Status ---

export type EntityStatus = 'active' | 'inactive';
export type UserStatus = 'active' | 'suspended';
export type PeriodStatus = 'open' | 'closing' | 'closed';
export type JournalStatus = 'draft' | 'posted' | 'reversed';
export type LocationType = 'store' | 'office' | 'warehouse';
export type PartnerKind = 'customer' | 'supplier' | 'employee' | 'other';
export type ProductKind =
  | 'finished_good'
  | 'raw_material'
  | 'merchandise'
  | 'consumable'
  | 'service';
export type TaxCalculation = 'inclusive' | 'exclusive';
export type NormalBalance = 'debit' | 'credit';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'cogs' | 'expense';

// --- Optimistic Locking (SD §8.4) ---

export type Versioned = {
  version: number;
};

// --- Branded types for extra type safety ---

/** Nominal/branded type helper for distinguishing IDs at type level. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type TenantId = Brand<string, 'TenantId'>;
export type LocationId = Brand<string, 'LocationId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type JournalEntryId = Brand<string, 'JournalEntryId'>;
export type PeriodId = Brand<string, 'PeriodId'>;
export type RoleId = Brand<string, 'RoleId'>;
export type PermissionId = Brand<string, 'PermissionId'>;

export * from './permissions';
