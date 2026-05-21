ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opname_frequency" text NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opname_frequencies" jsonb NOT NULL DEFAULT '["monthly"]'::jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_opname_frequency_idx" ON "products" USING btree ("opname_frequency");--> statement-breakpoint
UPDATE "products"
SET "opname_frequency" = CASE
  WHEN "kind" = 'raw_material' THEN 'weekly'
  WHEN "kind" IN ('finished_good', 'consumable', 'merchandise') THEN 'monthly'
  ELSE 'monthly'
END
WHERE "opname_frequency" = 'monthly';--> statement-breakpoint
UPDATE "products"
SET "opname_frequencies" = CASE
  WHEN "sku" LIKE 'FMT-%' OR "sku" LIKE 'FT-%' OR "sku" LIKE 'LFT-%' OR "sku" LIKE 'SCM-%' THEN '[]'::jsonb
  WHEN "sku" LIKE 'DST-%' THEN '["weekly","monthly"]'::jsonb
  WHEN "sku" IN ('TEA-BAMBOO-OOLONG','TEA-OSMANTHUS-OOLONG','TEA-GLUTINOUS-GREEN','LEMON-FRESH') THEN '["weekly","monthly"]'::jsonb
  WHEN "kind" = 'raw_material' THEN '["monthly"]'::jsonb
  WHEN "kind" = 'consumable' THEN '["daily","monthly"]'::jsonb
  WHEN "kind" IN ('finished_good','merchandise') THEN '["weekly","monthly"]'::jsonb
  ELSE '["monthly"]'::jsonb
END;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manual_sales_closings" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text DEFAULT 'default' NOT NULL,
  "location_id" text NOT NULL,
  "number" text NOT NULL,
  "sales_date" date NOT NULL,
  "channel" text DEFAULT 'walk_in' NOT NULL,
  "payment_method" text DEFAULT 'cash' NOT NULL,
  "transaction_count" integer DEFAULT 0 NOT NULL,
  "gross_sales" bigint DEFAULT 0 NOT NULL,
  "discount_total" bigint DEFAULT 0 NOT NULL,
  "tax_total" bigint DEFAULT 0 NOT NULL,
  "net_revenue" bigint DEFAULT 0 NOT NULL,
  "source_reference" text,
  "notes" text,
  "status" text DEFAULT 'posted' NOT NULL,
  "journal_entry_id" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manual_sales_closings_tenant_number_idx" ON "manual_sales_closings" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manual_sales_closings_source_idx" ON "manual_sales_closings" USING btree ("tenant_id","location_id","sales_date","channel","payment_method","source_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_sales_closings_location_date_idx" ON "manual_sales_closings" USING btree ("tenant_id","location_id","sales_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_sales_closings_journal_idx" ON "manual_sales_closings" USING btree ("journal_entry_id");--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/bamboo-oolong-milk-tea.jpg' WHERE "sku" = 'FMT-BOO';--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/glutinous-fragrant-milk-tea.jpg' WHERE "sku" = 'FMT-GLU';--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/osmanthus-oolong-milk-tea.jpg' WHERE "sku" = 'FMT-OSM';--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/fresh-tea.jpg' WHERE "sku" IN ('FT-BOO','FT-GLU','FT-OSM');--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/bamboo-oolong-lemon-tea.jpg' WHERE "sku" = 'LFT-BOO';--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/glutinous-fragrant-lemon-tea.jpg' WHERE "sku" = 'LFT-GLU';--> statement-breakpoint
UPDATE "products" SET "image_url" = '/photo/menu/osmanthus-oolong-lemon-tea.jpg' WHERE "sku" = 'LFT-OSM';
