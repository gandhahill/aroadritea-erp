/**
 * shared/number-generator.ts
 *
 * Centralized number generator for ERP documents.
 * Uses MAX(number) + 1 algorithm to prevent collisions and race conditions
 * commonly caused by count(*)-based generation when records are deleted.
 */

import { db } from '@erp/db';
import { sequences } from '@erp/db/schema/common';
import { sql } from 'drizzle-orm';

async function calculateNextSequence(prefix: string, sequenceName: string): Promise<string> {
  const rows = await db
    .insert(sequences)
    .values({ name: sequenceName, currentVal: 1 })
    .onConflictDoUpdate({
      target: sequences.name,
      set: { currentVal: sql`${sequences.currentVal} + 1` },
    })
    .returning({ currentVal: sequences.currentVal });

  const nextSeq = rows[0]?.currentVal.toString().padStart(4, '0') ?? '0001';
  return `${prefix}${nextSeq}`;
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
 */
export async function generateOpnameNumber(tenantId: string, sessionDate: string): Promise<string> {
  const prefix = `SO-${sessionDate.substring(0, 7)}-`;
  return calculateNextSequence(prefix, `${tenantId}:${prefix}`);
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
