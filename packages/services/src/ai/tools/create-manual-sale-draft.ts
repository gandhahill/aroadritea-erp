/**
 * Tool: create_manual_sale_draft — T-0172 (Phase 3).
 *
 * Stages a manual-sales closing as a draft so the UI can show a
 * confirmation card. The commit happens later via
 * `confirmDraftAction(draftId)` which re-checks `pos.transact`
 * permission and dispatches to `createManualSalesClosing`.
 *
 * The model is allowed to call this whenever the user explicitly asks
 * to record yesterday's / closing-shift sales numbers from the legacy
 * POS — typically driven by `ocr_receipt_struk` reading a photo.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { createDraft } from '../drafts';

export const CreateManualSaleDraftInputSchema = z.object({
  /** Outlet ID. Defaults to caller's session location. */
  location_id: z.string().min(1).max(64).optional(),
  /** YYYY-MM-DD of the sales day being recorded. */
  sales_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Channel (e.g. walk_in, gofood, grabfood, shopeefood). Defaults walk_in. */
  channel: z.string().min(2).max(32).optional().default('walk_in'),
  /** Payment method slug (cash, qris, bank_transfer, ...). Defaults cash. */
  payment_method: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/)
    .optional()
    .default('cash'),
  /** Gross sales total in IDR as integer string (no separators). */
  gross_sales: z.string().regex(/^\d+$/),
  /** Optional discount in IDR (default 0). */
  discount_total: z.string().regex(/^\d+$/).optional().default('0'),
  /** Number of transactions if known. */
  transaction_count: z.number().int().min(0).optional().default(0),
  /** Free-form reference (e.g. receipt photo file name). */
  source_reference: z.string().max(120).optional(),
  /** Operator notes / OCR caveats. */
  notes: z.string().max(1000).optional(),
});

export type CreateManualSaleDraftInput = z.infer<typeof CreateManualSaleDraftInputSchema>;

export interface CreateManualSaleDraftOutput {
  draft_id: string;
  expires_at: string;
  summary: string;
  requires_confirmation: true;
  payload: Record<string, unknown>;
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

export interface CreateManualSaleDraftToolDeps {
  sessionId?: string;
  messageId?: string;
}

export async function createManualSaleDraftTool(
  input: CreateManualSaleDraftInput,
  ctx: AuditContext,
  deps?: CreateManualSaleDraftToolDeps,
): Promise<CreateManualSaleDraftOutput> {
  const locationId = input.location_id?.trim() || ctx.locationId?.trim() || '';
  if (!locationId) {
    throw new Error(
      'location_id is required when the caller has no session location to inherit from',
    );
  }
  const idempotencyKey = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const payload = {
    locationId,
    salesDate: input.sales_date,
    channel: input.channel,
    paymentMethod: input.payment_method,
    grossSales: input.gross_sales,
    discountTotal: input.discount_total ?? '0',
    transactionCount: input.transaction_count ?? 0,
    sourceReference: input.source_reference ?? null,
    notes: input.notes ?? null,
    idempotencyKey,
  };

  const gross = Number(input.gross_sales);
  const summary = [
    `Manual sales draft untuk ${input.sales_date}`,
    `Lokasi ${locationId} · channel ${input.channel} · ${input.payment_method}`,
    `Gross ${IDR.format(gross)}${input.discount_total && input.discount_total !== '0' ? ` (diskon ${IDR.format(Number(input.discount_total))})` : ''}`,
    `${input.transaction_count ?? 0} transaksi`,
    input.notes ? `Catatan: ${input.notes.slice(0, 120)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { id, expiresAt } = await createDraft({
    sessionId: deps?.sessionId ?? 'ad-hoc',
    messageId: deps?.messageId,
    kind: 'manual_sale',
    summary,
    payload,
    ctx,
  });

  return {
    draft_id: id,
    expires_at: expiresAt.toISOString(),
    summary,
    requires_confirmation: true,
    payload,
  };
}
