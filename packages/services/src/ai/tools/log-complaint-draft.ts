/**
 * Tool: log_complaint_draft — T-0173 (Phase 3 continuation).
 *
 * Same draft → confirm → commit pattern as `create_manual_sale_draft`.
 * The cashier describes a customer complaint to the assistant; the
 * tool stages a `complaint` draft; the user clicks "Setujui & Posting"
 * which calls `crm.logComplaint` server-side (re-checks the
 * `crm.logComplaint` permission and writes the row + audit).
 *
 * Sensitive customer fields (phone) are encrypted by `logComplaint`
 * itself — the draft payload stores the raw value so we never leak
 * a ciphertext through the chat to the model.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { createDraft } from '../drafts';

const CATEGORIES = [
  'product_quality',
  'service',
  'delivery',
  'payment',
  'hygiene',
  'staff',
  'other',
] as const;

export const LogComplaintDraftInputSchema = z.object({
  customer_name: z.string().min(1).max(120).optional(),
  customer_phone: z.string().min(6).max(32).optional(),
  member_id: z.string().min(1).max(64).optional(),
  order_number: z.string().min(1).max(64).optional(),
  occurred_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/)
    .optional(),
  category: z.enum(CATEGORIES),
  description: z.string().min(5).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
});

export type LogComplaintDraftInput = z.infer<typeof LogComplaintDraftInputSchema>;

export interface LogComplaintDraftOutput {
  draft_id: string;
  expires_at: string;
  summary: string;
  requires_confirmation: true;
  kind: 'complaint';
}

export interface LogComplaintDraftToolDeps {
  sessionId?: string;
  messageId?: string;
}

export async function logComplaintDraftTool(
  input: LogComplaintDraftInput,
  ctx: AuditContext,
  deps?: LogComplaintDraftToolDeps,
): Promise<LogComplaintDraftOutput> {
  const occurredAt = input.occurred_at?.includes('T')
    ? input.occurred_at
    : `${input.occurred_at ?? new Date().toISOString().slice(0, 10)}T00:00:00+07:00`;

  const payload = {
    memberId: input.member_id ?? undefined,
    customerName: input.customer_name ?? undefined,
    customerPhone: input.customer_phone ?? undefined,
    orderNumber: input.order_number ?? undefined,
    occurredAt,
    category: input.category,
    description: input.description.trim(),
    priority: input.priority,
  };

  const summary = [
    `Complaint draft (${input.category}, prioritas ${input.priority ?? 'medium'})`,
    input.customer_name ? `Pelanggan: ${input.customer_name}` : null,
    input.order_number ? `Order: ${input.order_number}` : null,
    `Tanggal: ${occurredAt.slice(0, 10)}`,
    `Detail: ${input.description.trim().slice(0, 240)}${input.description.length > 240 ? '…' : ''}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { id, expiresAt } = await createDraft({
    sessionId: deps?.sessionId ?? 'ad-hoc',
    messageId: deps?.messageId,
    kind: 'complaint',
    summary,
    payload,
    ctx,
  });

  return {
    draft_id: id,
    expires_at: expiresAt.toISOString(),
    summary,
    requires_confirmation: true,
    kind: 'complaint',
  };
}
