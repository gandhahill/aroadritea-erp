CREATE TABLE IF NOT EXISTS "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"email_hash" text,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"succeeded" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"pb1_tax_code" text DEFAULT 'PB1' NOT NULL,
	"cash_account_code" text DEFAULT '1-1030' NOT NULL,
	"revenue_account_code" text DEFAULT '4-1010' NOT NULL,
	"donation_trust_account_code" text DEFAULT '2-2050' NOT NULL,
	"delivery_channels_json" jsonb DEFAULT '["gofood","grabfood","shopeefood"]'::jsonb NOT NULL,
	"delivery_net_bps" integer DEFAULT 8000 NOT NULL,
	"receipt_width_mm" integer DEFAULT 80 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "naixer_qr_format_config" ADD COLUMN "label_width_mm" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "naixer_qr_format_config" ADD COLUMN "label_height_mm" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_ip_time_idx" ON "login_attempts" USING btree ("ip_address","attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_email_time_idx" ON "login_attempts" USING btree ("email_hash","attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_attempted_at_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pos_settings_tenant_location_idx" ON "pos_settings" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pos_settings_location_idx" ON "pos_settings" USING btree ("location_id");