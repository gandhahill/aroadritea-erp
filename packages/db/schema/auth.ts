/**
 * IAM (Identity & Access Management) schema — SD §9.1
 *
 * Tables: tenants, locations, users, roles, permissions,
 *         role_permissions, user_roles, auth_accounts, sessions
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditCols, isActiveFlag, pk, tenantCol, versionCol } from './common';

// ================================================================
// TENANTS
// ================================================================

export const tenants = pgTable('tenants', {
  ...pk,
  name: text('name').notNull(),
  localeDefault: text('locale_default').notNull().default('id'),
  ...auditCols,
});

// ================================================================
// LOCATIONS (branches / offices) — SD §9.1, §12
// ================================================================

export const locations = pgTable(
  'locations',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(),
    name: jsonb('name').notNull(), // LocaleString { id, en, zh }
    type: text('type').notNull(), // 'store' | 'office' | 'warehouse'
    timezone: text('timezone').notNull().default('Asia/Jakarta'),
    currency: text('currency').notNull().default('IDR'),
    address: text('address'),
    status: text('status').notNull().default('active'), // 'active' | 'inactive'
    // GPS for attendance check-in (HR presensi). Used by Haversine check
    // in attendance-service.ts; if null, the location does not enforce a
    // geofence (admin must enter coordinates before staff can clock in).
    gpsLat: text('gps_lat'),
    gpsLng: text('gps_lng'),
    gpsRadiusM: integer('gps_radius_m'),

    // T-0259: Public site info
    openingHours: jsonb('opening_hours'), // e.g. { "monday": "09:00-22:00", ... }
    deliveryLink: text('delivery_link'), // e.g. GoFood / GrabFood link
    mapEmbedUrl: text('map_embed_url'),

    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('locations_tenant_code_idx').on(t.tenantId, t.code),
    index('locations_status_idx').on(t.status),
  ],
);

// ================================================================
// USERS — SD §9.1
// ================================================================

export const users = pgTable(
  'users',
  {
    ...pk,
    ...tenantCol,
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(), // argon2id
    displayName: text('display_name').notNull(),
    phone: text('phone'), // encrypted at-rest (UU PDP)
    locale: text('locale').notNull().default('id'), // 'id' | 'en' | 'zh'
    status: text('status').notNull().default('active'), // 'active' | 'suspended'
    emailVerified: timestamp('email_verified', { withTimezone: true }), // required by better-auth
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
    requirePasswordChange: boolean('require_password_change').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...auditCols,
    ...versionCol,
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    index('users_tenant_status_idx').on(t.tenantId, t.status),
  ],
);

// ================================================================
// ROLES — SD §9.1
// ================================================================

export const roles = pgTable(
  'roles',
  {
    ...pk,
    ...tenantCol,
    code: text('code').notNull(), // 'director', 'cashier', etc.
    name: jsonb('name').notNull(), // LocaleString
    description: jsonb('description'), // LocaleString (optional)
    ...auditCols,
    ...versionCol,
  },
  (t) => [uniqueIndex('roles_tenant_code_idx').on(t.tenantId, t.code)],
);

// ================================================================
// PERMISSIONS — SD §9.1
// Atomic permission entries. Seeded + added when new modules built.
// ================================================================

export const permissions = pgTable(
  'permissions',
  {
    ...pk,
    code: text('code').notNull(), // 'journal.create', 'pos.refund', etc.
    module: text('module').notNull(), // 'accounting', 'pos', etc.
    description: jsonb('description'), // LocaleString (optional)
    ...auditCols,
  },
  (t) => [
    uniqueIndex('permissions_code_idx').on(t.code),
    index('permissions_module_idx').on(t.module),
  ],
);

// ================================================================
// ROLE_PERMISSIONS — many-to-many — SD §9.1
// ================================================================

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id').notNull(),
    permissionId: text('permission_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index('role_permissions_role_idx').on(t.roleId),
  ],
);

// ================================================================
// USER_ROLES — many-to-many with optional location scope — SD §9.1
// ================================================================

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id').notNull(),
    roleId: text('role_id').notNull(),
    locationId: text('location_id'), // NULL = global; if set, role only applies at this location
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_user_idx').on(t.userId)],
);

// ================================================================
// AUTH ACCOUNTS — better-auth credential/OAuth accounts
// ================================================================

export const authAccounts = pgTable(
  'account',
  {
    ...pk,
    userId: text('user_id').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auth_accounts_user_idx').on(t.userId),
    uniqueIndex('auth_accounts_provider_account_idx').on(t.providerId, t.accountId),
  ],
);

// ================================================================
// TWO FACTOR — better-auth MFA secrets
// ================================================================

export const twoFactor = pgTable(
  'two_factor',
  {
    ...pk,
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => [index('two_factor_user_idx').on(t.userId)],
);

// ================================================================
// SESSIONS — DB-backed sessions (better-auth style) — SD §9.1
// ================================================================

export const sessions = pgTable(
  'sessions',
  {
    ...pk,
    userId: text('user_id').notNull(),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_idx').on(t.token),
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

// ─── MCP Tokens (T-0251) ─────────────────────────────────────────────────────

export const mcpTokens = pgTable(
  'mcp_tokens',
  {
    ...pk,
    ...tenantCol,

    userId: text('user_id').notNull(), // FK users
    name: text('name').notNull(), // E.g. 'Codex Token'
    tokenHash: text('token_hash').notNull(), // argon2 hash of the token

    scope: jsonb('scope').$type<string[]>().notNull().default([]), // specific permissions for this token

    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

    isRevoked: boolean('is_revoked').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [index('mcp_tokens_user_idx').on(t.userId), index('mcp_tokens_tenant_idx').on(t.tenantId)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    ...pk,
    emailHash: text('email_hash'),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    succeeded: boolean('succeeded').notNull().default(false),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('login_attempts_ip_time_idx').on(t.ipAddress, t.attemptedAt),
    index('login_attempts_email_time_idx').on(t.emailHash, t.attemptedAt),
    index('login_attempts_attempted_at_idx').on(t.attemptedAt),
  ],
);

// ================================================================
// API TOKENS — for MCP server auth — SD §11.3
// Token format: aroadri_<env>_<random32>
// Hash with SHA-256 before storing.
// ================================================================

export const apiTokens = pgTable(
  'api_tokens',
  {
    ...pk,
    userId: text('user_id').notNull(),
    name: text('name').notNull(), // human-readable label
    tokenHash: text('token_hash').notNull(), // SHA-256 hash of the token
    scopeJson: jsonb('scope_json'), // subset of user permissions; null = all user perms
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('api_tokens_user_idx').on(t.userId),
    uniqueIndex('api_tokens_hash_idx').on(t.tokenHash),
  ],
);

// ================================================================
// RELATIONS
// ================================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  locations: many(locations),
  users: many(users),
  roles: many(roles),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  tenant: one(tenants, { fields: [locations.tenantId], references: [tenants.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  userRoles: many(userRoles),
  accounts: many(authAccounts),
  sessions: many(sessions),
  apiTokens: many(apiTokens),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, { fields: [authAccounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, { fields: [apiTokens.userId], references: [users.id] }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(users, { fields: [twoFactor.userId], references: [users.id] }),
}));
