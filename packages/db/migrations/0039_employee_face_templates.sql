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
CREATE UNIQUE INDEX IF NOT EXISTS "employee_face_templates_tenant_employee_idx" ON "employee_face_templates" USING btree ("tenant_id","employee_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_face_templates_tenant_status_idx" ON "employee_face_templates" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_face_templates_employee_idx" ON "employee_face_templates" USING btree ("employee_id");
