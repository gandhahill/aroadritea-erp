-- User Req 2 (2026-05-24) — SOP documents uploaded by management,
-- readable by every employee through the existing auth-gated upload
-- download path.

CREATE TABLE IF NOT EXISTS "sop_documents" (
  "id"           text PRIMARY KEY,
  "tenant_id"    text NOT NULL DEFAULT 'default',
  "location_id"  text,
  "title"        text NOT NULL,
  "description"  text,
  "category"     text NOT NULL DEFAULT 'general',
  "file_key"     text NOT NULL,
  "file_name"    text NOT NULL,
  "mime_type"    text NOT NULL,
  "file_size"    bigint NOT NULL,
  "published_at" text,
  "status"       text NOT NULL DEFAULT 'draft',
  "version"      integer NOT NULL DEFAULT 1,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  "deleted_at"   timestamptz,
  "created_by"   text,
  "updated_by"   text
);

CREATE INDEX IF NOT EXISTS "sop_documents_tenant_idx"    ON "sop_documents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sop_documents_status_idx"    ON "sop_documents" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "sop_documents_category_idx"  ON "sop_documents" ("tenant_id", "category");
