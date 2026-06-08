ALTER TABLE "grn_lines" ADD COLUMN IF NOT EXISTS "qty_rejected" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD COLUMN IF NOT EXISTS "reject_reason" text;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD COLUMN IF NOT EXISTS "unit_price" bigint;
