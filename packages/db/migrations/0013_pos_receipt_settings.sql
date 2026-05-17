-- Receipt configuration on pos_settings
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_label_width_mm" integer NOT NULL DEFAULT 40;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_label_height_mm" integer NOT NULL DEFAULT 30;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_show_logo" boolean NOT NULL DEFAULT true;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_outlet_phone" text;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_outlet_address" text;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_instagram" text DEFAULT '@aroadri.tea';
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_tiktok" text DEFAULT '@aroadri.tea';
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_website" text DEFAULT 'aroadritea.com';
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "receipt_footer_text" text;
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "bank_account_code" text NOT NULL DEFAULT '1-1200';
ALTER TABLE "pos_settings" ADD COLUMN IF NOT EXISTS "bank_account_label" text;
