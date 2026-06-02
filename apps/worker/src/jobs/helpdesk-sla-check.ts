import { db } from '@erp/db';
import { helpdeskTickets } from '@erp/db/schema/helpdesk';
import { auditRecord } from '@erp/services/audit';
import { notifyByPermission } from '@erp/services/notification';
import { and, eq, isNotNull, lt } from 'drizzle-orm';

export interface HelpdeskSlaCheckJobData {
  tenantId?: string;
}

export async function helpdeskSlaCheckHandler(data: HelpdeskSlaCheckJobData = {}) {
  const tenantId = data.tenantId?.trim() || 'default';
  console.info(`[helpdesk-sla-check] Checking SLA breaches for tenant ${tenantId}`);
  const now = new Date();

  // Find tickets that are open, have slaDueDate in the past, and are not yet breached
  const breachedTickets = await db
    .select()
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.status, 'open'),
        eq(helpdeskTickets.tenantId, tenantId),
        eq(helpdeskTickets.isSlaBreached, false),
        isNotNull(helpdeskTickets.slaDueDate),
        lt(helpdeskTickets.slaDueDate, now),
      ),
    );

  if (breachedTickets.length === 0) {
    console.info(`[helpdesk-sla-check] No new breached tickets found for tenant ${tenantId}`);
    return;
  }

  console.info(
    `[helpdesk-sla-check] Found ${breachedTickets.length} breached tickets for tenant ${tenantId}`,
  );

  for (const ticket of breachedTickets) {
    await db
      .update(helpdeskTickets)
      .set({
        isSlaBreached: true,
        escalationLevel: ticket.escalationLevel + 1,
        updatedAt: now,
      })
      .where(and(eq(helpdeskTickets.id, ticket.id), eq(helpdeskTickets.tenantId, tenantId)));

    await auditRecord({
      action: 'escalate',
      entityType: 'helpdesk_ticket',
      entityId: ticket.id,
      before: { isSlaBreached: false, escalationLevel: ticket.escalationLevel },
      after: { isSlaBreached: true, escalationLevel: ticket.escalationLevel + 1 },
      metadata: { reason: 'SLA breached' },
      ctx: {
        tenantId: ticket.tenantId,
        userId: 'system',
        locationId: '',
      },
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

  console.info(`[helpdesk-sla-check] SLA check complete for tenant ${tenantId}`);
}
