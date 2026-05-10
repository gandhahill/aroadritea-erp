/**
 * POS / Sales schema — SD §9.5
 *
 * Tables:
 * - shifts              — kasir shift open/close
 * - sales_orders        — POS order header
 * - sales_order_lines   — order line items
 * - payments            — split payment support
 * - refunds             — return/refund header
 * - refund_lines        — refund line items
 * - idempotency_records — offline sync dedup (SD §35.1.1)
 */

import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { pk, tenantCol, locationCol, auditCols, versionCol } from './common';

// ─── Shifts ───────────────────────────────────────────────────────────────────

export const shifts = pgTable(
  'shifts',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    openedBy: text('opened_by').notNull(), // FK users
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    openingCash: bigint('opening_cash', { mode: 'bigint' }).notNull(),

    closedBy: text('closed_by'), // FK users
    closedAt: timestamp('closed_at', { withTimezone: true }),
    expectedCash: bigint('expected_cash', { mode: 'bigint' }), // calculated by system
    actualCash: bigint('actual_cash', { mode: 'bigint' }), // input by cashier
    variance: bigint('variance', { mode: 'bigint' }), // actual - expected

    status: text('status').notNull().default('open'),
    // 'open' | 'closed'

    ...auditCols,
  },
  (t) => [
    index('shifts_location_idx').on(t.locationId),
    index('shifts_status_idx').on(t.status),
    index('shifts_opened_at_idx').on(t.openedAt),
  ],
);

// ─── Sales Orders (POS Order) ─────────────────────────────────────────────────

export const salesOrders = pgTable(
  'sales_orders',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    // Auto: T01-2026-05-0001 (SD §9.5)
    number: text('number').notNull(),

    shiftId: text('shift_id').notNull(), // FK shifts
    cashierId: text('cashier_id').notNull(), // FK users

    // SD §9.5: channel type
    channel: text('channel').notNull().default('walk_in'),
    // 'walk_in' | 'gofood' | 'grabfood' | 'shopeefood'

    // SD §9.5: order status
    status: text('status').notNull().default('open'),
    // 'open' | 'paid' | 'refunded' | 'voided'

    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),

    // Totals (bigint rupiah — SD §7.8)
    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(BigInt(0)),
    discountTotal: bigint('discount_total', { mode: 'bigint' }).notNull().default(BigInt(0)),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(BigInt(0)),
    // PB1 inclusive — back-out from subtotal for reporting
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull().default(BigInt(0)),

    // Customer (optional — member)
    customerId: text('customer_id'), // FK partners

    // SD §9.5: idempotency for offline sync
    idempotencyKey: text('idempotency_key').notNull(),

    // Reference to generated journal entry
    journalEntryId: text('journal_entry_id'), // FK journal_entries

    notes: text('notes'),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('sales_orders_idempotency_idx').on(t.locationId, t.idempotencyKey),
    index('sales_orders_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('sales_orders_shift_idx').on(t.shiftId),
    index('sales_orders_number_idx').on(t.number),
    index('sales_orders_status_idx').on(t.status),
    index('sales_orders_placed_at_idx').on(t.placedAt),
    index('sales_orders_channel_idx').on(t.channel),
  ],
);

// ─── Sales Order Lines ────────────────────────────────────────────────────────

export const salesOrderLines = pgTable(
  'sales_order_lines',
  {
    ...pk,

    salesOrderId: text('sales_order_id').notNull(), // FK sales_orders
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
    unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(), // inclusive PB1

    lineSubtotal: bigint('line_subtotal', { mode: 'bigint' }).notNull(), // qty × unit_price
    lineDiscount: bigint('line_discount', { mode: 'bigint' }).notNull().default(BigInt(0)),
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(BigInt(0)),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    // Modifier snapshot — frozen at order time
    modifierJson: jsonb('modifier_json').$type<{
      sugar?: string;
      ice?: string;
      toppings?: Array<{ name: string; price: number }>;
    }>(),

    // KDS integration (SD §33)
    kdsQrToken: text('kds_qr_token'),

    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('sales_order_lines_order_idx').on(t.salesOrderId),
    index('sales_order_lines_product_idx').on(t.productId),
  ],
);

// ─── Payments ─────────────────────────────────────────────────────────────────

export const payments = pgTable(
  'payments',
  {
    ...pk,

    salesOrderId: text('sales_order_id').notNull(), // FK sales_orders

    // SD §9.5: payment method
    method: text('method').notNull(),
    // 'cash' | 'qris' | 'flazz' | 'debit' | 'credit' | 'gofood' | 'grabfood' | 'shopeefood'

    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    reference: text('reference'), // transaction reference/receipt number

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    // SD §25.11 — donation / rounding
    donationAmount: bigint('donation_amount', { mode: 'bigint' }), // nullable; amount donated instead of change
    roundingOption: text('rounding_option'), // 'donate' | 'round_up' | 'no_donation'

    ...auditCols,
  },
  (t) => [
    index('payments_order_idx').on(t.salesOrderId),
    index('payments_method_idx').on(t.method),
  ],
);

// ─── Refunds ──────────────────────────────────────────────────────────────────

export const refunds = pgTable(
  'refunds',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    salesOrderId: text('sales_order_id').notNull(), // FK sales_orders
    number: text('number').notNull(), // REF-2026-05-0001

    reason: text('reason').notNull(),
    refundAmount: bigint('refund_amount', { mode: 'bigint' }).notNull(),

    // Payment method for the refund
    refundMethod: text('refund_method').notNull(),
    // 'cash' | 'original_method'

    status: text('status').notNull().default('pending'),
    // 'pending' | 'approved' | 'completed' | 'rejected'

    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // Reference to reversal journal entry
    journalEntryId: text('journal_entry_id'), // FK journal_entries

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('refunds_order_idx').on(t.salesOrderId),
    index('refunds_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('refunds_status_idx').on(t.status),
  ],
);

export const refundLines = pgTable(
  'refund_lines',
  {
    ...pk,

    refundId: text('refund_id').notNull(), // FK refunds
    salesOrderLineId: text('sales_order_line_id').notNull(), // FK sales_order_lines
    lineNo: integer('line_no').notNull(),

    qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),

    ...auditCols,
  },
  (t) => [
    index('refund_lines_refund_idx').on(t.refundId),
  ],
);

// ─── Idempotency Records (SD §35.1.1) ────────────────────────────────────────

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    ...pk,

    idempotencyKey: text('idempotency_key').notNull(),
    locationId: text('location_id').notNull(),

    // Cached response
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // 24 hour TTL per SD §35.1.1
  },
  (t) => [
    uniqueIndex('idempotency_records_key_loc_idx').on(t.idempotencyKey, t.locationId),
    index('idempotency_records_expires_idx').on(t.expiresAt),
  ],
);
