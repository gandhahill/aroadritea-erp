CREATE TABLE IF NOT EXISTS "accounting_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"type" text NOT NULL,
	"subtype" text NOT NULL,
	"parent_id" text,
	"normal_balance" text NOT NULL,
	"is_postable" boolean DEFAULT true NOT NULL,
	"tax_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_entry_id" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"period_id" text NOT NULL,
	"posting_date" date NOT NULL,
	"number" text NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" text,
	"reversed_by_je_id" text,
	"total_debit" bigint NOT NULL,
	"total_credit" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "je_balanced" CHECK (total_debit = total_credit)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_entry_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" text NOT NULL,
	"location_id" text NOT NULL,
	"description" text,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"tax_code" text,
	"partner_id" text,
	CONSTRAINT "jl_debit_credit_exclusive" CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_localized" jsonb,
	"npwp" text,
	"email" text,
	"phone" text,
	"address" text,
	"birth_date" timestamp with time zone,
	"city" text,
	"is_pkp" boolean DEFAULT false NOT NULL,
	"is_member" boolean DEFAULT false NOT NULL,
	"loyalty_tier" text DEFAULT 'bronze',
	"payment_terms_days" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petty_cash_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"max_limit" bigint NOT NULL,
	"last_replenish_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "petty_cash_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "petty_cash_tx_kind_check" CHECK (kind IN ('topup', 'expense')),
	CONSTRAINT "petty_cash_tx_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reimbursement_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"requester_id" text NOT NULL,
	"location_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"attachment_url" text,
	"attachment_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"disbursed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "reimb_category_check" CHECK (category IN ('operational', 'supplies', 'emergency', 'other')),
	CONSTRAINT "reimb_status_check" CHECK (status IN ('draft', 'submitted', 'approved', 'disbursed', 'rejected')),
	CONSTRAINT "reimb_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"rate_bps" integer NOT NULL,
	"calculation" text NOT NULL,
	"posting_account_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text,
	"tax_code" text NOT NULL,
	"is_applied_default" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "tax_rules_scope_kind_check" CHECK (scope_kind IN ('channel', 'customer_segment', 'product_category', 'global_default'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"scope_json" jsonb,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"type" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"address" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"module" text NOT NULL,
	"description" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"locale_default" text DEFAULT 'id' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"location_id" text,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"locale" text DEFAULT 'id' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"email_verified" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_banners" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"title" jsonb NOT NULL,
	"subtitle" jsonb,
	"cta_label" jsonb,
	"cta_url" text,
	"image_url_desktop" text NOT NULL,
	"image_url_mobile" text,
	"active_from" timestamp with time zone,
	"active_until" timestamp with time zone,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_faqs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"question" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"title" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"meta_title" jsonb,
	"meta_description" jsonb,
	"og_image_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_in_navbar" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"excerpt" jsonb,
	"cover_image_url" text,
	"tags" text[],
	"author_user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"meta_title" jsonb,
	"meta_description" jsonb,
	"og_image_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cms_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaint_compensations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"complaint_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"description" text,
	"journal_entry_id" text,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"member_id" text,
	"customer_name" text,
	"customer_phone" text,
	"order_id" text,
	"order_number" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"resolution_notes" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"entity_type" text NOT NULL,
	"key" text NOT NULL,
	"name" jsonb DEFAULT '{"id":"","en":"","zh":""}'::jsonb NOT NULL,
	"data_type" text NOT NULL,
	"enum_options" jsonb,
	"ref_entity_type" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"validation_regex" text,
	"is_indexed" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_values" (
	"definition_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "custom_field_values_definition_id_entity_id_pk" PRIMARY KEY("definition_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"shift_definition_id" text,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_in_method" text NOT NULL,
	"check_in_gps" jsonb,
	"check_in_location_id" text,
	"check_out_at" timestamp with time zone,
	"check_out_gps" jsonb,
	"is_late" boolean DEFAULT false NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"worked_minutes" integer,
	"shift_definition_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disciplinary_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"level" text NOT NULL,
	"reason" text NOT NULL,
	"incident_date" timestamp with time zone NOT NULL,
	"attachment_url" text,
	"status" text DEFAULT 'issued' NOT NULL,
	"issued_by" text NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"nik" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"status" text DEFAULT 'probation' NOT NULL,
	"position" text NOT NULL,
	"department" text,
	"hire_date" timestamp with time zone NOT NULL,
	"probation_end_date" timestamp with time zone,
	"contract_type" text NOT NULL,
	"work_schedule" text DEFAULT 'fulltime' NOT NULL,
	"npwp" text,
	"bpjs_kesehatan" text,
	"bpjs_tenagakerja" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"current_contract_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employment_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"contract_type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"base_salary" bigint NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"year" integer NOT NULL,
	"total_days" numeric(5, 1) NOT NULL,
	"used_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"pending_days" numeric(5, 1) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"total_days" numeric(5, 1) NOT NULL,
	"reason" text,
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
CREATE TABLE IF NOT EXISTS "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"annual_quota_days" integer DEFAULT 0 NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payrolls_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"payroll_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"salary_component_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"base_amount" bigint,
	"percentage_applied" numeric(5, 4),
	"component_kind" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payrolls" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"period_code" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_employees" integer NOT NULL,
	"total_earnings" bigint NOT NULL,
	"total_deductions" bigint NOT NULL,
	"total_net" bigint NOT NULL,
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
CREATE TABLE IF NOT EXISTS "salary_components" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"kind" text NOT NULL,
	"fixed_amount" bigint,
	"percentage" numeric(5, 4),
	"is_taxable" boolean DEFAULT false NOT NULL,
	"is_bpjs_base" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_start" text,
	"break_end" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bom_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"bom_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"ingredient_id" text NOT NULL,
	"qty" numeric(14, 4) NOT NULL,
	"uom" text NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bom_substitutes" (
	"id" text PRIMARY KEY NOT NULL,
	"bom_line_id" text NOT NULL,
	"substitute_product_id" text NOT NULL,
	"conversion_ratio" numeric(8, 4) DEFAULT '1.0000' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boms" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"bom_version" integer DEFAULT 1 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"parent_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_modifier_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" jsonb NOT NULL,
	"selection_type" text DEFAULT 'single' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"max_selections" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_modifier_links" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"modifier_group_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_modifier_options" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"group_id" text NOT NULL,
	"name" jsonb NOT NULL,
	"extra_price" bigint DEFAULT 0 NOT NULL,
	"linked_product_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" jsonb NOT NULL,
	"sell_price" bigint DEFAULT 0 NOT NULL,
	"cost_price" bigint DEFAULT 0 NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"sku" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb,
	"category_id" text NOT NULL,
	"kind" text DEFAULT 'finished_good' NOT NULL,
	"uom" text DEFAULT 'pcs' NOT NULL,
	"is_sellable" boolean DEFAULT true NOT NULL,
	"is_purchasable" boolean DEFAULT false NOT NULL,
	"track_batch" boolean DEFAULT false NOT NULL,
	"track_expiry" boolean DEFAULT false NOT NULL,
	"shelf_life_days" integer,
	"default_sell_price" bigint DEFAULT 0 NOT NULL,
	"default_cost_price" bigint DEFAULT 0 NOT NULL,
	"cogs_account_id" text,
	"revenue_account_id" text,
	"inventory_account_id" text,
	"tax_code" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_adjustment_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"adjustment_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"batch_no" text,
	"qty_before" numeric(14, 3) NOT NULL,
	"qty_after" numeric(14, 3) NOT NULL,
	"qty_delta" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"unit_cost" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"adjustment_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
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
CREATE TABLE IF NOT EXISTS "stock_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"stock_location_id" text,
	"product_id" text NOT NULL,
	"variant_id" text,
	"batch_no" text,
	"expiry_date" date,
	"qty_on_hand" numeric(14, 3) DEFAULT '0' NOT NULL,
	"qty_reserved" numeric(14, 3) DEFAULT '0' NOT NULL,
	"qty_available" numeric(14, 3) DEFAULT '0' NOT NULL,
	"uom" text NOT NULL,
	"min_stock" numeric(14, 3),
	"max_stock" numeric(14, 3),
	"avg_unit_cost" bigint,
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"location_type" text DEFAULT 'storage' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stock_location_id" text,
	"product_id" text NOT NULL,
	"variant_id" text,
	"batch_no" text,
	"expiry_date" date,
	"qty_delta" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"unit_cost" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_transfer_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"transfer_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"batch_no" text,
	"qty_sent" numeric(14, 3) NOT NULL,
	"qty_received" numeric(14, 3),
	"uom" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"number" text NOT NULL,
	"transfer_date" date NOT NULL,
	"from_location_id" text NOT NULL,
	"to_location_id" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"shipped_at" timestamp with time zone,
	"shipped_by" text,
	"received_at" timestamp with time zone,
	"received_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kds_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"sales_order_line_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"pickup_number" integer NOT NULL,
	"product_summary" text NOT NULL,
	"qr_payload" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"making_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"served_at" timestamp with time zone,
	"prepared_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "naixer_modifier_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"modifier_kind" text NOT NULL,
	"modifier_option_id" text NOT NULL,
	"naixer_code" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "naixer_product_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"naixer_code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "naixer_qr_format_config" (
	"id" text PRIMARY KEY NOT NULL,
	"location_id" text NOT NULL,
	"format" text DEFAULT 'dash' NOT NULL,
	"include_order_id" boolean DEFAULT false NOT NULL,
	"parameter_order_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"member_id" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "member_credentials_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_loyalty" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"member_id" text NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"last_earned_at" timestamp with time zone,
	"tier_upgraded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "member_loyalty_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"purpose" text NOT NULL,
	"channel" text NOT NULL,
	"recipient" varchar(254) NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"token" varchar(64) NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"payload_json" text,
	CONSTRAINT "member_otp_codes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_points_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"member_id" text NOT NULL,
	"loyalty_id" text NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"description" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"member_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_signup_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(20),
	"ip_address" varchar(45),
	"user_agent" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"partner_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_vouchers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"member_id" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"min_order_value" integer DEFAULT 0 NOT NULL,
	"max_discount_value" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_in_order_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "member_vouchers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"label" text NOT NULL,
	"channel_type" text NOT NULL,
	"target" text NOT NULL,
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"purpose" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outage_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"service_name" text NOT NULL,
	"url" text NOT NULL,
	"incident_started_at" timestamp with time zone NOT NULL,
	"incident_resolved_at" timestamp with time zone,
	"sent_at" timestamp with time zone NOT NULL,
	"channel_type" text NOT NULL,
	"recipient_target" text NOT NULL,
	"message_text" text NOT NULL,
	"delivery_status" text DEFAULT 'sent' NOT NULL,
	"delivery_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"location_id" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"sales_order_id" text NOT NULL,
	"method" text NOT NULL,
	"amount" bigint NOT NULL,
	"reference" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"donation_amount" bigint,
	"rounding_option" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refund_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"refund_id" text NOT NULL,
	"sales_order_line_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"sales_order_id" text NOT NULL,
	"number" text NOT NULL,
	"reason" text NOT NULL,
	"refund_amount" bigint NOT NULL,
	"refund_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"journal_entry_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"sales_order_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty" numeric(14, 3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"line_subtotal" bigint NOT NULL,
	"line_discount" bigint DEFAULT 0 NOT NULL,
	"line_tax" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL,
	"modifier_json" jsonb,
	"kds_qr_token" text,
	"kds_qr_payload" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"shift_id" text NOT NULL,
	"cashier_id" text NOT NULL,
	"channel" text DEFAULT 'walk_in' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"customer_id" text,
	"idempotency_key" text NOT NULL,
	"journal_entry_id" text,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"opened_by" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opening_cash" bigint NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"expected_cash" bigint,
	"actual_cash" bigint,
	"variance" bigint,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_receipt_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"received_date" date NOT NULL,
	"received_by" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grn_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"grn_id" text NOT NULL,
	"po_line_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_received" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"batch_no" text,
	"expiry_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"line_subtotal" bigint NOT NULL,
	"line_tax" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL,
	"tax_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"number" text NOT NULL,
	"invoice_number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"purchase_order_id" text,
	"grn_id" text,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"subtotal" bigint NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"paid_amount" bigint DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"journal_entry_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_order_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"qty_ordered" numeric(14, 3) NOT NULL,
	"qty_received" numeric(14, 3) DEFAULT '0' NOT NULL,
	"uom" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"line_subtotal" bigint NOT NULL,
	"line_tax" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL,
	"tax_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"tax_total" bigint DEFAULT 0 NOT NULL,
	"grand_total" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"journal_entry_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" varchar(64) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"cron_expression" varchar(64) NOT NULL,
	"timezone" varchar(32) DEFAULT 'Asia/Jakarta' NOT NULL,
	"job_data" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(16),
	"last_run_error" text,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "scheduled_jobs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movement_manual" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"movement_date" date NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"batch_no" text,
	"qty_delta" numeric(14, 3) NOT NULL,
	"uom" text NOT NULL,
	"reason" text DEFAULT 'manual_import' NOT NULL,
	"reference" text,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_opname_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text,
	"uom" text NOT NULL,
	"system_qty" numeric(14, 3) NOT NULL,
	"counted_qty" numeric(14, 3),
	"is_counted" boolean DEFAULT false NOT NULL,
	"variance_qty" numeric(14, 3),
	"variance_value" bigint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_opname_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"location_id" text NOT NULL,
	"number" text NOT NULL,
	"session_date" date NOT NULL,
	"period_code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"prepared_by" text,
	"prepared_at" timestamp with time zone,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" jsonb DEFAULT '{"id":"","en":"","zh":""}'::jsonb NOT NULL,
	"description" text,
	"entity_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"condition_json" jsonb,
	"steps_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workflow_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"definition_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_summary" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"triggered_by" text NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
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
CREATE TABLE IF NOT EXISTS "workflow_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"instance_id" text NOT NULL,
	"step_order" integer NOT NULL,
	"approver_role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "periods_tenant_code_idx" ON "accounting_periods" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "periods_status_idx" ON "accounting_periods" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_tenant_code_idx" ON "accounts" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_parent_idx" ON "accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_attach_je_idx" ON "journal_attachments" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "journal_attach_uploaded_idx" ON "journal_attachments" USING btree ("uploaded_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "je_tenant_number_idx" ON "journal_entries" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "je_period_idx" ON "journal_entries" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "je_posting_date_idx" ON "journal_entries" USING btree ("posting_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "je_status_idx" ON "journal_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "je_location_idx" ON "journal_entries" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "je_reference_idx" ON "journal_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jl_journal_entry_idx" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jl_account_idx" ON "journal_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jl_partner_idx" ON "journal_lines" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partners_tenant_kind_idx" ON "partners" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partners_name_idx" ON "partners" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "petty_cash_acct_tenant_location_idx" ON "petty_cash_accounts" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "petty_cash_acct_tenant_idx" ON "petty_cash_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "petty_cash_tx_account_idx" ON "petty_cash_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "petty_cash_tx_kind_idx" ON "petty_cash_transactions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "petty_cash_tx_created_idx" ON "petty_cash_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimb_tenant_status_idx" ON "reimbursement_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimb_requester_idx" ON "reimbursement_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimb_location_idx" ON "reimbursement_requests" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reimb_created_idx" ON "reimbursement_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_code_idx" ON "tax_rates" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rules_scope_idx" ON "tax_rules" USING btree ("scope_kind","scope_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rules_tax_code_idx" ON "tax_rules" USING btree ("tax_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rules_tenant_idx" ON "tax_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_tenant_idx" ON "audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locations_tenant_code_idx" ON "locations" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_status_idx" ON "locations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_idx" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_module_idx" ON "permissions" USING btree ("module");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_code_idx" ON "roles" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_status_idx" ON "users" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_tenant_slug_uq" ON "cms_pages" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cms_posts_tenant_slug_uq" ON "cms_posts" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cms_settings_tenant_key_uq" ON "cms_settings" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaint_compensations_complaint_idx" ON "complaint_compensations" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaint_compensations_kind_idx" ON "complaint_compensations" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_member_idx" ON "complaints" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_location_idx" ON "complaints" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "complaints_occurred_at_idx" ON "complaints" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cfd_entity_type_idx" ON "custom_field_definitions" USING btree ("tenant_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cfd_key_unique_idx" ON "custom_field_definitions" USING btree ("tenant_id","entity_type","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cfv_entity_idx" ON "custom_field_values" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_employee_date_idx" ON "attendance" USING btree ("employee_id","check_in_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_tenant_date_idx" ON "attendance" USING btree ("tenant_id","check_in_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disciplinary_employee_idx" ON "disciplinary_actions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disciplinary_level_idx" ON "disciplinary_actions" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_tenant_nik_idx" ON "employees" USING btree ("tenant_id","nik");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_tenant_status_idx" ON "employees" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_tenant_location_idx" ON "employees" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employment_contracts_employee_idx" ON "employment_contracts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employment_contracts_active_idx" ON "employment_contracts" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_employee_type_year_idx" ON "leave_balances" USING btree ("employee_id","leave_type_id","year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_employee_idx" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_tenant_code_idx" ON "leave_types" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_lines_payroll_idx" ON "payrolls_lines" USING btree ("payroll_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_lines_employee_idx" ON "payrolls_lines" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payrolls_tenant_period_location_idx" ON "payrolls" USING btree ("tenant_id","period_code","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payrolls_status_idx" ON "payrolls" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salary_components_tenant_code_idx" ON "salary_components" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shift_definitions_tenant_code_idx" ON "shift_definitions" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_definitions_tenant_active_idx" ON "shift_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bom_lines_bom_idx" ON "bom_lines" USING btree ("bom_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bom_lines_ingredient_idx" ON "bom_lines" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bom_substitutes_bom_line_idx" ON "bom_substitutes" USING btree ("bom_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boms_product_idx" ON "boms" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boms_tenant_idx" ON "boms" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_tenant_code_idx" ON "product_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_categories_parent_idx" ON "product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_modifier_groups_tenant_idx" ON "product_modifier_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_modifier_links_unique_idx" ON "product_modifier_links" USING btree ("product_id","modifier_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_modifier_links_product_idx" ON "product_modifier_links" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_modifier_options_group_idx" ON "product_modifier_options" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_tenant_sku_idx" ON "product_variants" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_sku_idx" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_kind_idx" ON "products" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustment_lines_adj_idx" ON "stock_adjustment_lines" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustment_lines_product_idx" ON "stock_adjustment_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustments_tenant_loc_idx" ON "stock_adjustments" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustments_status_idx" ON "stock_adjustments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_levels_unique_idx" ON "stock_levels" USING btree ("tenant_id","location_id","product_id","variant_id","batch_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_product_idx" ON "stock_levels" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_low_stock_idx" ON "stock_levels" USING btree ("tenant_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_locations_tenant_loc_code_idx" ON "stock_locations" USING btree ("tenant_id","location_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_locations_location_idx" ON "stock_locations" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_location_idx" ON "stock_movements" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_occurred_idx" ON "stock_movements" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_loc_idx" ON "stock_movements" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfer_lines_transfer_idx" ON "stock_transfer_lines" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfer_lines_product_idx" ON "stock_transfer_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_tenant_idx" ON "stock_transfers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_from_idx" ON "stock_transfers" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_to_idx" ON "stock_transfers" USING btree ("to_location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transfers_status_idx" ON "stock_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kds_order_items_location_status_idx" ON "kds_order_items" USING btree ("location_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kds_order_items_order_idx" ON "kds_order_items" USING btree ("sales_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kds_order_items_line_idx" ON "kds_order_items" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kds_order_items_queued_at_idx" ON "kds_order_items" USING btree ("queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "naixer_modifier_codes_unique_idx" ON "naixer_modifier_codes" USING btree ("tenant_id","modifier_option_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "naixer_modifier_codes_kind_idx" ON "naixer_modifier_codes" USING btree ("modifier_kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "naixer_product_codes_unique_idx" ON "naixer_product_codes" USING btree ("tenant_id","product_id","variant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "naixer_product_codes_product_idx" ON "naixer_product_codes" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "naixer_qr_format_config_location_idx" ON "naixer_qr_format_config" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_credentials_member_uq" ON "member_credentials" USING btree ("tenant_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_loyalty_member_uq" ON "member_loyalty" USING btree ("tenant_id","member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_loyalty_tier_points_idx" ON "member_loyalty" USING btree ("tier","points");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_otp_codes_recipient_idx" ON "member_otp_codes" USING btree ("recipient");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_otp_codes_token_uq" ON "member_otp_codes" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_points_transactions_member_idx" ON "member_points_transactions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_points_transactions_loyalty_idx" ON "member_points_transactions" USING btree ("loyalty_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_sessions_member_idx" ON "member_sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_sessions_expires_idx" ON "member_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_signup_attempts_email_idx" ON "member_signup_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_signup_attempts_ip_idx" ON "member_signup_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_vouchers_member_idx" ON "member_vouchers" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_vouchers_code_uq" ON "member_vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nc_tenant_active_idx" ON "notification_channels" USING btree ("tenant_id","is_active","purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_tenant_idx" ON "outage_notifications" USING btree ("tenant_id","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_service_idx" ON "outage_notifications" USING btree ("service_name","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_key_loc_idx" ON "idempotency_records" USING btree ("idempotency_key","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_records_expires_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_method_idx" ON "payments" USING btree ("method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_lines_refund_idx" ON "refund_lines" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_order_idx" ON "refunds" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_tenant_loc_idx" ON "refunds" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_lines_order_idx" ON "sales_order_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_lines_product_idx" ON "sales_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_orders_idempotency_idx" ON "sales_orders" USING btree ("location_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_tenant_loc_idx" ON "sales_orders" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_shift_idx" ON "sales_orders" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_number_idx" ON "sales_orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_status_idx" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_placed_at_idx" ON "sales_orders" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_orders_channel_idx" ON "sales_orders" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shifts_location_idx" ON "shifts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shifts_opened_at_idx" ON "shifts" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_po_idx" ON "goods_receipt_notes" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_tenant_loc_idx" ON "goods_receipt_notes" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_lines_grn_idx" ON "grn_lines" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_lines_po_line_idx" ON "grn_lines" USING btree ("po_line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grn_lines_product_idx" ON "grn_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoice_lines_inv_idx" ON "purchase_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoice_lines_product_idx" ON "purchase_invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoices_supplier_idx" ON "purchase_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoices_po_idx" ON "purchase_invoices" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoices_status_idx" ON "purchase_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenant_idx" ON "purchase_invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_lines_po_idx" ON "purchase_order_lines" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_lines_product_idx" ON "purchase_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_loc_idx" ON "purchase_orders" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_orders_number_idx" ON "purchase_orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_name_idx" ON "scheduled_jobs" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_enabled_idx" ON "scheduled_jobs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_jobs_tenant_idx" ON "scheduled_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movement_manual_tenant_loc_idx" ON "stock_movement_manual" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movement_manual_date_idx" ON "stock_movement_manual" USING btree ("movement_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movement_manual_product_idx" ON "stock_movement_manual" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movement_manual_unprocessed_idx" ON "stock_movement_manual" USING btree ("processed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_lines_session_idx" ON "stock_opname_lines" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_lines_product_idx" ON "stock_opname_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_opname_lines_session_product_idx" ON "stock_opname_lines" USING btree ("session_id","product_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_opname_sessions_number_idx" ON "stock_opname_sessions" USING btree ("number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_sessions_tenant_loc_idx" ON "stock_opname_sessions" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_sessions_status_idx" ON "stock_opname_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_opname_sessions_date_idx" ON "stock_opname_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfd_entity_type_idx" ON "workflow_definitions" USING btree ("tenant_id","entity_type","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfi_entity_idx" ON "workflow_instances" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfi_status_idx" ON "workflow_instances" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfi_definition_idx" ON "workflow_instances" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfs_instance_idx" ON "workflow_steps" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wfs_status_idx" ON "workflow_steps" USING btree ("status");