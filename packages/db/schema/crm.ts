/**
 * CRM Schema — SD §21.9, §9.7
 *
 * Tables:
 * - complaints                — member/customer complaints log
 * - complaint_compensations   — compensation awarded per complaint
 */

import { index, pgTable } from 'drizzle-orm/pg-core';
import { bigint, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol } from './common';

// ─── complaints ─────────────────────────────────────────────────────────────

/**
 * Customer/member complaint record.
 * SD §21.9 — complaint log with status tracking and resolution notes.
 */
export const complaints = pgTable(
  'complaints',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    // Who complained
    memberId: text('member_id'), // FK partners (optional — guest complaint)
    customerName: text('customer_name'), // for non-member guests
    customerPhone: text('customer_phone'),

    // Source of complaint
    orderId: text('order_id'), // FK sales_orders (optional — may be offline/walk-in)
    orderNumber: text('order_number'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),

    // Complaint content
    category: text('category').notNull(),
    // 'product_quality' | 'service' | 'cleanliness' | 'wrong_order' | 'staff' | 'other'
    description: text('description').notNull(),
    priority: text('priority').notNull().default('medium'),
    // 'low' | 'medium' | 'high' | 'urgent'

    // Resolution tracking
    status: text('status').notNull().default('open'),
    // 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated'
    assignedTo: text('assigned_to'), // FK users
    resolutionNotes: text('resolution_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...auditCols,
  },
  (t) => [
    index('complaints_member_idx').on(t.memberId),
    index('complaints_status_idx').on(t.status),
    index('complaints_location_idx').on(t.locationId),
    index('complaints_occurred_at_idx').on(t.occurredAt),
  ],
);

// ─── complaint_compensations ────────────────────────────────────────────────

/**
 * Compensation awarded to resolve a complaint.
 * SD §21.9 — product replacement, voucher, or cash refund with JE tracking.
 */
export const complaintCompensations = pgTable(
  'complaint_compensations',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    complaintId: text('complaint_id').notNull(), // FK complaints
    // What was compensated
    kind: text('kind').notNull(),
    // 'product_replacement' | 'voucher' | 'refund_cash' | 'discount'
    value: integer('value').notNull(), // e.g. 10 for 10% or 22000 for Rp 22,000
    description: text('description'),
    // Link to journal entry if cash/refund
    journalEntryId: text('journal_entry_id'), // FK journal_entries
    approvedBy: text('approved_by').notNull(), // FK users
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
    ...auditCols,
  },
  (t) => [
    index('complaint_compensations_complaint_idx').on(t.complaintId),
    index('complaint_compensations_kind_idx').on(t.kind),
  ],
);
