import { db } from '@erp/db';
import { accounts, journalEntries, journalLines, partners } from '@erp/db/schema/accounting';
import { notificationChannels } from '@erp/db/schema/notification';
import { notifyByPermission } from '@erp/services/notification';
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';

export interface PartyLedgerReminderJobData {
  tenantId?: string;
}

export async function partyLedgerReminderHandler(
  data: PartyLedgerReminderJobData = {},
): Promise<void> {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
    .innerJoin(
      accounts,
      and(eq(accounts.id, journalLines.accountId), eq(accounts.tenantId, journalEntries.tenantId)),
    )
    .leftJoin(
      partners,
      and(eq(partners.id, journalLines.partnerId), eq(partners.tenantId, journalEntries.tenantId)),
    )
    .where(
      and(
        tenantFilter,
        eq(journalEntries.status, 'posted'),
        isNotNull(journalLines.dueDate),
        isNotNull(journalLines.reminderDaysBefore),
        isNull(journalLines.reminderSentAt),
        sql`${journalLines.dueDate} <= (${today}::date + ${journalLines.reminderDaysBefore})`,
        inArray(accounts.subtype, ['payable', 'receivable']),
      ),
    )
    .limit(200);

  const channelConditions = [
    eq(notificationChannels.isActive, true),
    or(eq(notificationChannels.purpose, 'all'), eq(notificationChannels.purpose, 'party_ledger')),
  ];
  if (data.tenantId) channelConditions.push(eq(notificationChannels.tenantId, data.tenantId));

  const channels = await db
    .select({
      tenantId: notificationChannels.tenantId,
      channelType: notificationChannels.channelType,
      target: notificationChannels.target,
    })
    .from(notificationChannels)
    .where(and(...channelConditions));

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

    const deliveryResults = await Promise.all(
      channels
        .filter((channel) => channel.tenantId === row.tenantId)
        .map((channel) =>
          sendOperationalReminder(channel.channelType, channel.target, {
            subject: `[Aroadri ERP] ${title}`,
            body,
          }),
        ),
    );
    if (deliveryResults.some((result) => !result.sent)) {
      console.warn('[party-ledger-reminders] One or more notification channels failed', {
        journalLineId: row.journalLineId,
        failures: deliveryResults.filter((result) => !result.sent).map((result) => result.error),
      });
      continue;
    }
    await markSent(row.journalLineId);
  }
}

async function markSent(journalLineId: string) {
  await db
    .update(journalLines)
    .set({ reminderSentAt: new Date() })
    .where(eq(journalLines.id, journalLineId));
}

async function sendOperationalReminder(
  channelType: string,
  target: string,
  message: { subject: string; body: string },
): Promise<{ sent: boolean; error?: string }> {
  if (channelType !== 'email') {
    return { sent: false, error: `Unsupported channel type for party ledger reminder: ${channelType}` };
  }

  const smtpHost = process.env.SMTP_HOST;
  const configuredPort = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  const smtpPort = Number.isFinite(configuredPort) ? configuredPort : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddr = process.env.SMTP_FROM ?? 'noreply@aroadritea.com';
  const fromName = process.env.SMTP_FROM_NAME ?? 'Aroadri ERP';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { sent: false, error: 'SMTP env vars not configured' };
  }

  try {
    const nodemailer = await import('nodemailer');
    const secure =
      process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: fromAddr.includes('<') ? fromAddr : `${fromName} <${fromAddr}>`,
      to: target,
      subject: message.subject,
      text: message.body,
    });

    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}
