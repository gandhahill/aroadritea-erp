/**
 * AI Assistant schema — User Req 1 (2026-05-24), ADR-0013.
 *
 * One row per chat session per user, one row per message in a session,
 * optional attachment rows for image uploads (receipt OCR).
 */

import { bigint, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol } from './common';

export const aiChatSessions = pgTable(
  'ai_chat_sessions',
  {
    ...pk,
    ...tenantCol,

    userId: text('user_id').notNull(),
    title: text('title').notNull().default('Percakapan baru'),
    /** 'active' | 'archived' */
    status: text('status').notNull().default('active'),
    /** Allow this session to use the web-search tool. Default off. */
    allowWebSearch: text('allow_web_search').notNull().default('false'),
    /** Snapshot of the model used most recently in the session. */
    modelKey: text('model_key'),

    ...auditCols,
  },
  (table) => [
    index('ai_chat_sessions_user_idx').on(table.userId),
    index('ai_chat_sessions_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    ...pk,
    sessionId: text('session_id').notNull(),
    tenantId: text('tenant_id').notNull().default('default'),
    userId: text('user_id').notNull(),

    /** 'user' | 'assistant' | 'system' | 'tool' */
    role: text('role').notNull(),
    /** Plain-text body. Tool messages also keep the JSON payload below. */
    content: text('content').notNull().default(''),
    /** For role='tool': name of the invoked tool (e.g. `search_codebase`). */
    toolName: text('tool_name'),
    /** Structured tool input/output blobs (jsonb so we can query later). */
    toolPayload: jsonb('tool_payload'),

    /** Token accounting for cost dashboards. */
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),

    /** True when the assistant proposed a mutation but the user has not
     *  yet confirmed; the mutation only commits after a follow-up
     *  message with `confirm_action`. */
    requiresConfirmation: text('requires_confirmation').notNull().default('false'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_chat_messages_session_idx').on(table.sessionId),
    index('ai_chat_messages_tenant_user_idx').on(table.tenantId, table.userId),
  ],
);

export const aiChatAttachments = pgTable(
  'ai_chat_attachments',
  {
    ...pk,
    messageId: text('message_id').notNull(),
    sessionId: text('session_id').notNull(),
    tenantId: text('tenant_id').notNull().default('default'),

    /** Storage key returned by `/api/uploads` (area = 'ai-attachments'). */
    fileKey: text('file_key').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_chat_attachments_message_idx').on(table.messageId),
    index('ai_chat_attachments_session_idx').on(table.sessionId),
  ],
);

/**
 * T-0172 — Phase 3 "draft → confirm → commit" pattern for AI mutations.
 *
 * When the assistant calls a *_draft tool, the tool inserts a row here
 * with the validated payload. The `<ConfirmActionCard>` UI shows the
 * draft and a button; clicking the button calls the server action
 * `confirmDraftAction(draftId)` which re-resolves the session, re-
 * checks the *target* permission (e.g. `pos.manualsales.create`), then
 * dispatches to the real service. The client only ever holds the
 * `draft_id` — never the payload — so a tampered client cannot alter
 * the action between proposal and commit.
 *
 * `kind` is the discriminator the commit dispatcher switches on.
 * `expires_at` defaults to created_at + 30 min via the application.
 * `status` transitions: 'pending' → 'committed' | 'cancelled' | 'expired'.
 */
export const aiActionDrafts = pgTable(
  'ai_action_drafts',
  {
    ...pk,
    sessionId: text('session_id').notNull(),
    messageId: text('message_id'), // assistant turn that proposed the draft
    tenantId: text('tenant_id').notNull().default('default'),
    userId: text('user_id').notNull(),
    locationId: text('location_id'),

    /** Discriminator: 'manual_sale' | 'complaint' | future kinds. */
    kind: text('kind').notNull(),
    /** Human-readable summary used by the UI card. */
    summary: text('summary').notNull(),
    /** Validated payload to pass to the underlying service at commit. */
    payload: jsonb('payload').notNull(),

    /** 'pending' | 'committed' | 'cancelled' | 'expired' */
    status: text('status').notNull().default('pending'),
    /** Result reference (e.g. inserted sale ID) populated on commit. */
    resultRef: text('result_ref'),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    consumedBy: text('consumed_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_action_drafts_user_idx').on(table.userId),
    index('ai_action_drafts_session_idx').on(table.sessionId),
    index('ai_action_drafts_kind_status_idx').on(table.kind, table.status),
  ],
);
