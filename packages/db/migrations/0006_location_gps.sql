-- Migration 0006 — location GPS for attendance check-in
--
-- Adds gps_lat / gps_lng / gps_radius_m to the locations table so admins
-- can configure the geofence used by HR presensi (apps/web/(dash)/hr/checkin).
-- Columns are nullable: a location without coordinates does not enforce a
-- distance check (legacy behaviour) — staff there can still clock in.

ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "gps_lat" text;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "gps_lng" text;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "gps_radius_m" integer;
