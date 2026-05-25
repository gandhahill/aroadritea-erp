-- T-0182 — Schedule overrides.
--
-- Tracks per-date substitutions to the regular shift roster. Pure
-- audit/traceability — payroll keeps reading from `shift_assignments`
-- (the assignment row itself was already swapped to the substitute).

CREATE TABLE IF NOT EXISTS "schedule_overrides" (
  "id"                       text PRIMARY KEY,
  "tenant_id"                text NOT NULL DEFAULT 'default',
  "location_id"              text NOT NULL,
  "work_date"                date NOT NULL,
  "shift_definition_id"      text,
  "original_employee_id"     text NOT NULL,
  "substitute_employee_id"   text NOT NULL,
  "reason"                   text NOT NULL,
  "new_assignment_id"        text,
  "created_at"               timestamptz NOT NULL DEFAULT now(),
  "updated_at"               timestamptz NOT NULL DEFAULT now(),
  "deleted_at"               timestamptz,
  "created_by_user_id"       text,
  "updated_by_user_id"       text
);

CREATE INDEX IF NOT EXISTS "schedule_overrides_date_idx"          ON "schedule_overrides" ("work_date");
CREATE INDEX IF NOT EXISTS "schedule_overrides_tenant_date_idx"   ON "schedule_overrides" ("tenant_id", "work_date");
CREATE INDEX IF NOT EXISTS "schedule_overrides_orig_emp_idx"      ON "schedule_overrides" ("original_employee_id");
CREATE INDEX IF NOT EXISTS "schedule_overrides_subst_emp_idx"     ON "schedule_overrides" ("substitute_employee_id");
