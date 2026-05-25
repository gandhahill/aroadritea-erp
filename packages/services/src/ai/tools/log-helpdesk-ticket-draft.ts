/**
 * Tool: log_helpdesk_ticket_draft — T-0184.
 *
 * AI assistant calls this whenever the user reports an error / bug /
 * problem in the ERP. The OLD behaviour was to tell them "kontak
 * admin" — that's friction. The new behaviour: file a helpdesk
 * ticket draft, surface it as a `<ConfirmActionCard>`, and once the
 * user clicks "Setujui" the server creates the real ticket which
 * auto-notifies handlers.
 *
 * Draft → confirm → commit pattern (same as complaint draft):
 *   - createDraft stages the payload server-side
 *   - the client renders a confirmation card (uses draft_id)
 *   - on commit, drafts.ts dispatches to createTicket which writes
 *     the row + audit + notifies anyone with helpdesk.handle
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { createDraft } from '../drafts';

const CATEGORIES = ['bug', 'request', 'question', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const LogHelpdeskTicketDraftInputSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(3).max(5000),
  category: z.enum(CATEGORIES).default('bug'),
  priority: z.enum(PRIORITIES).default('normal'),
  /** Optional structured hints (browser, current URL, related entity). */
  context: z.record(z.string(), z.unknown()).optional(),
});

export type LogHelpdeskTicketDraftInput = z.infer<typeof LogHelpdeskTicketDraftInputSchema>;

export interface LogHelpdeskTicketDraftOutput {
  draft_id: string;
  expires_at: string;
  summary: string;
  requires_confirmation: true;
  kind: 'helpdesk_ticket';
}

export interface LogHelpdeskTicketDraftToolDeps {
  sessionId?: string;
  messageId?: string;
}

export async function logHelpdeskTicketDraftTool(
  input: LogHelpdeskTicketDraftInput,
  ctx: AuditContext,
  deps?: LogHelpdeskTicketDraftToolDeps,
): Promise<LogHelpdeskTicketDraftOutput> {
  const payload = {
    subject: input.subject.trim(),
    body: input.body.trim(),
    category: input.category,
    priority: input.priority,
    createdVia: 'ai_chat',
    sourceAiSessionId: deps?.sessionId ?? null,
    context: input.context ?? null,
  };

  const summary = [
    `Tiket helpdesk (${input.category}, prioritas ${input.priority})`,
    `Subject: ${input.subject.trim().slice(0, 120)}`,
    `Detail: ${input.body.trim().slice(0, 240)}${input.body.length > 240 ? '…' : ''}`,
  ].join('\n');

  const { id, expiresAt } = await createDraft({
    sessionId: deps?.sessionId ?? 'ad-hoc',
    messageId: deps?.messageId,
    kind: 'helpdesk_ticket',
    summary,
    payload,
    ctx,
  });

  return {
    draft_id: id,
    expires_at: expiresAt.toISOString(),
    summary,
    requires_confirmation: true,
    kind: 'helpdesk_ticket',
  };
}
