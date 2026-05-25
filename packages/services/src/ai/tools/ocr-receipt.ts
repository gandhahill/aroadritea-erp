/**
 * Tool: ocr_receipt_struk — T-0172 (Phase 3).
 *
 * Reads a photographed receipt from the legacy POS via DeepSeek's
 * multimodal /chat/completions endpoint (the same one used by the
 * normal chat — vision is just an `image_url` content part). The model
 * is asked to return strict JSON; the result becomes a manual-sales
 * draft via `create_manual_sale_draft`.
 *
 * The tool itself does NOT post to manual_sales. It only stages a
 * draft so the cashier still has to click "Setujui & Posting" in the
 * UI — that path re-checks `pos.transact` permission.
 *
 * The `attachment_url` is expected to be a value the model can fetch
 * (e.g. an absolute URL or `data:image/...;base64,...`). The UI uploads
 * files to /api/uploads (area=ai-attachments) and forwards the relative
 * URL — we resolve it to an absolute URL using `NEXT_PUBLIC_WEB_URL`
 * so DeepSeek can pull it.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { type AiChatMessage, aiComplete, loadProviderConfig } from '../client';
import {
  type CreateManualSaleDraftToolDeps,
  createManualSaleDraftTool,
} from './create-manual-sale-draft';

export const OcrReceiptStrukInputSchema = z.object({
  attachment_url: z.string().min(1).max(2000),
  /** Outlet ID; defaults to caller's session location. */
  location_id: z.string().min(1).max(64).optional(),
  /** Optional hint about which channel the struk came from. */
  channel: z.string().min(2).max(32).optional(),
  /** Optional hint about the payment method. */
  payment_method: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/)
    .optional(),
});

export type OcrReceiptStrukInput = z.infer<typeof OcrReceiptStrukInputSchema>;

interface ExtractedReceipt {
  sales_date: string;
  channel: string;
  payment_method: string;
  gross_sales: string;
  discount_total?: string;
  transaction_count?: number;
  notes?: string;
}

function absolutizeAttachmentUrl(url: string): string {
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base =
    process.env.NEXT_PUBLIC_WEB_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

function extractFirstJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

const ExtractedSchema = z.object({
  sales_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.string().min(2).max(32).default('walk_in'),
  payment_method: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/)
    .default('cash'),
  gross_sales: z.string().regex(/^\d+$/),
  discount_total: z.string().regex(/^\d+$/).optional(),
  transaction_count: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export interface OcrReceiptStrukOutput {
  ok: boolean;
  error?: string;
  extracted?: ExtractedReceipt;
  draft_id?: string;
  expires_at?: string;
  summary?: string;
  requires_confirmation?: true;
}

export async function ocrReceiptStrukTool(
  input: OcrReceiptStrukInput,
  ctx: AuditContext,
  deps?: CreateManualSaleDraftToolDeps,
): Promise<OcrReceiptStrukOutput> {
  const config = loadProviderConfig();
  if (!config.apiKey) {
    return { ok: false, error: 'ai.provider.notConfigured' };
  }
  const url = absolutizeAttachmentUrl(input.attachment_url);

  const systemPrompt = [
    'You are an OCR + structured-extraction engine for a small Indonesian',
    'bubble-tea shop. The user is uploading a photo of a paper receipt',
    'printed by an OLD point-of-sale system. Read it carefully.',
    '',
    'Return ONLY a JSON object with this shape (no prose, no markdown):',
    '{',
    '  "sales_date": "YYYY-MM-DD",',
    '  "channel": "walk_in" | "gofood" | "grabfood" | "shopeefood" | "self_pickup" | "delivery",',
    '  "payment_method": "cash" | "qris" | "debit" | "credit" | "bank_transfer" | "ewallet",',
    '  "gross_sales": "<integer rupiah, no separators>",',
    '  "discount_total": "<integer rupiah, optional>",',
    '  "transaction_count": <integer, optional>,',
    '  "notes": "<short free text, optional — mention if anything was unreadable>"',
    '}',
    '',
    'Rules:',
    '- If the receipt is unreadable, return {"error":"unreadable"} and nothing else.',
    '- If the date is ambiguous, use Asia/Jakarta today.',
    "- Don't invent line items; only fill what you can see clearly.",
    '- gross_sales is the TOTAL before tax/discount, in rupiah (e.g. "320000").',
  ].join('\n');

  const messages: AiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Ekstrak isi struk berikut menjadi JSON sesuai skema.',
        },
        { type: 'image_url', image_url: { url } },
      ],
    },
  ];

  let providerResponse;
  try {
    providerResponse = await aiComplete({
      // Vision lives on the v4-pro family — flash does not accept image_url.
      model: config.reasoningModel,
      thinkingMode: true,
      messages,
    });
  } catch (e) {
    return {
      ok: false,
      error: `provider_error:${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rawJson = extractFirstJsonBlock(providerResponse.content);
  if (!rawJson) {
    return { ok: false, error: 'no_json_in_response' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'invalid_json_in_response' };
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'error' in (parsed as Record<string, unknown>) &&
    (parsed as { error?: string }).error === 'unreadable'
  ) {
    return { ok: false, error: 'receipt_unreadable' };
  }

  const validated = ExtractedSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `invalid_extracted:${validated.error.issues.map((i) => i.message).join('; ')}`,
    };
  }
  const extracted = validated.data as ExtractedReceipt;

  // Stage the extracted struk as a manual_sale draft. The model can
  // present the draft_id to the user; the UI will render the
  // ConfirmActionCard automatically.
  const draft = await createManualSaleDraftTool(
    {
      location_id: input.location_id,
      sales_date: extracted.sales_date,
      channel: input.channel ?? extracted.channel,
      payment_method: input.payment_method ?? extracted.payment_method,
      gross_sales: extracted.gross_sales,
      discount_total: extracted.discount_total ?? '0',
      transaction_count: extracted.transaction_count ?? 0,
      source_reference: `ocr:${input.attachment_url}`,
      notes: extracted.notes,
    },
    ctx,
    deps,
  );

  return {
    ok: true,
    extracted,
    draft_id: draft.draft_id,
    expires_at: draft.expires_at,
    summary: draft.summary,
    requires_confirmation: true,
  };
}
