ALTER TABLE "manual_sales_closings" ADD COLUMN IF NOT EXISTS "shift_id" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "cash_shortage_account_code" text DEFAULT '6-2100' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "cash_overage_account_code" text DEFAULT '7-1200' NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN IF NOT EXISTS "attachment_url" text;