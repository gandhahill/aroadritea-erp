-- SoT §25 / ERP common sense — only one open shift per location at a time.
-- Without this constraint two cashiers racing on `openShift` can both pass
-- the "no open shift" application check and both insert. The partial unique
-- index lets Postgres reject the second insert with a unique-violation,
-- which the service maps to `pos.shift.alreadyOpen`.

CREATE UNIQUE INDEX IF NOT EXISTS "shifts_open_per_location_unique"
  ON "shifts" ("tenant_id", "location_id")
  WHERE "status" = 'open';
