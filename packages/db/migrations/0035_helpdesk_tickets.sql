-- T-0184 — Helpdesk / ticketing system.
--
-- Tickets can be filed manually by a user or auto-created by the AI
-- assistant when a user reports an error in chat. Handlers (anyone
-- with `helpdesk.handle` permission) get notified in-app + email on
-- new tickets.

CREATE TABLE IF NOT EXISTS "helpdesk_tickets" (
  "id"                     text PRIMARY KEY,
  "tenant_id"              text NOT NULL DEFAULT 'default',
  "number"                 text NOT NULL,
  "subject"                text NOT NULL,
  "body"                   text NOT NULL,
  "status"                 text NOT NULL DEFAULT 'open',
  "priority"               text NOT NULL DEFAULT 'normal',
  "category"               text NOT NULL DEFAULT 'other',
  "reporter_user_id"       text NOT NULL,
  "assignee_user_id"       text,
  "created_via"            text NOT NULL DEFAULT 'manual',
  "source_ai_session_id"   text,
  "context_json"           jsonb,
  "closed_at"              timestamptz,
  "resolved_at"            timestamptz,
  "first_response_at"      timestamptz,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now(),
  "deleted_at"             timestamptz,
  "created_by_user_id"     text,
  "updated_by_user_id"     text
);

CREATE INDEX IF NOT EXISTS "helpdesk_tickets_tenant_idx"      ON "helpdesk_tickets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_status_idx"      ON "helpdesk_tickets" ("status");
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_reporter_idx"    ON "helpdesk_tickets" ("reporter_user_id");
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_assignee_idx"    ON "helpdesk_tickets" ("assignee_user_id");
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_number_idx"      ON "helpdesk_tickets" ("number");
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_created_via_idx" ON "helpdesk_tickets" ("created_via");

CREATE TABLE IF NOT EXISTS "helpdesk_ticket_replies" (
  "id"                  text PRIMARY KEY,
  "ticket_id"           text NOT NULL,
  "author_user_id"      text NOT NULL,
  "body"                text NOT NULL,
  "is_internal"         text NOT NULL DEFAULT 'false',
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),
  "deleted_at"          timestamptz,
  "created_by_user_id"  text,
  "updated_by_user_id"  text
);

CREATE INDEX IF NOT EXISTS "helpdesk_ticket_replies_ticket_idx" ON "helpdesk_ticket_replies" ("ticket_id");
CREATE INDEX IF NOT EXISTS "helpdesk_ticket_replies_author_idx" ON "helpdesk_ticket_replies" ("author_user_id");
