ALTER TABLE "pos_settings" ALTER COLUMN "cash_account_code" SET DEFAULT '1-1300';--> statement-breakpoint
ALTER TABLE "pos_settings" ALTER COLUMN "revenue_account_code" SET DEFAULT '4-1100';--> statement-breakpoint
UPDATE "pos_settings"
SET
  "cash_account_code" = CASE WHEN "cash_account_code" = '1-1030' THEN '1-1300' ELSE "cash_account_code" END,
  "revenue_account_code" = CASE WHEN "revenue_account_code" = '4-1010' THEN '4-1100' ELSE "revenue_account_code" END,
  "updated_at" = now()
WHERE "cash_account_code" = '1-1030' OR "revenue_account_code" = '4-1010';
