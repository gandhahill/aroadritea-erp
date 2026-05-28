/**
 * Logistics schema — handling outgoing shipments and related tracking.
 */

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol, versionCol } from './common';

export const outgoingShipments = pgTable(
  'outgoing_shipments',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,

    number: text('number').notNull(), // OSH-2026-05-0001
    
    // Details of what is being shipped
    subject: text('subject').notNull(), 
    notes: text('notes'),

    // Recipient Info
    recipientName: text('recipient_name').notNull(),
    recipientAddress: text('recipient_address').notNull(),
    recipientPhone: text('recipient_phone'),

    status: text('status').notNull().default('draft'),
    // 'draft' | 'shipped' | 'delivered' | 'cancelled' | 'error'

    // BinderByte Shipment tracking
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
    index('outgoing_shipments_tenant_loc_idx').on(t.tenantId, t.locationId),
    index('outgoing_shipments_status_idx').on(t.status),
    index('outgoing_shipments_number_idx').on(t.number),
  ],
);

export const outgoingShipmentTrackingRequests = pgTable(
  'outgoing_shipment_tracking_requests',
  {
    ...pk,
    ...tenantCol,
    
    shipmentId: text('shipment_id').notNull(),
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
    index('outgoing_tracking_req_tenant_month_idx').on(t.tenantId, t.requestedAt),
    index('outgoing_tracking_req_shipment_idx').on(t.shipmentId),
  ],
);
