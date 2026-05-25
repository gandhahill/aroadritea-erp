-- T-0180 — Purchase returns.
--
-- Tracks goods returned to a supplier after GRN (broken / expired /
-- wrong delivery). On `post` we create a journal entry that mirrors
-- the original GRN posting (DR Accounts Payable / CR Inventory) and
-- decrement the stock via the standard movement path.

CREATE TABLE IF NOT EXISTS "purchase_returns" (
  "id"                  text PRIMARY KEY,
  "tenant_id"           text NOT NULL DEFAULT 'default',
  "location_id"         text NOT NULL,
  "number"              text NOT NULL,
  "supplier_id"         text NOT NULL,
  "grn_id"              text NOT NULL,
  "return_date"         date NOT NULL,
  "reason"              text NOT NULL,
  "status"              text NOT NULL DEFAULT 'draft',
  "subtotal"            bigint NOT NULL DEFAULT 0,
  "tax_total"           bigint NOT NULL DEFAULT 0,
  "grand_total"         bigint NOT NULL DEFAULT 0,
  "notes"               text,
  "submitted_by"        text,
  "submitted_at"        timestamptz,
  "approved_by"         text,
  "approved_at"         timestamptz,
  "posted_by"           text,
  "posted_at"           timestamptz,
  "cancelled_by"        text,
  "cancelled_at"        timestamptz,
  "journal_entry_id"    text,
  "version"             integer NOT NULL DEFAULT 1,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),
  "deleted_at"          timestamptz,
  "created_by_user_id"  text,
  "updated_by_user_id"  text
);

CREATE INDEX IF NOT EXISTS "purchase_returns_tenant_loc_idx" ON "purchase_returns" ("tenant_id", "location_id");
CREATE INDEX IF NOT EXISTS "purchase_returns_supplier_idx"   ON "purchase_returns" ("supplier_id");
CREATE INDEX IF NOT EXISTS "purchase_returns_grn_idx"        ON "purchase_returns" ("grn_id");
CREATE INDEX IF NOT EXISTS "purchase_returns_status_idx"     ON "purchase_returns" ("status");
CREATE INDEX IF NOT EXISTS "purchase_returns_number_idx"     ON "purchase_returns" ("number");

CREATE TABLE IF NOT EXISTS "purchase_return_lines" (
  "id"                  text PRIMARY KEY,
  "return_id"           text NOT NULL,
  "line_no"             integer NOT NULL,
  "grn_line_id"         text NOT NULL,
  "product_id"          text NOT NULL,
  "variant_id"          text,
  "qty_returned"        numeric(14, 3) NOT NULL,
  "uom"                 text NOT NULL,
  "unit_cost"           bigint NOT NULL,
  "line_subtotal"       bigint NOT NULL,
  "line_tax"            bigint NOT NULL DEFAULT 0,
  "line_total"          bigint NOT NULL,
  "tax_code"            text,
  "notes"               text,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now(),
  "deleted_at"          timestamptz,
  "created_by_user_id"  text,
  "updated_by_user_id"  text
);

CREATE INDEX IF NOT EXISTS "purchase_return_lines_return_idx"   ON "purchase_return_lines" ("return_id");
CREATE INDEX IF NOT EXISTS "purchase_return_lines_grn_line_idx" ON "purchase_return_lines" ("grn_line_id");
CREATE INDEX IF NOT EXISTS "purchase_return_lines_product_idx"  ON "purchase_return_lines" ("product_id");
