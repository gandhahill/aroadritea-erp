-- User Req 1 (2026-05-24) + ADR-0013 — AI assistant tables.

CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
  "id"               text PRIMARY KEY,
  "tenant_id"        text NOT NULL DEFAULT 'default',
  "user_id"          text NOT NULL,
  "title"            text NOT NULL DEFAULT 'Percakapan baru',
  "status"           text NOT NULL DEFAULT 'active',
  "allow_web_search" text NOT NULL DEFAULT 'false',
  "model_key"        text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  "deleted_at"       timestamptz,
  "created_by"       text,
  "updated_by"       text
);

CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_idx"          ON "ai_chat_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_tenant_status_idx" ON "ai_chat_sessions" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
  "id"                      text PRIMARY KEY,
  "session_id"              text NOT NULL,
  "tenant_id"               text NOT NULL DEFAULT 'default',
  "user_id"                 text NOT NULL,
  "role"                    text NOT NULL,
  "content"                 text NOT NULL DEFAULT '',
  "tool_name"               text,
  "tool_payload"            jsonb,
  "prompt_tokens"           integer,
  "completion_tokens"       integer,
  "requires_confirmation"   text NOT NULL DEFAULT 'false',
  "created_at"              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_idx"     ON "ai_chat_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "ai_chat_messages_tenant_user_idx" ON "ai_chat_messages" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "ai_chat_attachments" (
  "id"          text PRIMARY KEY,
  "message_id"  text NOT NULL,
  "session_id"  text NOT NULL,
  "tenant_id"   text NOT NULL DEFAULT 'default',
  "file_key"    text NOT NULL,
  "file_name"   text NOT NULL,
  "mime_type"   text NOT NULL,
  "file_size"   bigint NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_chat_attachments_message_idx" ON "ai_chat_attachments" ("message_id");
CREATE INDEX IF NOT EXISTS "ai_chat_attachments_session_idx" ON "ai_chat_attachments" ("session_id");
