/**
 * Notification Schema — SD §35.1.6
 *
 * Tables:
 * - notification_channels — phone/email contacts per tenant
 * - outage_notifications  — log of outage alerts sent
 */

import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol } from './common';

// ─── notification_channels ─────────────────────────────────────────────────────

/**
 * Admin notification contacts per tenant.
 * Used by outage monitor and stock alerts.
 * SD §35.1.6
 */
export const notificationChannels = pgTable(
  'notification_channels',
  {
    ...pk,
    ...tenantCol,

    // Human label for this channel
    label: text('label').notNull(),

    // Channel type
    channelType: text('channel_type').notNull(), // 'whatsapp' | 'email' | 'telegram'

    // Delivery target
    //   whatsapp: phone number with country code (e.g. +6281234567890)
    //   email: RFC 5322 address
    //   telegram: chat ID or bot token
    target: text('target').notNull(),

    // Channel configuration (JSON, optional)
    //   whatsapp: { waBusinessId } — WA Business API config
    //   telegram: { botToken } — Telegram Bot API config
    config: jsonb('config'),

    // Is this channel active?
    isActive: boolean('is_active').notNull().default(true),

    // Who receives notifications from this channel
    purpose: text('purpose').notNull().default('all'), // 'outage' | 'stock_alert' | 'all'

    ...auditCols,
  },
  (t) => [index('nc_tenant_active_idx').on(t.tenantId, t.isActive, t.purpose)],
);

// ─── outage_notifications ─────────────────────────────────────────────────────

/**
 * Log of outage notifications sent.
 * Immutable append-only log.
 * SD §35.1.6
 */
export const outageNotifications = pgTable(
  'outage_notifications',
  {
    ...pk,
    ...tenantCol,

    // Which service/endpoint failed
    serviceName: text('service_name').notNull(), // 'web' | 'mcp' | 'worker'
    url: text('url').notNull(),

    // Incident window
    incidentStartedAt: timestamp('incident_started_at', { withTimezone: true }).notNull(),
    incidentResolvedAt: timestamp('incident_resolved_at', { withTimezone: true }),

    // Notification record
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    channelType: text('channel_type').notNull(), // 'whatsapp' | 'email'
    recipientTarget: text('recipient_target').notNull(),

    // Message content snapshot
    messageText: text('message_text').notNull(),
    deliveryStatus: text('delivery_status').notNull().default('sent'), // 'sent' | 'delivered' | 'failed'
    deliveryError: text('delivery_error'),

    ...auditCols,
  },
  (t) => [
    index('on_tenant_idx').on(t.tenantId, t.sentAt),
    index('on_service_idx').on(t.serviceName, t.sentAt),
  ],
);

// ─── user_notifications (in-app notification center) ───────────────────────────

/**
 * Per-user in-app notification feed. Surfaces in the bell icon and the
 * /notifications page. Permission-gated by whoever inserts the row
 * (e.g. createLeaveRequest notifies only users that hold
 * `hr.approve_leave`).
 */
export const userNotifications = pgTable(
  'user_notifications',
  {
    ...pk,
    ...tenantCol,
    userId: text('user_id').notNull(),
    /** Coarse category: 'leave', 'po', 'opname', 'attendance', 'shift', etc. */
    kind: text('kind').notNull(),
    /** Single-line label rendered in the bell list. */
    title: text('title').notNull(),
    body: text('body'),
    /** Optional deep link the bell row navigates to. */
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...auditCols,
  },
  (t) => [
    index('un_user_unread_idx').on(t.userId, t.readAt),
    index('un_tenant_created_idx').on(t.tenantId, t.createdAt),
  ],
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
  (t) => [index('unp_user_idx').on(t.userId)],
);
