-- Migration 0010 — recruitment pipeline (job openings + applicants)
--
-- Adds a minimal recruitment workflow per HR best practice:
--   job_openings: lowongan posted by management, with status open/closed.
--   job_applicants: pipeline applied → screening → interview → offer →
--                   hired / rejected / withdrawn. hired_employee_id links
--                   back to employees when an applicant is converted.

CREATE TABLE IF NOT EXISTS "job_openings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "location_id" text NOT NULL,
  "title" text NOT NULL,
  "department" text,
  "summary" text,
  "requirements" text,
  "benefits" text,
  "status" text NOT NULL DEFAULT 'draft',
  "headcount" integer NOT NULL DEFAULT 1,
  "open_date" date,
  "close_date" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

CREATE INDEX IF NOT EXISTS "job_openings_tenant_status_idx"
  ON "job_openings" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "job_applicants" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "opening_id" text NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "stage" text NOT NULL DEFAULT 'applied',
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resume_url" text,
  "notes" text,
  "hired_employee_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

CREATE INDEX IF NOT EXISTS "job_applicants_opening_idx"
  ON "job_applicants" ("opening_id");

CREATE INDEX IF NOT EXISTS "job_applicants_tenant_stage_idx"
  ON "job_applicants" ("tenant_id", "stage");
