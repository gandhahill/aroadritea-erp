import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { auditCols, locationCol, pk, tenantCol } from './common';


export const reservations = pgTable(
  'reservations',
  {
    ...pk,
    ...tenantCol,
    ...locationCol,
    customerId: text('customer_id'),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    email: text('email'),
    reservationDate: text('reservation_date').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull(), // HH:MM
    endTime: text('end_time'), // HH:MM
    partySize: integer('party_size').notNull().default(1),
    type: text('type').notNull().default('table'), // 'table' | 'event'
    status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'cancelled' | 'completed'
    specialRequests: text('special_requests'),
    ...auditCols,
  },
  (table) => [
    index('reservation_tenant_date_idx').on(table.tenantId, table.reservationDate),
    index('reservation_location_date_idx').on(table.locationId, table.reservationDate),
    index('reservation_customer_idx').on(table.customerId),
  ],
);
