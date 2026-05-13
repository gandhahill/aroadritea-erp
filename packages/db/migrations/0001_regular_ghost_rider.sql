CREATE TABLE IF NOT EXISTS "daily_revenue_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"date" text NOT NULL,
	"adjustment_amount" bigint DEFAULT 0 NOT NULL,
	"adjustment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
