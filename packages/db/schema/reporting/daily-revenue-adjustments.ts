/**
 * Daily Revenue Adjustments Schema — SD §25.5b, SoT §21.3b
 *
 * Stores per-location-per-date manual fiscal adjustments
 * for PB1-exclusive omzet export (Coretax / SPT PPh Final).
 */

import { sql } from 'drizzle-orm';
import { bigint, pgTable, text } from 'drizzle-orm/pg-core';
import { auditCols, pk, tenantCol } from '../common';

/**
 * Manual fiscal adjustments for daily omzet report.
 * UNIQUE(location_id, date) — one adjustment row per location per day.
 * `adjustment_amount` in sen (BigInt) — negative allowed.
 * SD §25.5b.1
 */
export const dailyRevenueAdjustments = pgTable('daily_revenue_adjustments', {
  ...pk,
  ...tenantCol,

  // Which location and date this adjustment belongs to
  locationId: text('location_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD, WIB date

  // The adjustment amount in sen (IDR cents)
  // Negative = pengurang (retur, koreksi kurang), positive = penambah
  adjustmentAmount: bigint('adjustment_amount', { mode: 'bigint' }).notNull().default(sql`0`),

  // Optional note explaining the adjustment
  adjustmentNote: text('adjustment_note'),

  ...auditCols,
});
