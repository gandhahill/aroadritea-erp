-- BOM line auto-deduct control
--
-- Some recipe quantities are production guides and cannot be deducted
-- safely from inventory when the stock-counting UOM differs (for example
-- syrup used in ml while inventory is counted in bottles). The default
-- remains true to preserve mandatory POS auto-deduct for trackable lines
-- such as cup, straw, and ingredients whose UOM matches stock_levels.

ALTER TABLE "bom_lines"
  ADD COLUMN IF NOT EXISTS "auto_deduct" boolean NOT NULL DEFAULT true;
