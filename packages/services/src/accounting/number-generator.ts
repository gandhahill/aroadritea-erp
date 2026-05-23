/**
 * Journal Entry number generator.
 *
 * Format: JE-YYYY-MM-NNNN (zero-padded sequence per period).
 * E.g., JE-2026-05-0001, JE-2026-05-0042
 *
 * Queries existing JEs in the same period to determine the next number.
 * Uses MAX(number) + 1 to prevent collisions after deletions.
 */

import { db } from '@erp/db';
import { journalEntries } from '@erp/db/schema/accounting';
import { and, desc, eq, sql } from 'drizzle-orm';

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

  // Get the latest JE number with the same prefix
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

  const lastNumber = result[0]?.number;
  let nextSeqNum = 1;

  if (lastNumber) {
    // Extract the sequence part 'NNNN' from 'JE-YYYY-MM-NNNN'
    const seqStr = lastNumber.substring(prefix.length);
    const parsed = parseInt(seqStr, 10);
    if (!Number.isNaN(parsed)) {
      nextSeqNum = parsed + 1;
    }
  }

  const nextSeq = nextSeqNum.toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}
