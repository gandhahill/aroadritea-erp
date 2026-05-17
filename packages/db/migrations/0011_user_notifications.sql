-- Migration 0011 — in-app per-user notification center
--
-- Feeds the bell icon in the dashboard header and the /notifications
-- page. Permission gating happens at insert site (e.g. leave-request
-- create only notifies users that hold hr.approve_leave).

CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "link" text,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

CREATE INDEX IF NOT EXISTS "un_user_unread_idx"
  ON "user_notifications" ("user_id", "read_at");

CREATE INDEX IF NOT EXISTS "un_tenant_created_idx"
  ON "user_notifications" ("tenant_id", "created_at");
