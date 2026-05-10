/**
 * Kitchen schema — SD §33.2 (Naixer KDS Integration)
 *
 * Tables:
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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, tenantCol, auditCols } from './common';

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
