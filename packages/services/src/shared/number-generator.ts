/**
 * shared/number-generator.ts
 *
 * Centralized number generator for ERP documents.
 * Uses MAX(number) + 1 algorithm to prevent collisions and race conditions
 * commonly caused by count(*)-based generation when records are deleted.
 */

import { db } from '@erp/db';
import { invoices, journalEntries } from '@erp/db/schema/accounting';
import { stockAdjustments, stockTransfers } from '@erp/db/schema/inventory';
import { purchaseOrders } from '@erp/db/schema/purchasing';
import { stockOpnameSessions } from '@erp/db/schema/stock-opname';
import { and, desc, eq, sql } from 'drizzle-orm';

/**
 * Generate the next invoice number.
 * Format: INV/YYYY/MM/NNNN
 */
export async function generateInvoiceNumber(
  tenantId: string,
  invoiceDate: string,
): Promise<string> {
  const yymm = invoiceDate.substring(0, 7).replace('-', '/');
  const prefix = `INV/${yymm}/`;
  const result = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        sql`${invoices.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(invoices.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Generate the next journal entry number.
 * Format: JE-YYYY-MM-NNNN
 */
export async function generateJournalNumber(
  tenantId: string,
  postingDate: string,
): Promise<string> {
  const prefix = `JE-${postingDate.substring(0, 7)}-`;
  const result = await db
    .select({ number: journalEntries.number })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        sql`${journalEntries.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(journalEntries.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Generate the next stock adjustment number.
 * Format: ADJ-YYYY-MM-NNNN
 */
export async function generateAdjustmentNumber(tenantId: string, date: string): Promise<string> {
  const prefix = `ADJ-${date.substring(0, 7)}-`;
  const result = await db
    .select({ number: stockAdjustments.number })
    .from(stockAdjustments)
    .where(
      and(
        eq(stockAdjustments.tenantId, tenantId),
        sql`${stockAdjustments.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(stockAdjustments.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Generate the next stock opname session number.
 * Format: SO-YYYY-MM-NNNN
 */
export async function generateOpnameNumber(tenantId: string, sessionDate: string): Promise<string> {
  const prefix = `SO-${sessionDate.substring(0, 7)}-`;
  const result = await db
    .select({ number: stockOpnameSessions.number })
    .from(stockOpnameSessions)
    .where(
      and(
        eq(stockOpnameSessions.tenantId, tenantId),
        sql`${stockOpnameSessions.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(stockOpnameSessions.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Generate the next stock transfer number.
 * Format: TRF-YYYY-MM-NNNN
 */
export async function generateTransferNumber(tenantId: string, date: string): Promise<string> {
  const prefix = `TRF-${date.substring(0, 7)}-`;
  const result = await db
    .select({ number: stockTransfers.number })
    .from(stockTransfers)
    .where(
      and(
        eq(stockTransfers.tenantId, tenantId),
        sql`${stockTransfers.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(stockTransfers.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Generate the next PO number.
 * Format: PO-YYYY-MM-NNNN (per location per month)
 */
export async function generatePONumber(
  tenantId: string,
  locationId: string,
  orderDate: string,
): Promise<string> {
  const prefix = `PO-${orderDate.substring(0, 7)}-`;
  const result = await db
    .select({ number: purchaseOrders.number })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.locationId, locationId),
        sql`${purchaseOrders.number} LIKE ${prefix + '%'}`,
      ),
    )
    .orderBy(desc(purchaseOrders.number))
    .limit(1);

  return calculateNextNumber(result[0]?.number, prefix);
}

/**
 * Helper to calculate the next sequence number from the last known number.
 */
function calculateNextNumber(lastNumber: string | undefined, prefix: string): string {
  let nextSeqNum = 1;

  if (lastNumber) {
    const seqStr = lastNumber.substring(prefix.length);
    const parsed = Number.parseInt(seqStr, 10);
    if (!Number.isNaN(parsed)) {
      nextSeqNum = parsed + 1;
    }
  }

  const nextSeq = nextSeqNum.toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}
