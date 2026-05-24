ALTER TABLE "shift_expenses" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending_accounting' NOT NULL;--> statement-breakpoint
ALTER TABLE "shift_expenses" ADD COLUMN IF NOT EXISTS "account_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_expenses_status_idx" ON "shift_expenses" USING btree ("status");--> statement-breakpoint
ALTER TABLE "pos_settings" DROP COLUMN IF EXISTS "drawer_expense_account_code";