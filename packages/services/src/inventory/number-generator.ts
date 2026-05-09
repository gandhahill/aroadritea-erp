/**
 * Stock Adjustment / Transfer number generator.
 *
 * Formats:
 *   ADJ-YYYY-MM-NNNN  (e.g., ADJ-2026-05-0001)
 *   TRF-YYYY-MM-NNNN  (e.g., TRF-2026-05-0001)
 *
 * Uses COUNT + 1 per tenant per prefix.
 */

import { db } from '@erp/db';
import { stockAdjustments, stockTransfers } from '@erp/db/schema/inventory';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Generate the next stock adjustment number.
 */
export async function generateAdjustmentNumber(
  tenantId: string,
  date: string,
): Promise<string> {
  const prefix = `ADJ-${date.substring(0, 7)}-`;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockAdjustments)
    .where(
      and(
        eq(stockAdjustments.tenantId, tenantId),
        sql`${stockAdjustments.number} LIKE ${prefix + '%'}`,
      ),
    );
  const currentCount = Number(result[0]?.count ?? 0);
  return `${prefix}${(currentCount + 1).toString().padStart(4, '0')}`;
}

/**
 * Generate the next stock transfer number.
 */
export async function generateTransferNumber(
  tenantId: string,
  date: string,
): Promise<string> {
  const prefix = `TRF-${date.substring(0, 7)}-`;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockTransfers)
    .where(
      and(
        eq(stockTransfers.tenantId, tenantId),
        sql`${stockTransfers.number} LIKE ${prefix + '%'}`,
      ),
    );
  const currentCount = Number(result[0]?.count ?? 0);
  return `${prefix}${(currentCount + 1).toString().padStart(4, '0')}`;
}
