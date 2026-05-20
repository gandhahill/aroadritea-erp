ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "shipping_courier_code" text,
  ADD COLUMN IF NOT EXISTS "shipping_awb" text,
  ADD COLUMN IF NOT EXISTS "shipping_phone_last5" text,
  ADD COLUMN IF NOT EXISTS "shipping_tracking_status" text,
  ADD COLUMN IF NOT EXISTS "shipping_tracking_summary" jsonb,
  ADD COLUMN IF NOT EXISTS "shipping_tracking_history" jsonb,
  ADD COLUMN IF NOT EXISTS "shipping_tracking_synced_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "shipping_tracking_error" text;

ALTER TABLE "journal_lines"
  ADD COLUMN IF NOT EXISTS "due_date" date,
  ADD COLUMN IF NOT EXISTS "reminder_days_before" integer,
  ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "expected_loss_rate_bps" integer;

CREATE INDEX IF NOT EXISTS "jl_due_date_idx"
  ON "journal_lines" USING btree ("due_date");

CREATE TABLE IF NOT EXISTS "shipment_tracking_requests" (
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

CREATE INDEX IF NOT EXISTS "shipment_tracking_req_tenant_month_idx"
  ON "shipment_tracking_requests" USING btree ("tenant_id", "requested_at");

CREATE INDEX IF NOT EXISTS "shipment_tracking_req_po_idx"
  ON "shipment_tracking_requests" USING btree ("purchase_order_id");
