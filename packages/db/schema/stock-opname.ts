/**
 * Stock Opname schema — SD §25.9
 *
 * Tables:
 * - stock_opname_sessions  — opname session header
 * - stock_opname_lines      — per-product counted vs system qty
 * - stock_movement_manual   — staging table for Excel-imported movements (T-0074)
 */

import {
  bigint,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol, versionCol } from './common';

// ─── Stock Opname Sessions ───────────────────────────────────────────────────

export const stockOpnameSessions = pgTable(
  'stock_opname_sessions',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // SO-2026-05-0001
    sessionDate: date('session_date').notNull(),
    periodCode: text('period_code').notNull(), // linked accounting period for JE

    status: text('status').notNull().default('draft'),
    // 'draft' | 'in_progress' | 'submitted' | 'approved' | 'cancelled'

    // SD §25.9 — opname frequency. `daily` = closing-shift cup count,
    // `weekly` = menu/dessert spot count, and `monthly` = full count.
    kind: text('kind').notNull().default('monthly'),
    // 'daily' | 'weekly' | 'monthly'

    preparedBy: text('prepared_by'), // FK users
    preparedAt: timestamp('prepared_at', { withTimezone: true }),

    submittedBy: text('submitted_by'), // FK users
    submittedAt: timestamp('submitted_at', { withTimezone: true }),

    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    notes: text('notes'),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('stock_opname_sessions_number_idx').on(t.number),
    index('stock_opname_sessions_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('stock_opname_sessions_status_idx').on(t.status),
    index('stock_opname_sessions_date_idx').on(t.sessionDate),
  ],
);

// ─── Stock Opname Lines ──────────────────────────────────────────────────────

export const stockOpnameLines = pgTable(
  'stock_opname_lines',
  {
    ...pk,

    sessionId: text('session_id').notNull(), // FK stock_opname_sessions

    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants (nullable)

    uom: text('uom').notNull(),

    // Snapshot of system qty at time of session creation
    systemQty: numeric('system_qty', { precision: 14, scale: 3 }).notNull(),

    // Physical count input
    countedQty: numeric('counted_qty', { precision: 14, scale: 3 }),
    isCounted: boolean('is_counted').notNull().default(false),

    // Variance (calculated on submit)
    varianceQty: numeric('variance_qty', { precision: 14, scale: 3 }),
    varianceValue: bigint('variance_value', { mode: 'bigint' }), // |varianceQty| × avgUnitCost

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (t) => [
    index('stock_opname_lines_session_idx').on(t.sessionId),
    index('stock_opname_lines_product_idx').on(t.productId),
    uniqueIndex('stock_opname_lines_session_product_idx').on(t.sessionId, t.productId, t.variantId),
  ],
);

// ─── Stock Movement Manual (Excel import staging) ───────────────────────────
// T-0074: imported movements from Sheet 2 of the opname Excel template.
// Not part of the opname session workflow — acts as a staging table
// that will be processed separately.

export const stockMovementManual = pgTable(
  'stock_movement_manual',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    movementDate: date('movement_date').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants (nullable)
    batchNo: text('batch_no'),

    qtyDelta: numeric('qty_delta', { precision: 14, scale: 3 }).notNull(),
    // can be positive (increase) or negative (decrease)
    uom: text('uom').notNull(),

    reason: text('reason').notNull().default('manual_import'),
    // 'manual_import' | 'correction' | 'other'

    reference: text('reference'), // source document or notes

    processed: boolean('processed').notNull().default(false),
    // set to true once movements have been applied to stock_levels + stock_movements

    processedAt: timestamp('processed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
  },
  (t) => [
    index('stock_movement_manual_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('stock_movement_manual_date_idx').on(t.movementDate),
    index('stock_movement_manual_product_idx').on(t.productId),
    index('stock_movement_manual_unprocessed_idx').on(t.processed),
  ],
);
