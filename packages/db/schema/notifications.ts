import { pgTable, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { pk, tenantCol, auditCols } from './common';

export const notifications = pgTable(
  'notifications',
  {
    ...pk,
    ...tenantCol,
    
    userId: text('user_id').notNull(), // FK users
    
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull(), // 'info' | 'warning' | 'alert' | 'success'
    
    eventCode: text('event_code'), // e.g., 'PO_APPROVED'
    referenceId: text('reference_id'), // e.g., PO ID
    
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    
    ...auditCols,
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_read_idx').on(t.isRead),
  ]
);

export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    ...pk,
    ...tenantCol,
    
    userId: text('user_id').notNull(), // FK users
    
    emailEnabled: boolean('email_enabled').notNull().default(true),
    pushEnabled: boolean('push_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    
    // e.g. { "PO_APPROVED": true, "LOW_STOCK": false }
    eventPreferences: jsonb('event_preferences').$type<Record<string, boolean>>().default({}),
    
    ...auditCols,
  },
  (t) => [
    index('unp_user_idx').on(t.userId),
  ]
);
