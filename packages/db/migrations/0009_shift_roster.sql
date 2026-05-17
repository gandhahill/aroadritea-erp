-- Migration 0009 — weekly shift roster (jadwal)
--
-- Replaces the WhatsApp "UPDATE JADWAL" announcement that managers send
-- every week. One row per (employee, date, shift). kind='off' rows
-- record planned days off without a shift assignment.

CREATE TABLE IF NOT EXISTS "shift_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "location_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "work_date" date NOT NULL,
  "kind" text NOT NULL DEFAULT 'shift',
  "shift_definition_id" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);

CREATE INDEX IF NOT EXISTS "shift_assignments_employee_date_idx"
  ON "shift_assignments" ("employee_id", "work_date");

CREATE INDEX IF NOT EXISTS "shift_assignments_tenant_loc_date_idx"
  ON "shift_assignments" ("tenant_id", "location_id", "work_date");

CREATE UNIQUE INDEX IF NOT EXISTS "shift_assignments_unique_per_employee_date_shift_idx"
  ON "shift_assignments" ("employee_id", "work_date", "shift_definition_id");
