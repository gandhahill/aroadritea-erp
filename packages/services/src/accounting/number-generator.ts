/**
 * Journal Entry number generator.
 *
 * Format: JE-YYYY-MM-NNNN (zero-padded sequence per period).
 * E.g., JE-2026-05-0001, JE-2026-05-0042
 *
 * Queries existing JEs in the same period to determine the next number.
 * Uses COUNT + 1 (sufficient for single-server deployment).
 */

import { db } from '@erp/db';
import { journalEntries } from '@erp/db/schema/accounting';
import { and, eq, sql } from 'drizzle-orm';

/**
 * Generate the next journal entry number for a given tenant + posting date.
 *
 * @param tenantId - The tenant
 * @param postingDate - YYYY-MM-DD string, used to derive YYYY-MM prefix
 * @returns e.g. "JE-2026-05-0001"
 */
export async function generateJournalNumber(
  tenantId: string,
  postingDate: string,
): Promise<string> {
  // Extract YYYY-MM from posting date
  const prefix = `JE-${postingDate.substring(0, 7)}-`;

  // Count existing JEs with same prefix in same tenant
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        sql`${journalEntries.number} LIKE ${prefix + '%'}`,
      ),
    );

  const currentCount = Number(result[0]?.count ?? 0);
  const nextSeq = (currentCount + 1).toString().padStart(4, '0');

  return `${prefix}${nextSeq}`;
}
