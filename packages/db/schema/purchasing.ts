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
    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(sql`0`),
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull().default(sql`0`),

    notes: text('notes'),

    // Approval
    submittedBy: text('submitted_by'), // FK users
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    // Reference to generated journal entry (AP journal)
    journalEntryId: text('journal_entry_id'), // FK journal_entries

    // Shipment tracking cache (BinderByte). Stored on PO so the UI never
    // burns the monthly API quota just by opening the purchasing page.
    shippingCourierCode: text('shipping_courier_code'),
    shippingAwb: text('shipping_awb'),
    shippingPhoneLast5: text('shipping_phone_last5'),
    shippingTrackingStatus: text('shipping_tracking_status'),
    shippingTrackingSummary: jsonb('shipping_tracking_summary'),
    shippingTrackingHistory: jsonb('shipping_tracking_history'),
    shippingTrackingSyncedAt: timestamp('shipping_tracking_synced_at', { withTimezone: true }),
    shippingTrackingError: text('shipping_tracking_error'),

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
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(sql`0`),
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

// ─── Purchase Requisitions (T-0229) ─────────────────────────────────────────────

export const purchaseRequisitions = pgTable(
  'purchase_requisitions',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // PRQ-2026-05-0001
    requestDate: date('request_date').notNull(),
    requestedBy: text('requested_by').notNull(), // FK users

    status: text('status').notNull().default('draft'),
    // 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted'

    notes: text('notes'),

    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('purchase_requisitions_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('purchase_requisitions_status_idx').on(t.status),
    index('purchase_requisitions_number_idx').on(t.number),
  ],
);

