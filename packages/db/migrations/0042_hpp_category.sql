ALTER TABLE "products" ADD COLUMN "hpp_category" text;
-- Set defaults: raw_material → hpp, consumable → supply_expense
UPDATE "products" SET "hpp_category" = 'hpp' WHERE "kind" = 'raw_material';
UPDATE "products" SET "hpp_category" = 'supply_expense' WHERE "kind" = 'consumable';
