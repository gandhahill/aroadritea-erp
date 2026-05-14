/**
 * Stock low alert job.
 *
 * The stock alert workflow must not report success until the notification
 * channel and inventory threshold policy are fully configured.
 */

export interface StockAlertJobData {
  locationId?: string;
  thresholdMultiplier?: number;
}

export async function stockLowAlertHandler(data: StockAlertJobData): Promise<void> {
  const { locationId, thresholdMultiplier = 1.0 } = data;
  console.info('[stock-alert] Starting stock level check', { locationId, thresholdMultiplier });

  throw new Error(
    'Stock low alert job is not configured. Keep this scheduled job disabled until inventory thresholds and notification channels are finalized.',
  );
}
