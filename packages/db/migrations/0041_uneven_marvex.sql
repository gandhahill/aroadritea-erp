ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "vehicle_plate_number" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hpp_category" text;--> statement-breakpoint
-- Set defaults: raw_material → hpp, consumable → supply_expense (only where unset)
UPDATE "products" SET "hpp_category" = 'hpp' WHERE "kind" = 'raw_material' AND "hpp_category" IS NULL;--> statement-breakpoint
UPDATE "products" SET "hpp_category" = 'supply_expense' WHERE "kind" = 'consumable' AND "hpp_category" IS NULL;
