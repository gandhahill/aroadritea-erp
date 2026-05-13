/**
 * Common schema helpers — reusable column definitions for all tables.
 * SD §8.1: Every transactional table MUST have audit columns.
 * SD §7.10: Primary key is ULID (text, 26 chars).
 */

import { sql } from 'drizzle-orm';
import { boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';

// --- Primary Key ---

/** ULID primary key column. Use generateId() from @erp/shared/id at insert time. */
export const pk = {
  id: text('id').primaryKey(),
};

// --- Tenant & Location dimension ---

/** Tenant ID column — multi-tenant ready (SD §8.1). Default 'default'. */
export const tenantCol = {
  tenantId: text('tenant_id').notNull().default('default'),
};

/** Location dimension column (SD §12). FK enforced by application, not DB constraint (polymorphic). */
export const locationCol = {
  locationId: text('location_id').notNull(),
};

// --- Audit columns (SD §8.1) ---

export const auditCols = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
};

// --- Optimistic locking (SD §8.4) ---

export const versionCol = {
  version: integer('version').notNull().default(1),
};

// --- Soft delete filter helper ---

/** SQL fragment for active records only (SD §8.3). */
export const isActive = sql`deleted_at IS NULL`;

// --- Status columns ---

export const statusCol = (defaultValue = 'active') => ({
  status: text('status').notNull().default(defaultValue),
});

// --- Boolean flags ---

export const isActiveFlag = {
  isActive: boolean('is_active').notNull().default(true),
};
