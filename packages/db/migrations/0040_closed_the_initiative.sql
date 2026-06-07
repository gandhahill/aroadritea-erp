CREATE TABLE IF NOT EXISTS "sequences" (
	"name" text PRIMARY KEY NOT NULL,
	"current_val" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "absence_dispensations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"employee_id" text NOT NULL,
	"work_date" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_face_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"template_version" text DEFAULT 'ahash-16x16-v1' NOT NULL,
	"template_ciphertext" text NOT NULL,
	"template_quality" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "overtimes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"work_date" date NOT NULL,
	"hours" numeric(4, 1) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
DROP INDEX IF EXISTS "tax_rates_code_idx";--> statement-breakpoint
ALTER TABLE "helpdesk_ticket_replies" ALTER COLUMN "is_internal" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "helpdesk_ticket_replies" ALTER COLUMN "is_internal" SET DATA TYPE boolean USING is_internal::boolean;--> statement-breakpoint
ALTER TABLE "helpdesk_ticket_replies" ALTER COLUMN "is_internal" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD COLUMN "tenant_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_advances" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "shift_definitions" ADD COLUMN "overrides" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "product_categories" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD COLUMN "expiry_date" date;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "absence_dispensations_emp_date_idx" ON "absence_dispensations" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "absence_dispensations_tenant_idx" ON "absence_dispensations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employee_face_templates_tenant_employee_idx" ON "employee_face_templates" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_face_templates_tenant_status_idx" ON "employee_face_templates" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_face_templates_employee_idx" ON "employee_face_templates" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overtimes_employee_date_idx" ON "overtimes" USING btree ("employee_id","work_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overtimes_tenant_loc_date_idx" ON "overtimes" USING btree ("tenant_id","location_id","work_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overtimes_status_idx" ON "overtimes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_tenant_code_idx" ON "tax_rates" USING btree ("tenant_id","code");