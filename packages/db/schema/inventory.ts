/**
 * Inventory schema — SD §9.3
 *
 * Tables:
 * - product_categories  — hierarchical product categorization
 * - products            — master product data (tea, food, raw materials)
 * - product_variants    — size × temperature variants (Regular/Large, Hot/Cold)
 * - product_modifiers   — sugar level, ice level, toppings
 * - boms                — Bill of Materials (resep)
 * - bom_lines           — ingredients per BOM
 * - bom_substitutes     — substitusi bahan (creamer A ↔ B)
 * - stock_locations     — sub-locations within a branch (rak, freezer, kitchen)
 * - stock_movements     — append-only stock movement log
 * - stock_levels        — materialized cache of current stock per product/location
 * - stock_adjustments   — adjustment header (waste, count, correction)
 * - stock_transfers     — inter-location transfer header
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { auditCols, isActiveFlag, locationCol, pk, tenantCol, versionCol } from './common';

// ─── Product Categories ───────────────────────────────────────────────────────

export const productCategories = pgTable(
  'product_categories',
  {
    ...pk,
    ...tenantCol,

    code: text('code').notNull(),
    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    parentId: text('parent_id'), // self-referencing hierarchy
    sortOrder: integer('sort_order').notNull().default(0),

    ...isActiveFlag,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('product_categories_tenant_code_idx').on(t.tenantId, t.code),
    index('product_categories_parent_idx').on(t.parentId),
  ],
);

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    ...pk,
    ...tenantCol,

    // SD §9.3: SKU unique per tenant
    sku: text('sku').notNull(),
    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    description: jsonb('description').$type<{ id: string; en: string; zh: string }>(),

    categoryId: text('category_id').notNull(), // FK product_categories

    // SD §9.3: product kind
    kind: text('kind').notNull().default('finished_good'),
    // 'finished_good' | 'raw_material' | 'merchandise' | 'consumable' | 'service'

    uom: text('uom').notNull().default('pcs'), // pcs, kg, liter, g, ml
    opnameFrequency: text('opname_frequency').notNull().default('monthly'),
    // 'daily' | 'weekly' | 'monthly'
    opnameFrequencies: jsonb('opname_frequencies')
      .$type<Array<'daily' | 'weekly' | 'monthly'>>()
      .notNull()
      .default(['monthly']),

    isSellable: boolean('is_sellable').notNull().default(true),
    isPurchasable: boolean('is_purchasable').notNull().default(false),

    // Batch/expiry tracking
    trackBatch: boolean('track_batch').notNull().default(false),
    trackExpiry: boolean('track_expiry').notNull().default(false),
    shelfLifeDays: integer('shelf_life_days'),

    // Default pricing (bigint rupiah — SD §7.8)
    defaultSellPrice: bigint('default_sell_price', { mode: 'bigint' }).notNull().default(sql`0`),
    defaultCostPrice: bigint('default_cost_price', { mode: 'bigint' }).notNull().default(sql`0`),

    // Accounting integration
    cogsAccountId: text('cogs_account_id'), // FK accounts
    revenueAccountId: text('revenue_account_id'), // FK accounts
    inventoryAccountId: text('inventory_account_id'), // FK accounts

    // Tax
    taxCode: text('tax_code'), // FK tax_rates.code

    // Image
    imageUrl: text('image_url'),

    ...isActiveFlag,
    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('products_tenant_sku_idx').on(t.tenantId, t.sku),
    index('products_category_idx').on(t.categoryId),
    index('products_kind_idx').on(t.kind),
    index('products_opname_frequency_idx').on(t.opnameFrequency),
    index('products_tenant_idx').on(t.tenantId),
  ],
);

// ─── Product Variants ─────────────────────────────────────────────────────────

export const productVariants = pgTable(
  'product_variants',
  {
    ...pk,
    ...tenantCol,

    productId: text('product_id').notNull(), // FK products

    // Variant attributes — e.g., Regular/Large × Hot/Cold
    sku: text('sku').notNull(), // variant-specific SKU
    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),

    // Variant-specific pricing override (0 = use product default)
    sellPrice: bigint('sell_price', { mode: 'bigint' }).notNull().default(sql`0`),
    costPrice: bigint('cost_price', { mode: 'bigint' }).notNull().default(sql`0`),

    // Variant dimensions — flexible JSON for size/temperature/etc.
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    // e.g., { "size": "large", "temperature": "cold" }

    sortOrder: integer('sort_order').notNull().default(0),

    ...isActiveFlag,
    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('product_variants_tenant_sku_idx').on(t.tenantId, t.sku),
    index('product_variants_product_idx').on(t.productId),
  ],
);

// ─── Product Modifiers ────────────────────────────────────────────────────────

export const productModifierGroups = pgTable(
  'product_modifier_groups',
  {
    ...pk,
    ...tenantCol,

    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    // e.g., "Sugar Level", "Ice Level", "Topping"

    selectionType: text('selection_type').notNull().default('single'),
    // 'single' | 'multiple'

    isRequired: boolean('is_required').notNull().default(false),
    maxSelections: integer('max_selections'), // NULL = unlimited (for multiple)

    sortOrder: integer('sort_order').notNull().default(0),

    ...isActiveFlag,
    ...auditCols,
  },
  (t) => [index('product_modifier_groups_tenant_idx').on(t.tenantId)],
);

export const productModifierOptions = pgTable(
  'product_modifier_options',
  {
    ...pk,
    ...tenantCol,

    groupId: text('group_id').notNull(), // FK product_modifier_groups

    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    // e.g., "0% Sugar", "50% Sugar", "Normal Sugar"

    // Additional cost for this modifier (0 = no extra charge)
    extraPrice: bigint('extra_price', { mode: 'bigint' }).notNull().default(sql`0`),

    // If topping is also a product (for BOM deduction)
    linkedProductId: text('linked_product_id'), // FK products

    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),

    ...isActiveFlag,
    ...auditCols,
  },
  (t) => [index('product_modifier_options_group_idx').on(t.groupId)],
);

// Link modifiers to products (many-to-many)
export const productModifierLinks = pgTable(
  'product_modifier_links',
  {
    ...pk,

    productId: text('product_id').notNull(), // FK products
    modifierGroupId: text('modifier_group_id').notNull(), // FK product_modifier_groups
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_modifier_links_unique_idx').on(t.productId, t.modifierGroupId),
    index('product_modifier_links_product_idx').on(t.productId),
  ],
);

// ─── Bill of Materials (BOM) ──────────────────────────────────────────────────

export const boms = pgTable(
  'boms',
  {
    ...pk,
    ...tenantCol,

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants — NULL = all variants

    bomVersion: integer('bom_version').notNull().default(1),
    description: text('description'),

    ...isActiveFlag,
    ...versionCol,
    ...auditCols,
  },
  (t) => [index('boms_product_idx').on(t.productId), index('boms_tenant_idx').on(t.tenantId)],
);

export const bomLines = pgTable(
  'bom_lines',
  {
    ...pk,

    bomId: text('bom_id').notNull(), // FK boms
    lineNo: integer('line_no').notNull(),
    ingredientId: text('ingredient_id').notNull(), // FK products (raw material)

    qty: numeric('qty', { precision: 14, scale: 4 }).notNull(),
    uom: text('uom').notNull(), // must match ingredient UOM family

    isOptional: boolean('is_optional').notNull().default(false),
    // e.g., toppings are optional BOM components
    autoDeduct: boolean('auto_deduct').notNull().default(true),
    // false when recipe UOM is a production guide only (e.g. ml) while stock is counted in bottles

    ...auditCols,
  },
  (t) => [
    index('bom_lines_bom_idx').on(t.bomId),
    index('bom_lines_ingredient_idx').on(t.ingredientId),
  ],
);

export const bomSubstitutes = pgTable(
  'bom_substitutes',
  {
    ...pk,

    bomLineId: text('bom_line_id').notNull(), // FK bom_lines
    substituteProductId: text('substitute_product_id').notNull(), // FK products

    // Conversion ratio (e.g., 1.0 = same qty, 1.2 = 20% more needed)
    conversionRatio: numeric('conversion_ratio', { precision: 8, scale: 4 })
      .notNull()
      .default('1.0000'),

    priority: integer('priority').notNull().default(1), // lower = preferred

    ...auditCols,
  },
  (t) => [index('bom_substitutes_bom_line_idx').on(t.bomLineId)],
);

// ─── Stock Locations (sub-locations within a branch) ──────────────────────────

export const stockLocations = pgTable(
  'stock_locations',
  {
    ...pk,
    ...tenantCol,
    ...locationCol, // parent branch location

    code: text('code').notNull(),
    name: jsonb('name').notNull().$type<{ id: string; en: string; zh: string }>(),
    // e.g., "Rak Display", "Freezer 1", "Kitchen Counter"

    locationType: text('location_type').notNull().default('storage'),
    // 'storage' | 'display' | 'kitchen' | 'freezer'

    ...isActiveFlag,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('stock_locations_tenant_loc_code_idx').on(t.tenantId, t.locationId, t.code),
    index('stock_locations_location_idx').on(t.locationId),
  ],
);

// ─── Stock Movements (append-only ledger) ─────────────────────────────────────

export const stockMovements = pgTable(
  'stock_movements',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    stockLocationId: text('stock_location_id'), // FK stock_locations (optional sub-loc)
    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    batchNo: text('batch_no'),
    expiryDate: date('expiry_date'),

    // SD §9.3: + masuk, - keluar
    qtyDelta: numeric('qty_delta', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    // SD §9.3: movement reason
    reason: text('reason').notNull(),
    // 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'production' | 'waste' | 'opening'

    referenceType: text('reference_type'), // 'sales_order' | 'purchase_order' | 'stock_adjustment' | 'stock_transfer'
    referenceId: text('reference_id'),

    // Cost tracking for FIFO/weighted average
    unitCost: bigint('unit_cost', { mode: 'bigint' }), // rupiah per UOM

    ...auditCols,
  },
  (t) => [
    index('stock_movements_product_idx').on(t.productId),
    index('stock_movements_location_idx').on(t.locationId),
    index('stock_movements_occurred_idx').on(t.occurredAt),
    index('stock_movements_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('stock_movements_reference_idx').on(t.referenceType, t.referenceId),
  ],
);

// ─── Stock Levels (materialized cache) ────────────────────────────────────────

export const stockLevels = pgTable(
  'stock_levels',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    stockLocationId: text('stock_location_id'), // FK stock_locations
    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    batchNo: text('batch_no'),
    expiryDate: date('expiry_date'),

    // Current quantity (recalculated from stock_movements)
    qtyOnHand: numeric('qty_on_hand', { precision: 14, scale: 3 }).notNull().default('0'),
    qtyReserved: numeric('qty_reserved', { precision: 14, scale: 3 }).notNull().default('0'),
    qtyAvailable: numeric('qty_available', { precision: 14, scale: 3 }).notNull().default('0'),
    // qty_available = qty_on_hand - qty_reserved

    uom: text('uom').notNull(),

    // Reorder thresholds (per location)
    minStock: numeric('min_stock', { precision: 14, scale: 3 }),
    maxStock: numeric('max_stock', { precision: 14, scale: 3 }),

    // Cost (weighted average or FIFO)
    avgUnitCost: bigint('avg_unit_cost', { mode: 'bigint' }),

    lastMovementAt: timestamp('last_movement_at', { withTimezone: true }),

    ...auditCols,
  },
  (t) => [
    uniqueIndex('stock_levels_unique_idx').on(
      t.tenantId,
      t.locationId,
      t.productId,
      t.variantId,
      t.batchNo,
    ),
    index('stock_levels_product_idx').on(t.productId),
    index('stock_levels_low_stock_idx').on(t.tenantId, t.productId),
    check('stock_levels_qty_check', sql`${t.qtyOnHand} >= 0`),
    check('stock_levels_available_check', sql`${t.qtyAvailable} >= 0`),
  ],
);

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // ADJ-2026-05-0001
    adjustmentDate: date('adjustment_date').notNull(),

    reason: text('reason').notNull(),
    // 'waste' | 'damage' | 'count_correction' | 'opening_balance' | 'other'

    notes: text('notes'),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'submitted' | 'approved' | 'rejected'

    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('stock_adjustments_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('stock_adjustments_status_idx').on(t.status),
  ],
);

// ─── Stock Transfers ──────────────────────────────────────────────────────────

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    ...pk,
    ...tenantCol,

    number: text('number').notNull(), // TRF-2026-05-0001
    transferDate: date('transfer_date').notNull(),

    fromLocationId: text('from_location_id').notNull(), // FK locations
    toLocationId: text('to_location_id').notNull(), // FK locations

    notes: text('notes'),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'in_transit' | 'received' | 'cancelled'
    // SD §9.3: 2-step transfer — shipped from source → received at destination

    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    shippedBy: text('shipped_by'), // FK users
    receivedAt: timestamp('received_at', { withTimezone: true }),
    receivedBy: text('received_by'), // FK users

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('stock_transfers_tenant_idx').on(t.tenantId),
    index('stock_transfers_from_idx').on(t.fromLocationId),
    index('stock_transfers_to_idx').on(t.toLocationId),
    index('stock_transfers_status_idx').on(t.status),
  ],
);

// ─── Stock Transfer Lines ─────────────────────────────────────────────────────

export const stockTransferLines = pgTable(
  'stock_transfer_lines',
  {
    ...pk,

    transferId: text('transfer_id').notNull(), // FK stock_transfers
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants
    batchNo: text('batch_no'),

    qtySent: numeric('qty_sent', { precision: 14, scale: 3 }).notNull(),
    qtyReceived: numeric('qty_received', { precision: 14, scale: 3 }),
    uom: text('uom').notNull(),

    ...auditCols,
  },
  (t) => [
    index('stock_transfer_lines_transfer_idx').on(t.transferId),
    index('stock_transfer_lines_product_idx').on(t.productId),
  ],
);

// ─── Stock Adjustment Lines ───────────────────────────────────────────────────

export const stockAdjustmentLines = pgTable(
  'stock_adjustment_lines',
  {
    ...pk,

    adjustmentId: text('adjustment_id').notNull(), // FK stock_adjustments
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants
    batchNo: text('batch_no'),

    qtyBefore: numeric('qty_before', { precision: 14, scale: 3 }).notNull(),
    qtyAfter: numeric('qty_after', { precision: 14, scale: 3 }).notNull(),
    qtyDelta: numeric('qty_delta', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    unitCost: bigint('unit_cost', { mode: 'bigint' }), // for valuation
    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('stock_adjustment_lines_adj_idx').on(t.adjustmentId),
    index('stock_adjustment_lines_product_idx').on(t.productId),
  ],
);
