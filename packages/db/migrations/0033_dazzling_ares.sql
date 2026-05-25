CREATE TABLE IF NOT EXISTS "ai_action_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"message_id" text,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"location_id" text,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_ref" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"session_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tool_name" text,
	"tool_payload" jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"requires_confirmation" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_chat_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'Percakapan baru' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"allow_web_search" text DEFAULT 'false' NOT NULL,
	"model_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_ticket_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"is_internal" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "helpdesk_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"number" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"reporter_user_id" text NOT NULL,
	"assignee_user_id" text,
	"created_via" text DEFAULT 'manual' NOT NULL,
	"source_ai_session_id" text,
	"context_json" jsonb,
	"closed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"work_date" date NOT NULL,
	"shift_definition_id" text,
	"original_employee_id" text NOT NULL,
	"substitute_employee_id" text NOT NULL,
	"reason" text NOT NULL,
	"new_assignment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_return_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"return_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"grn_line_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_returned" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"unit_cost" bigint NOT NULL,
	"line_subtotal" bigint NOT NULL,
	"line_tax" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL,
	"tax_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_returns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"grn_id" text NOT NULL,
	"return_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"posted_by" text,
	"posted_at" timestamp with time zone,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"journal_entry_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sop_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"published_at" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "nik" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_sales_closings" ADD COLUMN "line_items_json" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_action_drafts_user_idx" ON "ai_action_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_action_drafts_session_idx" ON "ai_action_drafts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_action_drafts_kind_status_idx" ON "ai_action_drafts" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_attachments_message_idx" ON "ai_chat_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_attachments_session_idx" ON "ai_chat_attachments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_messages_session_idx" ON "ai_chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_messages_tenant_user_idx" ON "ai_chat_messages" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_user_idx" ON "ai_chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_chat_sessions_tenant_status_idx" ON "ai_chat_sessions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_ticket_replies_ticket_idx" ON "helpdesk_ticket_replies" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_ticket_replies_author_idx" ON "helpdesk_ticket_replies" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_tenant_idx" ON "helpdesk_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_status_idx" ON "helpdesk_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_reporter_idx" ON "helpdesk_tickets" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_assignee_idx" ON "helpdesk_tickets" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_number_idx" ON "helpdesk_tickets" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "helpdesk_tickets_created_via_idx" ON "helpdesk_tickets" USING btree ("created_via");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_overrides_date_idx" ON "schedule_overrides" USING btree ("work_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_overrides_tenant_date_idx" ON "schedule_overrides" USING btree ("tenant_id","work_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_overrides_orig_emp_idx" ON "schedule_overrides" USING btree ("original_employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_overrides_subst_emp_idx" ON "schedule_overrides" USING btree ("substitute_employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_return_lines_return_idx" ON "purchase_return_lines" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_return_lines_grn_line_idx" ON "purchase_return_lines" USING btree ("grn_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_return_lines_product_idx" ON "purchase_return_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_returns_tenant_loc_idx" ON "purchase_returns" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_returns_supplier_idx" ON "purchase_returns" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_returns_grn_idx" ON "purchase_returns" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_returns_status_idx" ON "purchase_returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_returns_number_idx" ON "purchase_returns" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sop_documents_tenant_idx" ON "sop_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sop_documents_status_idx" ON "sop_documents" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sop_documents_category_idx" ON "sop_documents" USING btree ("tenant_id","category");