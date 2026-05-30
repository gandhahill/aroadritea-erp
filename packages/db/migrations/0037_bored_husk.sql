CREATE TABLE IF NOT EXISTS "nsfp_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"start_nsfp" text NOT NULL,
	"end_nsfp" text NOT NULL,
	"last_used_nsfp" text,
	"issue_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"nsfp" text NOT NULL,
	"invoice_id" text NOT NULL,
	"issue_date" date NOT NULL,
	"tax_period" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_npwp" text,
	"dpp" bigint NOT NULL,
	"ppn" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "tax_invoices_status_check" CHECK (status IN ('draft', 'posted', 'cancelled', 'replaced'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "withholding_taxes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"bupot_number" text NOT NULL,
	"vendor_id" text NOT NULL,
	"tax_code" text NOT NULL,
	"income_type" text NOT NULL,
	"dpp" bigint NOT NULL,
	"tax_amount" bigint NOT NULL,
	"period" text NOT NULL,
	"issue_date" date NOT NULL,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_media_library" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" text,
	"alt_text" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_advances" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"journal_entry_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whistleblowers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"reported_by" text,
	"status" text DEFAULT 'new' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_batch_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"batch_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_consumed" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"unit_cost" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"production_date" date NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_produced" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_cost" bigint,
	"journal_entry_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uom_conversions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"product_id" text,
	"from_uom" text NOT NULL,
	"to_uom" text NOT NULL,
	"multiply_by" numeric(14, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outgoing_shipment_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"shipment_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"event_code" text,
	"reference_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"event_preferences" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "landed_costs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"grn_id" text NOT NULL,
	"cost_type" text NOT NULL,
	"amount" bigint NOT NULL,
	"allocation_method" text DEFAULT 'value' NOT NULL,
	"invoice_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_requisition_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"pr_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_requested" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"request_date" date NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfq_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"rfq_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rfqs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"pr_id" text,
	"rfq_date" date NOT NULL,
	"deadline_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_products" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"supplier_id" text NOT NULL,
	"product_id" text NOT NULL,
	"supplier_product_code" text,
	"supplier_product_name" text,
	"unit_price" bigint NOT NULL,
	"uom" text NOT NULL,
	"min_order_qty" numeric(14, 3) DEFAULT '1' NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"email" text,
	"reservation_date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"party_size" integer DEFAULT 1 NOT NULL,
	"type" text DEFAULT 'table' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"special_requests" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_status_check";--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "unit" text;--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "lifetime_spend" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "loyalty_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "rating" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "lead_time_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "delivery_link" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "map_embed_url" text;--> statement-breakpoint
ALTER TABLE "correspondence_records" ADD COLUMN "agenda_no" text;--> statement-breakpoint
ALTER TABLE "correspondence_records" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "correspondence_records" ADD COLUMN "dispositions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "sla_due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "is_sla_breached" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "escalation_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_face_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "face_match_score" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "marital_status" text DEFAULT 'TK' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "dependents_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "is_bpjs_base" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "is_taxable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "bank_account_holder" text;--> statement-breakpoint
ALTER TABLE "boms" ADD COLUMN "yield_qty" numeric(14, 3) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "boms" ADD COLUMN "yield_uom" text DEFAULT 'portion' NOT NULL;--> statement-breakpoint
ALTER TABLE "boms" ADD COLUMN "effective_from" date;--> statement-breakpoint
ALTER TABLE "boms" ADD COLUMN "effective_until" date;--> statement-breakpoint
ALTER TABLE "stock_levels" ADD COLUMN "allocated_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "parked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "park_note" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "naixer_payload" text;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "voucher_discount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "severity" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nsfp_blocks_tenant_active_idx" ON "nsfp_blocks" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_invoices_nsfp_idx" ON "tax_invoices" USING btree ("nsfp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_invoices_invoice_idx" ON "tax_invoices" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_invoices_tenant_period_idx" ON "tax_invoices" USING btree ("tenant_id","tax_period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "withholding_taxes_bupot_idx" ON "withholding_taxes" USING btree ("tenant_id","bupot_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withholding_taxes_vendor_idx" ON "withholding_taxes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "withholding_taxes_period_idx" ON "withholding_taxes" USING btree ("period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_tokens_user_idx" ON "mcp_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_tokens_tenant_idx" ON "mcp_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_advances_employee_idx" ON "cash_advances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_advances_status_idx" ON "cash_advances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whistleblowers_location_idx" ON "whistleblowers" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whistleblowers_status_idx" ON "whistleblowers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whistleblowers_severity_idx" ON "whistleblowers" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batch_lines_batch_idx" ON "production_batch_lines" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batch_lines_product_idx" ON "production_batch_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batches_tenant_loc_idx" ON "production_batches" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batches_product_idx" ON "production_batches" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "production_batches_status_idx" ON "production_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uom_conversions_tenant_idx" ON "uom_conversions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uom_conversions_product_idx" ON "uom_conversions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uom_conversions_unique_idx" ON "uom_conversions" USING btree ("tenant_id","product_id","from_uom","to_uom");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outgoing_shipment_lines_shipment_idx" ON "outgoing_shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unp_user_idx" ON "user_notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "landed_costs_grn_idx" ON "landed_costs" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_requisition_lines_pr_idx" ON "purchase_requisition_lines" USING btree ("pr_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_requisition_lines_product_idx" ON "purchase_requisition_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_requisitions_tenant_loc_idx" ON "purchase_requisitions" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_requisitions_status_idx" ON "purchase_requisitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_requisitions_number_idx" ON "purchase_requisitions" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfq_lines_rfq_idx" ON "rfq_lines" USING btree ("rfq_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_tenant_loc_idx" ON "rfqs" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfqs_status_idx" ON "rfqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_products_supplier_idx" ON "supplier_products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_products_product_idx" ON "supplier_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_products_supplier_product_idx" ON "supplier_products" USING btree ("supplier_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_tenant_date_idx" ON "reservations" USING btree ("tenant_id","reservation_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_location_date_idx" ON "reservations" USING btree ("location_id","reservation_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservation_customer_idx" ON "reservations" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_check" CHECK (status IN ('draft', 'posted', 'void', 'partial', 'paid'));
