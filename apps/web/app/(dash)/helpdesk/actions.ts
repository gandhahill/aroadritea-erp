'use server';

import { getSession } from '@/lib/auth';
import {
  type CreateTicketInput,
  type TicketDetail,
  type TicketSummary,
  assignTicket,
  createTicket,
  getTicket,
  listTickets,
  replyTicket,
  setTicketClosed,
  setTicketInProgress,
  setTicketOpen,
  setTicketResolved,
} from '@erp/services/helpdesk';
import type { AuditContext } from '@erp/shared/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function buildCtx(): Promise<AuditContext> {
  const session = await getSession();
  if (!session?.user) redirect('/login');
  const user = session.user as Record<string, unknown>;
  return {
    userId: String(user.id ?? ''),
    tenantId: String(user.tenantId ?? 'default'),
    locationId: String(user.locationId ?? ''),
  };
}

export async function listTicketsAction(filter: {
  mine?: boolean;
  status?: string;
}): Promise<{ items?: TicketSummary[]; error?: string }> {
  const ctx = await buildCtx();
  const result = await listTickets(filter, ctx);
  if (!result.ok) return { error: result.error.message };
  return { items: result.value };
}

export async function getTicketAction(
  id: string,
): Promise<{ data?: TicketDetail; error?: string }> {
  const ctx = await buildCtx();
  const result = await getTicket(id, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function createTicketAction(
  input: CreateTicketInput,
): Promise<{ id?: string; number?: string; error?: string }> {
  const ctx = await buildCtx();
  const result = await createTicket(input, ctx);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/helpdesk');
  return { id: result.value.id, number: result.value.number };
}

export async function replyTicketAction(input: {
  ticketId: string;
  body: string;
  isInternal?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const result = await replyTicket(input, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath(`/helpdesk/${input.ticketId}`);
  return { ok: true };
}

export async function setTicketStatusAction(
  id: string,
  status: 'in_progress' | 'resolved' | 'closed' | 'open',
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const fn =
    status === 'in_progress'
      ? setTicketInProgress
      : status === 'resolved'
        ? setTicketResolved
        : status === 'closed'
          ? setTicketClosed
          : setTicketOpen;
  const result = await fn(id, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath(`/helpdesk/${id}`);
  revalidatePath('/helpdesk');
  return { ok: true };
}

export async function assignTicketAction(
  ticketId: string,
  assigneeUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const result = await assignTicket({ ticketId, assigneeUserId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath(`/helpdesk/${ticketId}`);
  return { ok: true };
}
