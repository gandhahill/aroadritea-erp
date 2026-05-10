/**
 * Kitchen schema — SD §21.7 + §33.2 (KDS + Naixer Integration)
 *
 * Tables:
 * - kds_order_items         — production status tracking per order line
 * - naixer_product_codes    — maps ERP products to Naixer vendor codes
 * - naixer_modifier_codes   — maps ERP modifiers to Naixer spec codes
 * - naixer_qr_format_config — per-location QR format strategy (dash/pipe)
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, tenantCol, locationCol, auditCols } from './common';

// ─── KDS Order Items (SD §21.7) ─────────────────────────────────────────────

export const kdsOrderItems = pgTable(
  'kds_order_items',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    salesOrderId: text('sales_order_id').notNull(), // FK sales_orders
    salesOrderLineId: text('sales_order_line_id').notNull(), // FK sales_order_lines

    // 'queued' | 'making' | 'ready' | 'served' | 'cancelled'
    status: text('status').notNull().default('queued'),

    pickupNumber: integer('pickup_number').notNull(),

    productSummary: text('product_summary').notNull(),
    qrPayload: text('qr_payload'),

    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    makingAt: timestamp('making_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    servedAt: timestamp('served_at', { withTimezone: true }),

    preparedBy: text('prepared_by'), // FK users — who marked making/ready

    ...auditCols,
  },
  (t) => [
    index('kds_order_items_location_status_idx').on(t.locationId, t.status),
    index('kds_order_items_order_idx').on(t.salesOrderId),
    uniqueIndex('kds_order_items_line_idx').on(t.salesOrderLineId),
    index('kds_order_items_queued_at_idx').on(t.queuedAt),
  ],
);

// ─── Naixer Product Codes ────────────────────────────────────────────────────

export const naixerProductCodes = pgTable(
  'naixer_product_codes',
  {
    ...pk,
    ...tenantCol,

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants (null = all variants)

    naixerCode: text('naixer_code').notNull(), // e.g. 'T003'

    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (t) => [
    uniqueIndex('naixer_product_codes_unique_idx').on(
      t.tenantId,
      t.productId,
      t.variantId,
    ),
    index('naixer_product_codes_product_idx').on(t.productId),
  ],
);

// ─── Naixer Modifier Codes ───────────────────────────────────────────────────

export const naixerModifierCodes = pgTable(
  'naixer_modifier_codes',
  {
    ...pk,
    ...tenantCol,

    // 'size' | 'ice' | 'sugar' | 'topping' | 'cup' | 'other'
    modifierKind: text('modifier_kind').notNull(),

    modifierOptionId: text('modifier_option_id').notNull(), // FK product_modifier_options

    naixerCode: text('naixer_code').notNull(), // e.g. 'C01', 'S02', 'W01'

    displayOrder: integer('display_order').notNull().default(0),

    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (t) => [
    uniqueIndex('naixer_modifier_codes_unique_idx').on(
      t.tenantId,
      t.modifierOptionId,
    ),
    index('naixer_modifier_codes_kind_idx').on(t.modifierKind),
  ],
);

// ─── Naixer QR Format Config ────────────────────────────────────────────────

export const naixerQrFormatConfig = pgTable(
  'naixer_qr_format_config',
  {
    ...pk,

    locationId: text('location_id').notNull(), // FK locations

    // 'dash' (Format B, default) | 'pipe' (Format A, vendor documented)
    format: text('format').notNull().default('dash'),

    includeOrderId: boolean('include_order_id').notNull().default(false),

    // e.g. ["product","size","ice","sugar","topping"]
    parameterOrderJson: jsonb('parameter_order_json').notNull(),

    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (t) => [
    uniqueIndex('naixer_qr_format_config_location_idx').on(t.locationId),
  ],
);
