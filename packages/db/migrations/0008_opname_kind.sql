-- Migration 0008 — stock opname daily vs monthly cadence
--
-- Adds `kind` column to stock_opname_sessions to distinguish daily closing
-- counts (tangible fast-movers like cups, straws, milk) from full monthly
-- counts. Existing rows default to 'monthly' which matches current behaviour.

ALTER TABLE "stock_opname_sessions"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'monthly';
