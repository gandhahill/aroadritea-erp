CREATE TABLE IF NOT EXISTS "promotions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text DEFAULT 'default' NOT NULL,
  "code" text NOT NULL,
  "name" jsonb NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "location_scope_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "channel_scope_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "conditions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "benefits_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "stackable" boolean DEFAULT false NOT NULL,
  "requires_approval" boolean DEFAULT false NOT NULL,
  "usage_limit" integer,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "promotions_tenant_code_idx" ON "promotions" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotions_tenant_status_idx" ON "promotions" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotions_active_window_idx" ON "promotions" USING btree ("starts_at","ends_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promotion_applications" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text DEFAULT 'default' NOT NULL,
  "promotion_id" text NOT NULL,
  "sales_order_id" text NOT NULL,
  "line_id" text,
  "benefit_type" text NOT NULL,
  "discount_amount" text DEFAULT '0' NOT NULL,
  "free_product_id" text,
  "free_variant_id" text,
  "free_qty" integer DEFAULT 0 NOT NULL,
  "reason" text,
  "approved_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotion_applications_promo_idx" ON "promotion_applications" USING btree ("promotion_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotion_applications_sale_idx" ON "promotion_applications" USING btree ("sales_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "promotion_applications_tenant_idx" ON "promotion_applications" USING btree ("tenant_id");
