CREATE TABLE IF NOT EXISTS IF NOT EXISTS "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"account_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "bank_statement_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"statement_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"running_balance" bigint,
	"match_status" text DEFAULT 'unmatched' NOT NULL,
	"matched_journal_entry_id" text,
	"matched_at" timestamp with time zone,
	"matched_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "bank_stmt_line_match_status_check" CHECK (match_status IN ('unmatched', 'matched', 'created'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "bank_statements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"bank_account_id" text NOT NULL,
	"statement_date" date NOT NULL,
	"opening_balance" bigint NOT NULL,
	"closing_balance" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reconciled_at" timestamp with time zone,
	"reconciled_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "bank_stmt_status_check" CHECK (status IN ('draft', 'in_progress', 'reconciled'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "fixed_asset_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"asset_account_id" text NOT NULL,
	"accumulated_depreciation_account_id" text NOT NULL,
	"depreciation_expense_account_id" text NOT NULL,
	"default_useful_life_months" integer NOT NULL,
	"default_depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "fixed_asset_cat_life_positive" CHECK (default_useful_life_months > 0),
	CONSTRAINT "fixed_asset_cat_method_check" CHECK (default_depreciation_method IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "fixed_asset_depreciation_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"accumulated_after" bigint NOT NULL,
	"book_value_after" bigint NOT NULL,
	"units_used" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "fixed_asset_dep_lines_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "fixed_asset_depreciation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"period_id" text NOT NULL,
	"posting_date" date NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"total_amount" bigint NOT NULL,
	"journal_entry_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "fixed_asset_dep_runs_amount_non_negative" CHECK (total_amount >= 0),
	CONSTRAINT "fixed_asset_dep_runs_status_check" CHECK (status IN ('posted', 'void'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "fixed_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"category_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"acquisition_date" date NOT NULL,
	"in_service_date" date NOT NULL,
	"acquisition_cost" bigint NOT NULL,
	"salvage_value" bigint DEFAULT 0 NOT NULL,
	"useful_life_months" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"depreciation_rate_bps" integer,
	"production_capacity" bigint,
	"accumulated_depreciation" bigint DEFAULT 0 NOT NULL,
	"last_depreciation_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"disposal_date" date,
	"disposal_amount" bigint,
	"disposal_journal_entry_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "fixed_asset_cost_positive" CHECK (acquisition_cost > 0),
	CONSTRAINT "fixed_asset_salvage_non_negative" CHECK (salvage_value >= 0),
	CONSTRAINT "fixed_asset_life_positive" CHECK (useful_life_months > 0),
	CONSTRAINT "fixed_asset_status_check" CHECK (status IN ('active', 'fully_depreciated', 'disposed')),
	CONSTRAINT "fixed_asset_method_check" CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "correspondence_records" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"direction" text NOT NULL,
	"document_no" text NOT NULL,
	"subject" text NOT NULL,
	"counterparty" text,
	"document_date" date NOT NULL,
	"received_at" timestamp with time zone,
	"due_date" date,
	"channel" text DEFAULT 'physical' NOT NULL,
	"classification" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_user_id" text,
	"summary" text,
	"storage_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "manual_sales_closings" (
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
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "shipment_tracking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"purchase_order_id" text NOT NULL,
	"courier_code" text NOT NULL,
	"awb" text NOT NULL,
	"phone_last5" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"http_status" integer,
	"response_json" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS IF NOT EXISTS "whistleblower_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "due_date" date;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "reminder_days_before" integer;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "expected_loss_rate_bps" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "require_password_change" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD COLUMN IF NOT EXISTS "auto_deduct" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opname_frequency" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "opname_frequencies" jsonb DEFAULT '["monthly"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "bank_account_code" text DEFAULT '1-1200' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "bank_account_label" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_label_width_mm" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_label_height_mm" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_show_logo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_outlet_phone" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_outlet_address" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_instagram" text DEFAULT '@aroadri.tea';--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_tiktok" text DEFAULT '@aroadri.tea';--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_website" text DEFAULT 'aroadritea.com';--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_footer_text" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_printer_name" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "label_printer_name" text;--> statement-breakpoint
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "kiosk_printing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_courier_code" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_awb" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_phone_last5" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_tracking_status" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_tracking_summary" jsonb;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_tracking_history" jsonb;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_tracking_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_tracking_error" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_acc_tenant_idx" ON "bank_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_acc_coa_idx" ON "bank_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_line_stmt_idx" ON "bank_statement_lines" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_line_match_idx" ON "bank_statement_lines" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_line_journal_idx" ON "bank_statement_lines" USING btree ("matched_journal_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_line_date_idx" ON "bank_statement_lines" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_tenant_idx" ON "bank_statements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_location_idx" ON "bank_statements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_account_idx" ON "bank_statements" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_date_idx" ON "bank_statements" USING btree ("statement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_stmt_status_idx" ON "bank_statements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_cat_tenant_code_idx" ON "fixed_asset_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_cat_tenant_active_idx" ON "fixed_asset_categories" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_dep_lines_run_asset_idx" ON "fixed_asset_depreciation_lines" USING btree ("run_id","asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_lines_asset_idx" ON "fixed_asset_depreciation_lines" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_tenant_period_idx" ON "fixed_asset_depreciation_runs" USING btree ("tenant_id","period_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_location_idx" ON "fixed_asset_depreciation_runs" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_journal_idx" ON "fixed_asset_depreciation_runs" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_tenant_code_idx" ON "fixed_assets" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_assets_tenant_location_idx" ON "fixed_assets" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_assets_category_idx" ON "fixed_assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixed_assets_status_idx" ON "fixed_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "correspondence_records_tenant_doc_no_idx" ON "correspondence_records" USING btree ("tenant_id","document_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_tenant_location_idx" ON "correspondence_records" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_status_idx" ON "correspondence_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_due_date_idx" ON "correspondence_records" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_owner_idx" ON "correspondence_records" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manual_sales_closings_tenant_number_idx" ON "manual_sales_closings" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "manual_sales_closings_source_idx" ON "manual_sales_closings" USING btree ("tenant_id","location_id","sales_date","channel","payment_method","source_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_sales_closings_location_date_idx" ON "manual_sales_closings" USING btree ("tenant_id","location_id","sales_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_sales_closings_journal_idx" ON "manual_sales_closings" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_tracking_req_tenant_month_idx" ON "shipment_tracking_requests" USING btree ("tenant_id","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipment_tracking_req_po_idx" ON "shipment_tracking_requests" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jl_due_date_idx" ON "journal_lines" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_opname_frequency_idx" ON "products" USING btree ("opname_frequency");
