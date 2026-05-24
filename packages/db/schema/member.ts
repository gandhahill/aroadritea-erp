/**
 * Member Schema — SD §31.5
 *
 * Tables:
 * - member_signup_attempts — audit + rate-limit signup
 * - member_otp_codes       — OTP token for signup/login/reset
 * - member_sessions        — session DB-backed for member portal
 */

import { check, index, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { boolean, integer, jsonb, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { auditCols, pk } from './common';

// ─── member_signup_attempts ───────────────────────────────────────────────

/**
 * Audit trail for signup attempts + rate limit tracking.
 * SD §31.5.2
 */
export const memberSignupAttempts = pgTable(
  'member_signup_attempts',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    email: varchar('email', { length: 254 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    // outcome: 'otp_sent' | 'otp_verified' | 'failed_captcha' | 'rate_limited' | 'failed_otp' | 'email_exists' | 'phone_exists'
    outcome: text('outcome').notNull(),
    partnerId: text('partner_id'), // set if signup succeeded
  },
  (table) => ({
    emailIdx: index('member_signup_attempts_email_idx').on(table.email),
    ipIdx: index('member_signup_attempts_ip_idx').on(table.ipAddress),
  }),
);

// ─── member_otp_codes ────────────────────────────────────────────────────

/**
 * OTP tokens for member authentication (signup, login, password reset).
 * SD §31.5.2 — 6-digit numeric, expiry 10 min, max 5 attempts.
 */
export const memberOtpCodes = pgTable(
  'member_otp_codes',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    purpose: text('purpose').notNull(),
    channel: text('channel').notNull(),
    recipient: varchar('recipient', { length: 254 }).notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    token: varchar('token', { length: 64 }).notNull().unique(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
    // Encrypted JSON payload for signup data (used during completeSignup)
    payloadJson: text('payload_json'),
  },
  (table) => ({
    recipientIdx: index('member_otp_codes_recipient_idx').on(table.recipient),
    tokenIdx: uniqueIndex('member_otp_codes_token_uq').on(table.token),
  }),
);

// ─── member_sessions ─────────────────────────────────────────────────────

/**
 * DB-backed sessions for member portal.
 * Separate from ERP staff sessions — different cookie domain, different policy.
 * Cookie: __Host-member-session on aroadritea.com
 * SD §31.5.1
 */
export const memberSessions = pgTable(
  'member_sessions',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    memberId: text('member_id').notNull(), // FK to partners.kind='customer' where is_member=true
    tokenHash: text('token_hash').notNull().unique(), // hash of session token
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberIdx: index('member_sessions_member_idx').on(table.memberId),
    expiresIdx: index('member_sessions_expires_idx').on(table.expiresAt),
  }),
);

/**
 * Password credential for member portal login.
 * Stored separately from profile data in `partners`.
 */
export const memberCredentials = pgTable(
  'member_credentials',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    memberId: text('member_id').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    passwordUpdatedAt: timestamp('password_updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...auditCols,
  },
  (table) => ({
    memberIdx: uniqueIndex('member_credentials_member_uq').on(table.tenantId, table.memberId),
  }),
);

// ─── member_loyalty ──────────────────────────────────────────────────────

/**
 * Loyalty program data per member.
 * SD §21.9 — loyalty tiers, points, vouchers
 */
export const memberLoyalty = pgTable(
  'member_loyalty',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    memberId: text('member_id').notNull().unique(), // FK to partners
    tier: text('tier').notNull().default('bronze'), // 'bronze' | 'silver' | 'gold'
    points: integer('points').notNull().default(0),
    lifetimePoints: integer('lifetime_points').notNull().default(0),
    lastEarnedAt: timestamp('last_earned_at', { withTimezone: true }),
    tierUpgradedAt: timestamp('tier_upgraded_at', { withTimezone: true }),
    ...auditCols,
  },
  (table) => ({
    memberIdx: uniqueIndex('member_loyalty_member_uq').on(table.tenantId, table.memberId),
    tierPointsIdx: index('member_loyalty_tier_points_idx').on(table.tier, table.points),
    pointsCheck: check('member_loyalty_points_check', sql`${table.points} >= 0`),
  }),
);

// ─── member_vouchers ────────────────────────────────────────────────────

export const memberVouchers = pgTable(
  'member_vouchers',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    memberId: text('member_id').notNull(), // FK to partners
    code: varchar('code', { length: 32 }).notNull().unique(),
    kind: text('kind').notNull(), // 'discount_percent' | 'discount_fixed' | 'free_delivery' | 'free_item'
    value: integer('value').notNull(), // e.g. 10 for 10% or 10000 for Rp 10,000
    minOrderValue: integer('min_order_value').notNull().default(0),
    maxDiscountValue: integer('max_discount_value'), // cap for percent discounts
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedInOrderId: text('used_in_order_id'), // FK to sales_orders
    isActive: boolean('is_active').notNull().default(true),
    ...auditCols,
  },
  (table) => ({
    memberIdx: index('member_vouchers_member_idx').on(table.memberId),
    codeIdx: uniqueIndex('member_vouchers_code_uq').on(table.code),
  }),
);

// ─── member_points_transactions ─────────────────────────────────────────

export const memberPointsTransactions = pgTable(
  'member_points_transactions',
  {
    ...pk,
    tenantId: text('tenant_id').notNull().default('default'),
    memberId: text('member_id').notNull(), // FK to partners
    loyaltyId: text('loyalty_id').notNull(), // FK to member_loyalty
    // type: 'earn' | 'redeem' | 'expire' | 'adjust'
    type: text('type').notNull(),
    points: integer('points').notNull(), // positive for earn, negative for redeem/expire
    balanceAfter: integer('balance_after').notNull(),
    referenceType: text('reference_type'), // 'sales_order' | 'voucher_redeem' | 'manual_adjust'
    referenceId: text('reference_id'),
    description: jsonb('description'), // { id, en, zh }
    ...auditCols,
  },
  (table) => ({
    memberIdx: index('member_points_transactions_member_idx').on(table.memberId),
    loyaltyIdx: index('member_points_transactions_loyalty_idx').on(table.loyaltyId),
  }),
);
