CREATE TABLE IF NOT EXISTS "fixed_asset_categories" (
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
  CONSTRAINT "fixed_asset_cat_life_positive" CHECK ("fixed_asset_categories"."default_useful_life_months" > 0),
  CONSTRAINT "fixed_asset_cat_method_check" CHECK ("fixed_asset_categories"."default_depreciation_method" IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production'))
);

CREATE TABLE IF NOT EXISTS "fixed_assets" (
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
  CONSTRAINT "fixed_asset_cost_positive" CHECK ("fixed_assets"."acquisition_cost" > 0),
  CONSTRAINT "fixed_asset_salvage_non_negative" CHECK ("fixed_assets"."salvage_value" >= 0),
  CONSTRAINT "fixed_asset_life_positive" CHECK ("fixed_assets"."useful_life_months" > 0),
  CONSTRAINT "fixed_asset_status_check" CHECK ("fixed_assets"."status" IN ('active', 'fully_depreciated', 'disposed')),
  CONSTRAINT "fixed_asset_method_check" CHECK ("fixed_assets"."depreciation_method" IN ('straight_line', 'declining_balance', 'double_declining_balance', 'sum_of_years_digits', 'units_of_production'))
);

CREATE TABLE IF NOT EXISTS "fixed_asset_depreciation_runs" (
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
  CONSTRAINT "fixed_asset_dep_runs_amount_non_negative" CHECK ("fixed_asset_depreciation_runs"."total_amount" >= 0),
  CONSTRAINT "fixed_asset_dep_runs_status_check" CHECK ("fixed_asset_depreciation_runs"."status" IN ('posted', 'void'))
);

CREATE TABLE IF NOT EXISTS "fixed_asset_depreciation_lines" (
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
  CONSTRAINT "fixed_asset_dep_lines_amount_positive" CHECK ("fixed_asset_depreciation_lines"."amount" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_cat_tenant_code_idx" ON "fixed_asset_categories" USING btree ("tenant_id","code");
CREATE INDEX IF NOT EXISTS "fixed_asset_cat_tenant_active_idx" ON "fixed_asset_categories" USING btree ("tenant_id","is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_assets_tenant_code_idx" ON "fixed_assets" USING btree ("tenant_id","code");
CREATE INDEX IF NOT EXISTS "fixed_assets_tenant_location_idx" ON "fixed_assets" USING btree ("tenant_id","location_id");
CREATE INDEX IF NOT EXISTS "fixed_assets_category_idx" ON "fixed_assets" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "fixed_assets_status_idx" ON "fixed_assets" USING btree ("status");
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_tenant_period_idx" ON "fixed_asset_depreciation_runs" USING btree ("tenant_id","period_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_location_idx" ON "fixed_asset_depreciation_runs" USING btree ("location_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_runs_journal_idx" ON "fixed_asset_depreciation_runs" USING btree ("journal_entry_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fixed_asset_dep_lines_run_asset_idx" ON "fixed_asset_depreciation_lines" USING btree ("run_id","asset_id");
CREATE INDEX IF NOT EXISTS "fixed_asset_dep_lines_asset_idx" ON "fixed_asset_depreciation_lines" USING btree ("asset_id");
