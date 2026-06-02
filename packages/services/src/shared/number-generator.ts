/**
 * shared/number-generator.ts
 *
 * Centralized number generator for ERP documents.
 * Uses atomic INSERT ... ON CONFLICT DO UPDATE on a sequences table.
 * Retries up to MAX_RETRIES times if the generated number already
 * exists (e.g. sequence counter was out of sync with existing data).
 */

import { db } from '@erp/db';
import { sequences } from '@erp/db/schema/common';
import { sql } from 'drizzle-orm';

const MAX_RETRIES = 5;

async function nextSequenceValue(sequenceName: string): Promise<number> {
  const rows = await db
    .insert(sequences)
    .values({ name: sequenceName, currentVal: 1 })
    .onConflictDoUpdate({
      target: sequences.name,
      set: { currentVal: sql`${sequences.currentVal} + 1` },
    })
    .returning({ currentVal: sequences.currentVal });

  return rows[0]?.currentVal ?? 1;
}

/**
 * Generate the next sequence number with the given prefix.
 * If the caller's INSERT hits a unique constraint on the generated number,
 * it should call this again — the counter will already have advanced.
 */
async function calculateNextSequence(prefix: string, sequenceName: string): Promise<string> {
  const val = await nextSequenceValue(sequenceName);
  return `${prefix}${val.toString().padStart(4, '0')}`;
}

/**
 * Generate a unique number, retrying if a duplicate already exists.
 * Use this wrapper when the target table has a unique constraint on
 * the number column and the sequence counter may be out of sync
 * (e.g. records were created before the sequences table existed).
 */
export async function generateUniqueNumber(
  prefix: string,
  sequenceName: string,
  existsCheck: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = await calculateNextSequence(prefix, sequenceName);
    const exists = await existsCheck(candidate);
    if (!exists) return candidate;
    // Sequence counter already advanced on each call, so next loop gets +1
  }
  // Fallback: should not happen, but produce a high-sequence number
  const val = await nextSequenceValue(sequenceName);
  return `${prefix}${val.toString().padStart(4, '0')}`;
}

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
  return calculateNextSequence(prefix, `${tenantId}:${prefix}`);
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
  return calculateNextSequence(prefix, `${tenantId}:${prefix}`);
}

/**
 * Generate the next stock adjustment number.
 * Format: ADJ-YYYY-MM-NNNN
 */
export async function generateAdjustmentNumber(tenantId: string, date: string): Promise<string> {
  const prefix = `ADJ-${date.substring(0, 7)}-`;
  return calculateNextSequence(prefix, `${tenantId}:${prefix}`);
}

/**
 * Generate the next stock opname session number.
 * Format: SO-YYYY-MM-NNNN
 * Uses retry logic to handle out-of-sync sequence counters.
 */
export async function generateOpnameNumber(tenantId: string, sessionDate: string): Promise<string> {
  const prefix = `SO-${sessionDate.substring(0, 7)}-`;
  const seqName = `${tenantId}:${prefix}`;
  return generateUniqueNumber(prefix, seqName, async (candidate) => {
    const rows = await db.execute(
      sql`SELECT 1 FROM stock_opname_sessions WHERE number = ${candidate} LIMIT 1`,
    );
    return (rows as unknown as Array<unknown>).length > 0;
  });
}

/**
 * Generate the next stock transfer number.
 * Format: TRF-YYYY-MM-NNNN
 */
export async function generateTransferNumber(tenantId: string, date: string): Promise<string> {
  const prefix = `TRF-${date.substring(0, 7)}-`;
  return calculateNextSequence(prefix, `${tenantId}:${prefix}`);
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
  return calculateNextSequence(prefix, `${tenantId}:${locationId}:${prefix}`);
}
