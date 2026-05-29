import { db } from '@erp/db';
import { helpdeskTickets } from '@erp/db/schema/helpdesk';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { notifyByPermission } from '@erp/services/notification';
import { generateId } from '@erp/shared/id';
import { auditLog } from '@erp/db/schema/audit';

export interface HelpdeskSlaCheckJobData {
  tenantId?: string;
}

export async function helpdeskSlaCheckHandler(
  data: HelpdeskSlaCheckJobData = {},
) {
  console.log('Checking for helpdesk SLA breaches...');
  const now = new Date();

  // Find tickets that are open, have slaDueDate in the past, and are not yet breached
  const breachedTickets = await db
    .select()
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.status, 'open'),
        eq(helpdeskTickets.isSlaBreached, false),
        isNotNull(helpdeskTickets.slaDueDate),
        lt(helpdeskTickets.slaDueDate, now),
      )
    );

  if (breachedTickets.length === 0) {
    console.log('No new breached tickets found.');
    return;
  }

  console.log(`Found ${breachedTickets.length} breached tickets. Escalating...`);

  for (const ticket of breachedTickets) {
    await db
      .update(helpdeskTickets)
      .set({
        isSlaBreached: true,
        escalationLevel: ticket.escalationLevel + 1,
        updatedAt: now,
      })
      .where(eq(helpdeskTickets.id, ticket.id));

    await db.insert(auditLog).values({
      id: generateId(),
      tenantId: ticket.tenantId,
      userId: 'system',
      action: 'escalate',
      entityType: 'helpdesk_ticket',
      entityId: ticket.id,
      before: { isSlaBreached: false, escalationLevel: ticket.escalationLevel },
      after: { isSlaBreached: true, escalationLevel: ticket.escalationLevel + 1 },
      metadata: { reason: 'SLA breached' },
    });

    void notifyByPermission({
      tenantId: ticket.tenantId,
      kind: 'helpdesk',
      title: `[ESKALASI] Tiket ${ticket.number} melewati SLA`,
      body: `Tiket ${ticket.subject} belum diselesaikan dan sudah melewati batas waktu SLA.`,
      link: `/helpdesk/${ticket.id}`,
      permission: 'helpdesk.handle',
    });
  }

  console.log('SLA check complete.');
}