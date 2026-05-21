CREATE TABLE IF NOT EXISTS "correspondence_records" (
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
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "correspondence_records_tenant_doc_no_idx" ON "correspondence_records" USING btree ("tenant_id","document_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_tenant_location_idx" ON "correspondence_records" USING btree ("tenant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_status_idx" ON "correspondence_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_due_date_idx" ON "correspondence_records" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correspondence_records_owner_idx" ON "correspondence_records" USING btree ("owner_user_id");
