ALTER TABLE "manual_sales_closings" ADD COLUMN "shift_id" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN "cash_shortage_account_code" text DEFAULT '6-2100' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN "cash_overage_account_code" text DEFAULT '7-1200' NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "attachment_url" text;