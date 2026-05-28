ALTER TABLE "invoice_lines" ADD COLUMN "tax_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "partner_address" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "partner_npwp" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_terms" text;