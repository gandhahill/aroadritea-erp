/**
 * Helpdesk / ticketing service — T-0184.
 *
 * Anyone with `helpdesk.create` can file a ticket. The reporter and
 * any user with `helpdesk.handle` see it. The AI assistant calls
 * `createTicket` with `createdVia='ai_chat'` instead of suggesting
 * "contact admin" — the user just confirms the draft.
 *
 * On every new ticket we fan-out an in-app + email notification to
 * everyone with `helpdesk.handle`.
 */

import { db } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { helpdeskTicketReplies, helpdeskTickets } from '@erp/db/schema/helpdesk';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { can, requirePermission } from '../iam';
import { notifyByPermission, notifyUser } from '../notification';

// ─── Schemas ──────────────────────────────────────────────────────────────

export const CreateTicketInputSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(3).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.enum(['bug', 'request', 'question', 'other']).default('other'),
  createdVia: z.enum(['manual', 'ai_chat']).default('manual'),
  sourceAiSessionId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export const ReplyTicketInputSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export type ReplyTicketInput = z.infer<typeof ReplyTicketInputSchema>;

// ─── Types ────────────────────────────────────────────────────────────────

export interface TicketSummary {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  reporterUserId: string;
  reporterName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  createdVia: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketReply {
  id: string;
  authorUserId: string;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  body: string;
  sourceAiSessionId: string | null;
  context: Record<string, unknown> | null;
  resolvedAt: string | null;
  closedAt: string | null;
  firstResponseAt: string | null;
  replies: TicketReply[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function generateTicketNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7).replace('-', '');
  const prefix = `TKT-${ym}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.tenantId, tenantId),
        sql`${helpdeskTickets.number} LIKE ${prefix + '%'}`,
      ),
    );
  const next = (Number(row?.count ?? 0) + 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

async function resolveUserName(userId: string): Promise<string | null> {
  if (!userId) return null;
  const [u] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.name ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────

export async function createTicket(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<TicketSummary>> {
  const parsed = CreateTicketInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      AppError.validation('helpdesk.invalidInput', { detail: parsed.error.message }),
    );
  }
  const permCheck = await requirePermission(ctx.userId, 'helpdesk.create');
  if (!permCheck.ok) return permCheck;

  const number = await generateTicketNumber(ctx.tenantId);
  const id = generateId();
  await db.insert(helpdeskTickets).values({
    id,
    tenantId: ctx.tenantId,
    number,
    subject: parsed.data.subject,
    body: parsed.data.body,
    status: 'open',
    priority: parsed.data.priority,
    category: parsed.data.category,
    reporterUserId: ctx.userId,
    assigneeUserId: null,
    createdVia: parsed.data.createdVia,
    sourceAiSessionId: parsed.data.sourceAiSessionId ?? null,
    contextJson: parsed.data.context ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  await auditRecord({
    action: 'create',
    entityType: 'helpdesk_ticket',
    entityId: id,
    before: null,
    after: {
      number,
      subject: parsed.data.subject,
      priority: parsed.data.priority,
      category: parsed.data.category,
      createdVia: parsed.data.createdVia,
    },
    ctx,
  });

  // Fan out to handlers.
  void notifyByPermission({
    tenantId: ctx.tenantId,
    kind: 'helpdesk',
    title: `[Tiket Baru ${number}] ${parsed.data.subject}`,
    body: parsed.data.body.slice(0, 300),
    link: `/helpdesk/${id}`,
    permission: 'helpdesk.handle',
  });

  const reporterName = await resolveUserName(ctx.userId);
  return ok({
    id,
    number,
    subject: parsed.data.subject,
    status: 'open',
    priority: parsed.data.priority,
    category: parsed.data.category,
    reporterUserId: ctx.userId,
    reporterName,
    assigneeUserId: null,
    assigneeName: null,
    createdVia: parsed.data.createdVia,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ─── List ─────────────────────────────────────────────────────────────────

export interface ListTicketsFilter {
  mine?: boolean; // reporter or assignee = me
  status?: string;
  limit?: number;
}

export async function listTickets(
  filter: ListTicketsFilter,
  ctx: AuditContext,
): Promise<Result<TicketSummary[]>> {
  // Anyone with helpdesk.view sees their own tickets; helpdesk.handle
  // sees everything in the tenant.
  const handleAllowed = await can(ctx.userId, 'helpdesk.handle');
  const viewAllowed = handleAllowed || (await can(ctx.userId, 'helpdesk.view'));
  if (!viewAllowed) {
    return err(AppError.forbidden('helpdesk.notAllowed'));
  }

  const conds = [eq(helpdeskTickets.tenantId, ctx.tenantId)];
  if (filter.status) conds.push(eq(helpdeskTickets.status, filter.status));
  // Non-handler: scope to own tickets (reporter or assignee).
  if (!handleAllowed || filter.mine) {
    conds.push(
      or(
        eq(helpdeskTickets.reporterUserId, ctx.userId),
        eq(helpdeskTickets.assigneeUserId, ctx.userId),
      )!,
    );
  }
  const limit = Math.min(filter.limit ?? 100, 500);

  const rows = await db
    .select()
    .from(helpdeskTickets)
    .where(and(...conds))
    .orderBy(desc(helpdeskTickets.createdAt))
    .limit(limit);

  // Resolve names in batch.
  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.reporterUserId, r.assigneeUserId].filter((x): x is string => !!x)),
    ),
  ];
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .where(sql`${users.id} = ANY(${userIds})`)
    : [];
  const nameMap = new Map(userRows.map((u) => [u.id, u.name]));

  return ok(
    rows.map((r) => ({
      id: r.id,
      number: r.number,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      category: r.category,
      reporterUserId: r.reporterUserId,
      reporterName: nameMap.get(r.reporterUserId) ?? null,
      assigneeUserId: r.assigneeUserId,
      assigneeName: r.assigneeUserId ? nameMap.get(r.assigneeUserId) ?? null : null,
      createdVia: r.createdVia,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  );
}

// ─── Get detail ───────────────────────────────────────────────────────────

export async function getTicket(
  ticketId: string,
  ctx: AuditContext,
): Promise<Result<TicketDetail>> {
  const [row] = await db
    .select()
    .from(helpdeskTickets)
    .where(and(eq(helpdeskTickets.tenantId, ctx.tenantId), eq(helpdeskTickets.id, ticketId)))
    .limit(1);
  if (!row) return err(AppError.notFound('helpdesk.notFound'));

  const handleAllowed = await can(ctx.userId, 'helpdesk.handle');
  const isOwn = row.reporterUserId === ctx.userId || row.assigneeUserId === ctx.userId;
  if (!handleAllowed && !isOwn) {
    return err(AppError.forbidden('helpdesk.notAllowed'));
  }

  const replyRows = await db
    .select()
    .from(helpdeskTicketReplies)
    .where(eq(helpdeskTicketReplies.ticketId, row.id))
    .orderBy(helpdeskTicketReplies.createdAt);

  // Filter internal notes for non-handlers.
  const visibleReplies = handleAllowed
    ? replyRows
    : replyRows.filter((r) => r.isInternal !== 'true');

  const userIds = [
    ...new Set([
      row.reporterUserId,
      ...(row.assigneeUserId ? [row.assigneeUserId] : []),
      ...visibleReplies.map((r) => r.authorUserId),
    ]),
  ];
  const userRows = await db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(sql`${users.id} = ANY(${userIds})`);
  const nameMap = new Map(userRows.map((u) => [u.id, u.name]));

  return ok({
    id: row.id,
    number: row.number,
    subject: row.subject,
    body: row.body,
    status: row.status,
    priority: row.priority,
    category: row.category,
    reporterUserId: row.reporterUserId,
    reporterName: nameMap.get(row.reporterUserId) ?? null,
    assigneeUserId: row.assigneeUserId,
    assigneeName: row.assigneeUserId ? nameMap.get(row.assigneeUserId) ?? null : null,
    createdVia: row.createdVia,
    sourceAiSessionId: row.sourceAiSessionId,
    context: row.contextJson as Record<string, unknown> | null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replies: visibleReplies.map((r) => ({
      id: r.id,
      authorUserId: r.authorUserId,
      authorName: nameMap.get(r.authorUserId) ?? null,
      body: r.body,
      isInternal: r.isInternal === 'true',
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// ─── Reply ────────────────────────────────────────────────────────────────

export async function replyTicket(
  rawInput: unknown,
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const parsed = ReplyTicketInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(AppError.validation('helpdesk.invalidInput'));
  }
  const [row] = await db
    .select()
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.tenantId, ctx.tenantId),
        eq(helpdeskTickets.id, parsed.data.ticketId),
      ),
    )
    .limit(1);
  if (!row) return err(AppError.notFound('helpdesk.notFound'));

  const handleAllowed = await can(ctx.userId, 'helpdesk.handle');
  const isReporter = row.reporterUserId === ctx.userId;
  if (!handleAllowed && !isReporter) {
    return err(AppError.forbidden('helpdesk.notAllowed'));
  }
  // Only handlers may write internal notes.
  const internal = parsed.data.isInternal && handleAllowed;

  const replyId = generateId();
  const now = new Date();
  await db.insert(helpdeskTicketReplies).values({
    id: replyId,
    ticketId: row.id,
    authorUserId: ctx.userId,
    body: parsed.data.body,
    isInternal: internal ? 'true' : 'false',
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  });

  // First handler reply stamps first_response_at; also nudges status.
  const isFirstHandlerReply =
    handleAllowed && !isReporter && !row.firstResponseAt;
  await db
    .update(helpdeskTickets)
    .set({
      updatedBy: ctx.userId,
      updatedAt: now,
      firstResponseAt: isFirstHandlerReply ? now : row.firstResponseAt,
      status:
        row.status === 'open' && handleAllowed ? 'in_progress' : row.status,
    })
    .where(eq(helpdeskTickets.id, row.id));

  // Notify the other side.
  if (handleAllowed && !isReporter && !internal) {
    void notifyUser({
      tenantId: ctx.tenantId,
      userId: row.reporterUserId,
      kind: 'helpdesk',
      title: `Balasan untuk tiket ${row.number}`,
      body: parsed.data.body.slice(0, 300),
      link: `/helpdesk/${row.id}`,
    });
  } else if (isReporter) {
    void notifyByPermission({
      tenantId: ctx.tenantId,
      kind: 'helpdesk',
      title: `Reporter balas tiket ${row.number}`,
      body: parsed.data.body.slice(0, 300),
      link: `/helpdesk/${row.id}`,
      permission: 'helpdesk.handle',
    });
  }

  return ok({ id: replyId });
}

// ─── Status transitions ──────────────────────────────────────────────────

async function transitionStatus(
  ticketId: string,
  to: 'in_progress' | 'waiting_reporter' | 'resolved' | 'closed' | 'open',
  ctx: AuditContext,
): Promise<Result<{ id: string; status: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'helpdesk.handle');
  if (!permCheck.ok) return permCheck;
  const [row] = await db
    .select()
    .from(helpdeskTickets)
    .where(and(eq(helpdeskTickets.tenantId, ctx.tenantId), eq(helpdeskTickets.id, ticketId)))
    .limit(1);
  if (!row) return err(AppError.notFound('helpdesk.notFound'));
  const now = new Date();
  await db
    .update(helpdeskTickets)
    .set({
      status: to,
      resolvedAt: to === 'resolved' ? now : row.resolvedAt,
      closedAt: to === 'closed' ? now : row.closedAt,
      updatedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(helpdeskTickets.id, row.id));

  await auditRecord({
    action: 'update',
    entityType: 'helpdesk_ticket',
    entityId: row.id,
    before: { status: row.status },
    after: { status: to },
    ctx,
  });

  // Tell the reporter when the ticket closes / resolves.
  if ((to === 'resolved' || to === 'closed') && row.reporterUserId !== ctx.userId) {
    void notifyUser({
      tenantId: ctx.tenantId,
      userId: row.reporterUserId,
      kind: 'helpdesk',
      title:
        to === 'resolved'
          ? `Tiket ${row.number} dinyatakan resolved`
          : `Tiket ${row.number} ditutup`,
      body: row.subject,
      link: `/helpdesk/${row.id}`,
    });
  }

  return ok({ id: row.id, status: to });
}

export const setTicketInProgress = (id: string, ctx: AuditContext) =>
  transitionStatus(id, 'in_progress', ctx);
export const setTicketResolved = (id: string, ctx: AuditContext) =>
  transitionStatus(id, 'resolved', ctx);
export const setTicketClosed = (id: string, ctx: AuditContext) =>
  transitionStatus(id, 'closed', ctx);
export const setTicketOpen = (id: string, ctx: AuditContext) =>
  transitionStatus(id, 'open', ctx);

// ─── Assign ───────────────────────────────────────────────────────────────

export async function assignTicket(
  input: { ticketId: string; assigneeUserId: string },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  const permCheck = await requirePermission(ctx.userId, 'helpdesk.handle');
  if (!permCheck.ok) return permCheck;
  const [row] = await db
    .select()
    .from(helpdeskTickets)
    .where(
      and(eq(helpdeskTickets.tenantId, ctx.tenantId), eq(helpdeskTickets.id, input.ticketId)),
    )
    .limit(1);
  if (!row) return err(AppError.notFound('helpdesk.notFound'));

  await db
    .update(helpdeskTickets)
    .set({
      assigneeUserId: input.assigneeUserId,
      status: row.status === 'open' ? 'in_progress' : row.status,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(eq(helpdeskTickets.id, row.id));

  await auditRecord({
    action: 'update',
    entityType: 'helpdesk_ticket',
    entityId: row.id,
    before: { assigneeUserId: row.assigneeUserId },
    after: { assigneeUserId: input.assigneeUserId },
    ctx,
  });

  // Tell the new assignee.
  void notifyUser({
    tenantId: ctx.tenantId,
    userId: input.assigneeUserId,
    kind: 'helpdesk',
    title: `Tiket ${row.number} ditugaskan kepada Anda`,
    body: row.subject,
    link: `/helpdesk/${row.id}`,
  });

  return ok({ id: row.id });
}
