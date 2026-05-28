CREATE TABLE IF NOT EXISTS "invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"partner_name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"journal_id" text,
	"location_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "invoices_type_check" CHECK (type IN ('sales', 'purchase')),
	CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'posted', 'void', 'paid'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outgoing_shipment_tracking_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"shipment_id" text NOT NULL,
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
CREATE TABLE IF NOT EXISTS "outgoing_shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"subject" text NOT NULL,
	"notes" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text NOT NULL,
	"recipient_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"shipping_courier_code" text,
	"shipping_awb" text,
	"shipping_phone_last5" text,
	"shipping_tracking_status" text,
	"shipping_tracking_summary" jsonb,
	"shipping_tracking_history" jsonb,
	"shipping_tracking_synced_at" timestamp with time zone,
	"shipping_tracking_error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_account_idx" ON "invoice_lines" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_tenant_number_idx" ON "invoices" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_type_idx" ON "invoices" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_date_idx" ON "invoices" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_location_idx" ON "invoices" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_tracking_req_tenant_month_idx" ON "outgoing_shipment_tracking_requests" USING btree ("tenant_id","requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_tracking_req_shipment_idx" ON "outgoing_shipment_tracking_requests" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_shipments_tenant_loc_idx" ON "outgoing_shipments" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_shipments_status_idx" ON "outgoing_shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_shipments_number_idx" ON "outgoing_shipments" USING btree ("number");