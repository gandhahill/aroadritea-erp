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
} from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol, versionCol } from './common';

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

export const posSettings = pgTable(
  'pos_settings',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    pb1TaxCode: text('pb1_tax_code').notNull().default('PB1'),
    cashAccountCode: text('cash_account_code').notNull().default('1-1300'),
    revenueAccountCode: text('revenue_account_code').notNull().default('4-1100'),
    donationTrustAccountCode: text('donation_trust_account_code').notNull().default('2-2050'),
    // Per-outlet bank account used when petty cash is deposited back to the
    // bank (Setor ke Bank). Defaults to the generic Bank account in COA.
    bankAccountCode: text('bank_account_code').notNull().default('1-1200'),
    bankAccountLabel: text('bank_account_label'),
    deliveryChannelsJson: jsonb('delivery_channels_json')
      .$type<
        Array<
          | string
          | {
              id: string;
              label?: string;
              netBps?: number;
              commissionBps?: number;
              enabled?: boolean;
            }
        >
      >()
      .notNull()
      .default(['gofood', 'grabfood', 'shopeefood']),
    deliveryNetBps: integer('delivery_net_bps').notNull().default(8000),
    receiptWidthMm: integer('receipt_width_mm').notNull().default(80),
    receiptLabelWidthMm: integer('receipt_label_width_mm').notNull().default(40),
    receiptLabelHeightMm: integer('receipt_label_height_mm').notNull().default(30),
    receiptShowLogo: boolean('receipt_show_logo').notNull().default(true),
    receiptOutletPhone: text('receipt_outlet_phone'),
    receiptOutletAddress: text('receipt_outlet_address'),
    receiptInstagram: text('receipt_instagram').default('@aroadri.tea'),
    receiptTiktok: text('receipt_tiktok').default('@aroadri.tea'),
    receiptWebsite: text('receipt_website').default('aroadritea.com'),
    receiptFooterText: text('receipt_footer_text'),

    // Print routing (#16): the cashier OS may have two thermal printers
    // attached — a wide receipt printer and a small cup-label printer.
    // The configured name is matched by the local Print Bridge agent (Phase 2);
    // when the browser is launched with `--kiosk-printing` (Phase 1), these
    // columns serve as documentation for the operator selecting the OS default.
    receiptPrinterName: text('receipt_printer_name'),
    labelPrinterName: text('label_printer_name'),
    /**
     * When true, the receipt/label auto-print pages skip the 250 ms delay
     * and call `window.print()` immediately. The cashier Chrome must be
     * launched with `--kiosk-printing` so the dialog is suppressed.
     * Default false — keep the preview dialog visible until the operator
     * explicitly opts in from the POS settings UI.
     */
    kioskPrintingEnabled: boolean('kiosk_printing_enabled').notNull().default(false),

    ...auditCols,
  },
  (t) => [
    uniqueIndex('pos_settings_tenant_location_idx').on(t.tenantId, t.locationId),
    index('pos_settings_location_idx').on(t.locationId),
  ],
);

export const manualSalesClosings = pgTable(
  'manual_sales_closings',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(),
    salesDate: date('sales_date').notNull(),
    channel: text('channel').notNull().default('walk_in'),
    paymentMethod: text('payment_method').notNull().default('cash'),

    transactionCount: integer('transaction_count').notNull().default(0),
    grossSales: bigint('gross_sales', { mode: 'bigint' }).notNull().default(sql`0`),
    discountTotal: bigint('discount_total', { mode: 'bigint' }).notNull().default(sql`0`),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(sql`0`),
    netRevenue: bigint('net_revenue', { mode: 'bigint' }).notNull().default(sql`0`),

    sourceReference: text('source_reference'),
    notes: text('notes'),
    status: text('status').notNull().default('posted'),
    journalEntryId: text('journal_entry_id'),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    uniqueIndex('manual_sales_closings_tenant_number_idx').on(t.tenantId, t.number),
    uniqueIndex('manual_sales_closings_source_idx').on(
      t.tenantId,
      t.locationId,
      t.salesDate,
      t.channel,
      t.paymentMethod,
      t.sourceReference,
    ),
    index('manual_sales_closings_location_date_idx').on(t.tenantId, t.locationId, t.salesDate),
    index('manual_sales_closings_journal_idx').on(t.journalEntryId),
  ],
);

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
    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    discountTotal: bigint('discount_total', { mode: 'bigint' }).notNull().default(sql`0`),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(sql`0`),
    // PB1 inclusive — back-out from subtotal for reporting
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull().default(sql`0`),

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
    lineDiscount: bigint('line_discount', { mode: 'bigint' }).notNull().default(sql`0`),
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(sql`0`),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    // Modifier snapshot — frozen at order time
    modifierJson: jsonb('modifier_json').$type<{
      sugar?: string;
      ice?: string;
      toppings?: Array<{ name: string; price: number }>;
    }>(),

    // KDS integration (SD §33)
    kdsQrToken: text('kds_qr_token'),
    kdsQrPayload: text('kds_qr_payload'),

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
  (t) => [index('refund_lines_refund_idx').on(t.refundId)],
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
