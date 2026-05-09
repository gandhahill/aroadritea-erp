/**
 * Stock low alert job — scan inventory, emit alerts for items below threshold.
 * SD §21.5: weekly stock level check, notify if below reorder point.
 * Runs every Monday at 08:00 WIB.
 */

export interface StockAlertJobData {
  locationId?: string;
  thresholdMultiplier?: number;
}

export async function stockLowAlertHandler(data: StockAlertJobData): Promise<void> {
  const { locationId, thresholdMultiplier = 1.0 } = data;
  console.info(`[stock-alert] Starting stock level check`, { locationId, thresholdMultiplier });

  try {
    // TODO (Phase 2 — T-0053, T-0054): implement stock level check
    // 1. Query stock_levels joined with products where qty <= reorder_point * multiplier
    // 2. Group by location
    // 3. Send notification (Phase 6: T-0157 — email/WhatsApp webhook)
    // For now: just log the check
    console.info('[stock-alert] Stock check completed (placeholder — Phase 2)', { locationId });
  } catch (err) {
    console.error('[stock-alert] Stock check failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