export const purchaseRequisitionLines = pgTable(
  'purchase_requisition_lines',
  {
    ...pk,

    prId: text('pr_id').notNull(), // FK purchase_requisitions
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qtyRequested: numeric('qty_requested', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('purchase_requisition_lines_pr_idx').on(t.prId),
    index('purchase_requisition_lines_product_idx').on(t.productId),
  ],
);

// ─── RFQ / Quotation (T-0229) ──────────────────────────────────────────────────

export const rfqs = pgTable(
  'rfqs',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // RFQ-2026-05-0001
    prId: text('pr_id'), // FK purchase_requisitions (optional)

    rfqDate: date('rfq_date').notNull(),
    deadlineDate: date('deadline_date').notNull(),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'sent' | 'closed' | 'cancelled'

    notes: text('notes'),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('rfqs_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('rfqs_status_idx').on(t.status),
  ],
);

export const rfqLines = pgTable(
  'rfq_lines',
  {
    ...pk,

    rfqId: text('rfq_id').notNull(), // FK rfqs
    lineNo: integer('line_no').notNull(),

    productId: text('product_id').notNull(), // FK products
    variantId: text('variant_id'), // FK product_variants

    qty: numeric('qty', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    ...auditCols,
  },
  (t) => [
    index('rfq_lines_rfq_idx').on(t.rfqId),
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
    // Quality check: qty rejected (damaged / not matching) — recorded for the
    // record (and to drive a claim/return); only qtyReceived enters stock.
    qtyRejected: numeric('qty_rejected', { precision: 14, scale: 3 }).notNull().default('0'),
    rejectReason: text('reject_reason'),
    // Actual unit price captured at receiving (money, integer rupiah). When the
    // PO price was unknown (0) at order time, the price entered here is used for
    // valuation and back-fills the PO line price.
    unitPrice: bigint('unit_price', { mode: 'bigint' }),
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
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(sql`0`),
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull(),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'verified' | 'paid' | 'cancelled'

    paidAmount: bigint('paid_amount', { mode: 'bigint' }).notNull().default(sql`0`),
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
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(sql`0`),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    taxCode: text('tax_code'),

    ...auditCols,
  },
  (t) => [
    index('purchase_invoice_lines_inv_idx').on(t.invoiceId),
    index('purchase_invoice_lines_product_idx').on(t.productId),
  ],
);

// ─── Purchase Returns (T-0180) ────────────────────────────────────────────────
//
// Tracks goods returned to a supplier *after* GRN — broken/expired stock,
// wrong delivery, etc. Posts a JE (DR Accounts Payable / CR Inventory) on
// `post` and decrements stock_levels via the standard stock movement path
// (kind = 'purchase_return').

export const purchaseReturns = pgTable(
  'purchase_returns',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // PR-2026-05-0001

    supplierId: text('supplier_id').notNull(), // FK partners (kind='supplier')

    // Source GRN — required so we can validate qty (can't return more
    // than was received). PO is derived through the GRN if needed.
    grnId: text('grn_id').notNull(), // FK goods_receipt_notes

    returnDate: date('return_date').notNull(),
    reason: text('reason').notNull(), // free text; e.g. "broken on arrival"

    status: text('status').notNull().default('draft'),
    // 'draft' | 'submitted' | 'approved' | 'posted' | 'cancelled'

    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    taxTotal: bigint('tax_total', { mode: 'bigint' }).notNull().default(sql`0`),
    grandTotal: bigint('grand_total', { mode: 'bigint' }).notNull().default(sql`0`),

    notes: text('notes'),

    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    postedBy: text('posted_by'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    // Reference to generated journal entry (reverses AP + Inventory).
    journalEntryId: text('journal_entry_id'),

    ...versionCol,
    ...auditCols,
  },
  (t) => [
    index('purchase_returns_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('purchase_returns_supplier_idx').on(t.supplierId),
    index('purchase_returns_grn_idx').on(t.grnId),
    index('purchase_returns_status_idx').on(t.status),
    index('purchase_returns_number_idx').on(t.number),
  ],
);

export const purchaseReturnLines = pgTable(
  'purchase_return_lines',
  {
    ...pk,

    returnId: text('return_id').notNull(), // FK purchase_returns
    lineNo: integer('line_no').notNull(),

    // Mirror of grn_lines so the return is self-contained — handles the
    // edge case where the source GRN line is later corrected.
    grnLineId: text('grn_line_id').notNull(),
    productId: text('product_id').notNull(),
    variantId: text('variant_id'),

    qtyReturned: numeric('qty_returned', { precision: 14, scale: 3 }).notNull(),
    uom: text('uom').notNull(),

    unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull(),
    lineSubtotal: bigint('line_subtotal', { mode: 'bigint' }).notNull(),
    lineTax: bigint('line_tax', { mode: 'bigint' }).notNull().default(sql`0`),
    lineTotal: bigint('line_total', { mode: 'bigint' }).notNull(),

    taxCode: text('tax_code'),
    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('purchase_return_lines_return_idx').on(t.returnId),
    index('purchase_return_lines_grn_line_idx').on(t.grnLineId),
    index('purchase_return_lines_product_idx').on(t.productId),
  ],
);

export const shipmentTrackingRequests = pgTable(
  'shipment_tracking_requests',
  {
    ...pk,
    ...tenantCol,
    purchaseOrderId: text('purchase_order_id').notNull(),
    courierCode: text('courier_code').notNull(),
    awb: text('awb').notNull(),
    phoneLast5: text('phone_last5'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    success: boolean('success').notNull().default(false),
    httpStatus: integer('http_status'),
    responseJson: jsonb('response_json'),
    errorMessage: text('error_message'),
    ...auditCols,
  },
  (t) => [
    index('shipment_tracking_req_tenant_month_idx').on(t.tenantId, t.requestedAt),
    index('shipment_tracking_req_po_idx').on(t.purchaseOrderId),
  ],
);

// ─── Supplier Price List (T-0231) ─────────────────────────────────────────────

export const supplierProducts = pgTable(
  'supplier_products',
  {
    ...pk,
    ...tenantCol,

    supplierId: text('supplier_id').notNull(), // FK partners
    productId: text('product_id').notNull(), // FK products
    supplierProductCode: text('supplier_product_code'),
    supplierProductName: text('supplier_product_name'),

    unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(),
    uom: text('uom').notNull(),
    minOrderQty: numeric('min_order_qty', { precision: 14, scale: 3 }).notNull().default('1'),
    leadTimeDays: integer('lead_time_days').notNull().default(0),

    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),

    ...auditCols,
  },
  (t) => [
    index('supplier_products_supplier_idx').on(t.supplierId),
    index('supplier_products_product_idx').on(t.productId),
    uniqueIndex('supplier_products_supplier_product_idx').on(t.supplierId, t.productId),
  ],
);

// ─── Landed Costs (T-0231) ──────────────────────────────────────────────────

export const landedCosts = pgTable(
  'landed_costs',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    grnId: text('grn_id').notNull(), // FK goods_receipt_notes
    costType: text('cost_type').notNull(), // 'shipping' | 'insurance' | 'customs' | 'other'
    
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    allocationMethod: text('allocation_method').notNull().default('value'), // 'value' | 'qty' | 'weight' | 'volume' | 'manual'
    
    invoiceId: text('invoice_id'), // FK purchase_invoices (optional, if cost came from a separate invoice)
    
    notes: text('notes'),

    ...auditCols,
  },
  (t) => [
    index('landed_costs_grn_idx').on(t.grnId),
  ],
);
