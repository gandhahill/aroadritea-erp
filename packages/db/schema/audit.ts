/**
 * Audit log schema — SD §15
 * Immutable append-only table. Records all data mutations.
 * Queryable by AI via MCP server (SoT §18.3, §18.5).
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { pk, tenantCol } from './common';

export const auditLog = pgTable(
  'audit_log',
  {
    ...pk,
    ...tenantCol,
    userId: text('user_id').notNull(),       // who
    action: text('action').notNull(),         // 'create' | 'update' | 'delete' | 'post' | 'reverse' | 'login'
    entityType: text('entity_type').notNull(),// 'journal_entry' | 'account' | 'user' | ...
    entityId: text('entity_id').notNull(),    // ULID of the affected record
    before: jsonb('before'),                 // snapshot before (null for create)
    after: jsonb('after'),                   // snapshot after (null for delete)
    metadata: jsonb('metadata'),             // extra context (ip, user_agent, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_user_idx').on(t.userId),
    index('audit_action_idx').on(t.action),
    index('audit_created_idx').on(t.createdAt),
    index('audit_tenant_idx').on(t.tenantId),
  ],
);
