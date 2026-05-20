import { db } from '@erp/db';
import { accounts, journalEntries, journalLines, partners } from '@erp/db/schema/accounting';
import { notifyByPermission } from '@erp/services/notification';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

export interface PartyLedgerReminderJobData {
  tenantId?: string;
}

export async function partyLedgerReminderHandler(
  data: PartyLedgerReminderJobData = {},
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const tenantFilter = data.tenantId ? eq(journalEntries.tenantId, data.tenantId) : sql`1=1`;

  const rows = await db
    .select({
      journalLineId: journalLines.id,
      tenantId: journalEntries.tenantId,
      journalNumber: journalEntries.number,
      dueDate: journalLines.dueDate,
      reminderDaysBefore: journalLines.reminderDaysBefore,
      debit: journalLines.debit,
      credit: journalLines.credit,
      accountType: accounts.type,
      accountSubtype: accounts.subtype,
      partnerName: partners.name,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .leftJoin(partners, eq(partners.id, journalLines.partnerId))
    .where(
      and(
        tenantFilter,
        eq(journalEntries.status, 'posted'),
        isNotNull(journalLines.dueDate),
        isNotNull(journalLines.reminderDaysBefore),
        isNull(journalLines.reminderSentAt),
        sql`${journalLines.dueDate} - (${journalLines.reminderDaysBefore}::int * interval '1 day') <= ${today}::date`,
        sql`(${accounts.subtype} = 'payable' OR ${accounts.subtype} = 'receivable')`,
      ),
    )
    .limit(200);

  for (const row of rows) {
    const amount =
      row.accountSubtype === 'receivable' ? row.debit - row.credit : row.credit - row.debit;
    if (amount <= 0n) {
      await markSent(row.journalLineId);
      continue;
    }

    const kind = row.accountSubtype === 'receivable' ? 'receivable_due' : 'payable_due';
    const title =
      row.accountSubtype === 'receivable' ? 'Piutang mendekati jatuh tempo' : 'Utang mendekati jatuh tempo';
    const body = `${row.partnerName ?? 'Tanpa partner'} | ${row.journalNumber} | jatuh tempo ${String(row.dueDate).slice(0, 10)}`;

    await notifyByPermission({
      tenantId: row.tenantId,
      kind,
      title,
      body,
      link: row.accountSubtype === 'receivable' ? '/accounting/receivables' : '/accounting/payables',
      permission: 'accounting.view',
    });
    await markSent(row.journalLineId);
  }
}

async function markSent(journalLineId: string) {
  await db
    .update(journalLines)
    .set({ reminderSentAt: new Date() })
    .where(eq(journalLines.id, journalLineId));
}
