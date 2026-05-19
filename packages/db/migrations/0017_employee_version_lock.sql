-- Employee optimistic locking
--
-- HR update forms already submit a version field. Add the matching database
-- column so concurrent edits cannot overwrite employee records silently.

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
