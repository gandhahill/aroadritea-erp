ALTER TABLE "complaint_compensations" ADD CONSTRAINT "complaint_compensations_value_check" CHECK ("complaint_compensations"."value" >= 0);--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_qty_check" CHECK ("stock_levels"."qty_on_hand" >= 0);--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_available_check" CHECK ("stock_levels"."qty_available" >= 0);--> statement-breakpoint
ALTER TABLE "member_loyalty" ADD CONSTRAINT "member_loyalty_points_check" CHECK ("member_loyalty"."points" >= 0);