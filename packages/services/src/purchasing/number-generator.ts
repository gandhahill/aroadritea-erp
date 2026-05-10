/**
 * purchasing/number-generator.ts — PO number generator (SD §21.6)
 *
 * Format: PO-YYYY-MM-NNNN (per location per month).
 */

import { db } from '@erp/db';
import { purchaseOrders } from '@erp/db/schema/purchasing';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Generate the next PO number for a given tenant + location + month.
 *
 * @param tenantId - The tenant
 * @param locationId - The location
 * @param orderDate - YYYY-MM-DD string, used to derive YYYY-MM prefix
 * @returns e.g. "PO-2026-05-0001"
 */
export async function generatePONumber(
  tenantId: string,
  locationId: string,
  orderDate: string,
): Promise<string> {
  const prefix = `PO-${orderDate.substring(0, 7)}-`;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.locationId, locationId),
        sql`${purchaseOrders.number} LIKE ${prefix + '%'}`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');

  return `${prefix}${nextSeq}`;
}
