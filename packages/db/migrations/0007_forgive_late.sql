-- Migration 0007 — supervisor can excuse late attendance
--
-- Adds late_forgiven flag + audit columns to attendance so an authorized
-- supervisor can waive the "isLate" status for an event (e.g. shift was
-- shifted at the last minute) without falsifying the original check-in
-- record. Payroll counts only late events where `late_forgiven = false`.

ALTER TABLE "attendance"
  ADD COLUMN IF NOT EXISTS "late_forgiven" boolean NOT NULL DEFAULT false;

ALTER TABLE "attendance"
  ADD COLUMN IF NOT EXISTS "late_forgiven_by" text;

ALTER TABLE "attendance"
  ADD COLUMN IF NOT EXISTS "late_forgiven_reason" text;

ALTER TABLE "attendance"
  ADD COLUMN IF NOT EXISTS "late_forgiven_at" timestamp with time zone;
