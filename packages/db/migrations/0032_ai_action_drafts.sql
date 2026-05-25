-- T-0172 — Phase 3 of the AI assistant.
--
-- "draft → confirm → commit" persistence so the client cannot tamper
-- with the mutation between the assistant proposing it and the user
-- approving it. The client only ever carries the draft_id; the server
-- re-fetches the validated payload and re-checks the target permission
-- before executing.

CREATE TABLE IF NOT EXISTS "ai_action_drafts" (
  "id"           text PRIMARY KEY,
  "session_id"   text NOT NULL,
  "message_id"   text,
  "tenant_id"    text NOT NULL DEFAULT 'default',
  "user_id"      text NOT NULL,
  "location_id"  text,
  "kind"         text NOT NULL,
  "summary"      text NOT NULL,
  "payload"      jsonb NOT NULL,
  "status"       text NOT NULL DEFAULT 'pending',
  "result_ref"   text,
  "expires_at"   timestamptz NOT NULL,
  "consumed_at"  timestamptz,
  "consumed_by"  text,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_action_drafts_user_idx"        ON "ai_action_drafts" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_action_drafts_session_idx"     ON "ai_action_drafts" ("session_id");
CREATE INDEX IF NOT EXISTS "ai_action_drafts_kind_status_idx" ON "ai_action_drafts" ("kind", "status");
