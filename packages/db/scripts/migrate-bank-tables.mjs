import { readFileSync } from 'fs';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';

// Load .env from repo root
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const sql = neon(process.env.DATABASE_URL);

console.log('Connecting to Neon DB...');

const statements = [
  `CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" text PRIMARY KEY,
    "tenant_id" text NOT NULL DEFAULT 'default',
    "bank_name" text NOT NULL,
    "account_number" text NOT NULL,
    "account_holder" text NOT NULL,
    "account_id" text NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,
    "created_by" text,
    "updated_by" text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_tenant_number_idx" ON "bank_accounts" ("tenant_id", "account_number")`,
  `CREATE INDEX IF NOT EXISTS "bank_accounts_tenant_idx" ON "bank_accounts" ("tenant_id")`,

  `CREATE TABLE IF NOT EXISTS "bank_statements" (
    "id" text PRIMARY KEY,
    "tenant_id" text NOT NULL DEFAULT 'default',
    "location_id" text NOT NULL,
    "bank_account_id" text NOT NULL,
    "statement_date" date NOT NULL,
    "opening_balance" bigint NOT NULL DEFAULT 0,
    "closing_balance" bigint NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'draft',
    "notes" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,
    "created_by" text,
    "updated_by" text,
    "version" integer NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS "bank_statements_tenant_idx" ON "bank_statements" ("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "bank_statements_bank_account_idx" ON "bank_statements" ("bank_account_id")`,
  `CREATE INDEX IF NOT EXISTS "bank_statements_date_idx" ON "bank_statements" ("statement_date")`,
  `CREATE INDEX IF NOT EXISTS "bank_statements_status_idx" ON "bank_statements" ("status")`,
  `CREATE INDEX IF NOT EXISTS "bank_statements_location_idx" ON "bank_statements" ("location_id")`,

  `CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
    "id" text PRIMARY KEY,
    "statement_id" text NOT NULL,
    "line_no" integer NOT NULL,
    "transaction_date" date NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "debit" bigint NOT NULL DEFAULT 0,
    "credit" bigint NOT NULL DEFAULT 0,
    "running_balance" bigint NOT NULL DEFAULT 0,
    "match_status" text NOT NULL DEFAULT 'unmatched',
    "matched_journal_entry_id" text,
    "matched_at" timestamptz,
    "matched_by" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "deleted_at" timestamptz,
    "created_by" text,
    "updated_by" text
  )`,
  `CREATE INDEX IF NOT EXISTS "bsl_statement_idx" ON "bank_statement_lines" ("statement_id")`,
  `CREATE INDEX IF NOT EXISTS "bsl_match_status_idx" ON "bank_statement_lines" ("match_status")`,
  `CREATE INDEX IF NOT EXISTS "bsl_journal_idx" ON "bank_statement_lines" ("matched_journal_entry_id")`,
  `CREATE INDEX IF NOT EXISTS "bsl_date_idx" ON "bank_statement_lines" ("transaction_date")`,
];

try {
  for (const stmt of statements) {
    await sql(stmt);
    const name = stmt.match(/(?:TABLE|INDEX).*?"(\w+)"/)?.[1] || '?';
    console.log(`  ✅ ${name}`);
  }

  const result =
    await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'bank%' ORDER BY table_name`;
  console.log(
    '\n✅ Bank tables now in DB:',
    result.map((r) => r.table_name),
  );
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exit(1);
}
