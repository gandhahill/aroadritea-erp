-- POS printer profiles + kiosk printing toggle (#16)
--
-- Adds the two printer-name slots (receipt + label) and the kiosk-printing
-- flag to the per-outlet pos_settings row so the cashier OS can route
-- thermal output to two distinct devices without showing the browser
-- print preview.

ALTER TABLE "pos_settings"
  ADD COLUMN IF NOT EXISTS "receipt_printer_name" text,
  ADD COLUMN IF NOT EXISTS "label_printer_name" text,
  ADD COLUMN IF NOT EXISTS "kiosk_printing_enabled" boolean NOT NULL DEFAULT false;
