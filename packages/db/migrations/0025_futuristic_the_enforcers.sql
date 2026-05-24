CREATE TABLE IF NOT EXISTS "shift_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"shift_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"journal_entry_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "drawer_expense_account_code" text DEFAULT '6-2100' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_expenses_tenant_loc_idx" ON "shift_expenses" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_expenses_shift_idx" ON "shift_expenses" USING btree ("shift_id");