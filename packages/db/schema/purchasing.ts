/**
 * Purchasing schema — SD §9.4
 *
 * Tables:
 * - purchase_orders       — PO header
 * - purchase_order_lines  — PO line items
 * - goods_receipt_notes   — GRN per delivery (≥1 per PO)
 * - grn_lines             — GRN line items
 * - purchase_invoices     — supplier invoice linked to GRN
 * - purchase_invoice_lines
 */

import {
  bigint,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { pk, tenantCol, locationCol, auditCols, versionCol } from './common';

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // PO-2026-05-0001

    supplierId: text('supplier_id').notNull(), // FK partners (kind='supplier')
    orderDate: date('order_date').notNull(),
    expectedDate: date('expected_date'), // expected delivery

    // SD §9.4: PO status
    status: text('status').notNull().default('draft'),
    // 'draft' | 'submitted' | 'approved' | 'partial' | 'received' | 'closed' | 'cancelled'

    // Totals (bigint rupiah)
    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(BigInt(0)),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(BigInt(0)),
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull().default(BigInt(0)),

    notes: text('notes'),

    // Approval
    submittedBy: text('submitted_by'), // FK users
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // Reference to generated journal entry (AP journal)
    journalEntryId: text('journal_entry_id'), // FK journal_entries

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('purchase_orders_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('purchase_orders_supplier_idx').on(t.supplierId),
    index('purchase_orders_status_idx').on(t.status),
    index('purchase_orders_number_idx').on(t.number),
  ],
);

// ─── Purchase Order Lines ─────────────────────────────────────────────────────

export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    ...pk,

    purchaseOrderId: text('purchase_order_id').notNull(), // FK purchase_orders
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qtyOrdered: numeric('qty_ordered', { precision: 14, scale: 3 }).notNull(),
    qtyReceived: numeric('qty_received', { precision: 14, scale: 3 }).notNull().default('0'),
    uom: text('uom').notNull(),

    unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(),
    lineSubtotal: bigint('line_subtotal', { mode: 'bigint' }).notNull(),
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(BigInt(0)),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    taxCode: text('tax_code'), // FK tax_rates.code

    ...auditCols,
  },
  (t) => [
    index('purchase_order_lines_po_idx').on(t.purchaseOrderId),
    index('purchase_order_lines_product_idx').on(t.productId),
  ],
);

// ─── Goods Receipt Notes ──────────────────────────────────────────────────────

export const goodsReceiptNotes = pgTable(
  'goods_receipt_notes',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // GRN-2026-05-0001

    purchaseOrderId: text('purchase_order_id').notNull(), // FK purchase_orders
    receivedDate: date('received_date').notNull(),
    receivedBy: text('received_by').notNull(), // FK users

    notes: text('notes'),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'confirmed'

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('grn_po_idx').on(t.purchaseOrderId),
    index('grn_tenant_loc_idx').on(t.tenantId, t.locationId),
  ],
);

// ─── GRN Lines ────────────────────────────────────────────────────────────────

export const grnLines = pgTable(
  'grn_lines',
  {
    ...pk,

    grnId: text('grn_id').notNull(), // FK goods_receipt_notes
    poLineId: text('po_line_id').notNull(), // FK purchase_order_lines
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qtyReceived: numeric('qty_received', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    batchNo: text('batch_no'),
    expiryDate: date('expiry_date'),

    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('grn_lines_grn_idx').on(t.grnId),
    index('grn_lines_po_line_idx').on(t.poLineId),
    index('grn_lines_product_idx').on(t.productId),
  ],
);

// ─── Purchase Invoices ────────────────────────────────────────────────────────

export const purchaseInvoices = pgTable(
  'purchase_invoices',
  {
    ...pk,
    ...tenantCol,

    number: text('number').notNull(), // PINV-2026-05-0001
    invoiceNumber: text('invoice_number').notNull(), // supplier's invoice number

    supplierId: text('supplier_id').notNull(), // FK partners
    purchaseOrderId: text('purchase_order_id'), // FK purchase_orders (optional)
    grnId: text('grn_id'), // FK goods_receipt_notes (optional)

    invoiceDate: date('invoice_date').notNull(),
    dueDate: date('due_date').notNull(),

    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull(),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(BigInt(0)),
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull(),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'verified' | 'paid' | 'cancelled'

    paidAmount: bigint('paid_amount', { mode: 'bigint' }).notNull().default(BigInt(0)),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    // Reference to generated journal entry (AP journal)
    journalEntryId: text('journal_entry_id'), // FK journal_entries

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('purchase_invoices_supplier_idx').on(t.supplierId),
    index('purchase_invoices_po_idx').on(t.purchaseOrderId),
    index('purchase_invoices_status_idx').on(t.status),
    index('purchase_invoices_tenant_idx').on(t.tenantId),
  ],
);

export const purchaseInvoiceLines = pgTable(
  'purchase_invoice_lines',
  {
    ...pk,

    invoiceId: text('invoice_id').notNull(), // FK purchase_invoices
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(),
    lineSubtotal: bigint('line_subtotal', { mode: 'bigint' }).notNull(),
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(BigInt(0)),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    taxCode: text('tax_code'),

    ...auditCols,
  },
  (t) => [
    index('purchase_invoice_lines_inv_idx').on(t.invoiceId),
    index('purchase_invoice_lines_product_idx').on(t.productId),
  ],
);
