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
 *
 * The tool returns a discriminated union ({ok:true,...} vs
 * {ok:false,error,...}) instead of throwing, so the model can pick up
 * actionable hints (e.g. `outlet_hint`, `location_candidates`) and
 * recover with a single follow-up tool call.
 */

import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { createDraft } from '../drafts';
import { type LocationCandidate, findLocationCandidates } from './resolve-location';

const DisplayLineItemSchema = z.object({
  name: z.string().min(1).max(200),
  qty: z.number().positive().max(999),
  amount: z.string().regex(/^\d+$/),
});

/**
 * Real sale-line shape that gets passed straight into
 * createManualSalesClosing → deductIngredients (BOM auto-deduct).
 * Mirrors CreateManualSalesClosingInputSchema.lineItems.
 */
const SaleLineItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  qty: z.number().positive().max(999),
  /** Per-unit price as integer rupiah string. */
  price: z.string().regex(/^\d+$/),
  /** Line total as integer rupiah string. */
  total: z.string().regex(/^\d+$/),
  /** Optional badges surfaced in ConfirmActionCard summary. */
  matched_product_sku: z.string().optional(),
  matched_product_name: z.string().optional(),
  matched_variant_name: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
});

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
  /** Resolved sale lines that get persisted into the manual_sales row.
   *  Each line carries productId (+ optional variantId) so the commit
   *  path runs deductIngredients(BOM) for the right product/variant. */
  line_items: z.array(SaleLineItemSchema).max(50).optional(),
  /** Display-only rows for items the OCR could NOT confidently match
   *  to a product. Rendered in the ConfirmActionCard with a warning so
   *  the cashier knows BOM was not deducted for these. */
  display_line_items: z.array(DisplayLineItemSchema).max(50).optional(),
  /** Outlet name as printed on the receipt header; surfaced in the
   *  confirmation summary so the cashier sees "is this the right
   *  outlet?" at a glance. */
  outlet_hint: z.string().min(1).max(200).optional(),
});

export type CreateManualSaleDraftInput = z.infer<typeof CreateManualSaleDraftInputSchema>;

interface DraftSuccess {
  ok: true;
  draft_id: string;
  expires_at: string;
  summary: string;
  requires_confirmation: true;
  payload: Record<string, unknown>;
}

interface DraftError {
  ok: false;
  error: 'location_required' | 'location_ambiguous';
  summary: string;
  outlet_hint?: string;
  location_candidates?: Array<{ id: string; code: string; name: Record<string, unknown> }>;
}

export type CreateManualSaleDraftOutput = DraftSuccess | DraftError;

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

function looksLikeLocationId(value: string): boolean {
  return ULID_RE.test(value) || /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

function summariseCandidate(c: LocationCandidate): {
  id: string;
  code: string;
  name: Record<string, unknown>;
} {
  return { id: c.id, code: c.code, name: c.name };
}

export interface CreateManualSaleDraftToolDeps {
  sessionId?: string;
  messageId?: string;
}

export async function createManualSaleDraftTool(
  input: CreateManualSaleDraftInput,
  ctx: AuditContext,
  deps?: CreateManualSaleDraftToolDeps,
): Promise<CreateManualSaleDraftOutput> {
  let locationId = input.location_id?.trim() || ctx.locationId?.trim() || '';

  // If the model passed an outlet name in `location_id` (e.g. "Plaza
  // Malioboro") instead of an ID, try to resolve it. Belt-and-braces —
  // the model is supposed to call resolve_location first.
  if (locationId && !looksLikeLocationId(locationId)) {
    const candidates = await findLocationCandidates(locationId, ctx, 5);
    const only = candidates.length === 1 ? candidates[0] : undefined;
    if (only) {
      locationId = only.id;
    } else {
      return {
        ok: false,
        error: 'location_ambiguous',
        summary: `Outlet "${input.location_id}" cocok ${candidates.length} kandidat. Panggil resolve_location atau minta user pilih satu, lalu panggil create_manual_sale_draft lagi dengan location_id resmi.`,
        outlet_hint: input.outlet_hint ?? input.location_id ?? undefined,
        location_candidates: candidates.map(summariseCandidate),
      };
    }
  }

  if (!locationId) {
    let candidates: LocationCandidate[] = [];
    if (input.outlet_hint) {
      candidates = await findLocationCandidates(input.outlet_hint, ctx, 5);
      const only = candidates.length === 1 ? candidates[0] : undefined;
      if (only) {
        locationId = only.id;
      }
    }
    if (!locationId) {
      return {
        ok: false,
        error: 'location_required',
        summary: input.outlet_hint
          ? `Outlet "${input.outlet_hint}" tidak cocok dengan outlet manapun di sistem. Panggil resolve_location dengan query lebih pendek atau tanyakan ke user, lalu panggil ulang create_manual_sale_draft dengan location_id resmi.`
          : 'Outlet belum diketahui. Tanyakan ke user outlet mana, atau panggil resolve_location, lalu panggil ulang create_manual_sale_draft dengan location_id resmi.',
        outlet_hint: input.outlet_hint,
        location_candidates: candidates.length > 0 ? candidates.map(summariseCandidate) : undefined,
      };
    }
  }
  const idempotencyKey = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Map to the camelCase shape CreateManualSalesClosingInputSchema
  // expects. The schema's `lineItems` requires productId/qty/price/total
  // — extra metadata (matched_*, confidence) gets stripped at commit
  // time but is preserved on the draft payload for audit.
  const lineItems = (input.line_items ?? []).map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    qty: item.qty,
    price: item.price,
    total: item.total,
  }));

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
    // Real sale lines — consumed by createManualSalesClosing →
    // deductIngredients(BOM). Empty array = closing total only (no
    // automatic stock movement, matches the pre-AI manual entry).
    lineItems,
    // Display-only rows for items OCR couldn't match. Stripped by
    // CreateManualSalesClosingInputSchema at commit time but rendered
    // on the ConfirmActionCard so the cashier can correct manually.
    displayLineItems: input.display_line_items ?? [],
    outletHint: input.outlet_hint ?? null,
    // Match metadata for the card. Stripped at commit.
    lineItemBadges: (input.line_items ?? []).map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      matchedProductSku: item.matched_product_sku ?? null,
      matchedProductName: item.matched_product_name ?? null,
      matchedVariantName: item.matched_variant_name ?? null,
      confidence: item.confidence ?? null,
    })),
  };

  const gross = Number(input.gross_sales);
  const summaryLines = [
    `Manual sales draft untuk ${input.sales_date}`,
    input.outlet_hint
      ? `Outlet ${input.outlet_hint} (id ${locationId}) · channel ${input.channel} · ${input.payment_method}`
      : `Lokasi ${locationId} · channel ${input.channel} · ${input.payment_method}`,
    `Gross ${IDR.format(gross)}${input.discount_total && input.discount_total !== '0' ? ` (diskon ${IDR.format(Number(input.discount_total))})` : ''}`,
    `${input.transaction_count ?? 0} transaksi`,
  ];

  const resolvedCount = input.line_items?.length ?? 0;
  const unresolvedCount = input.display_line_items?.length ?? 0;
  if (resolvedCount > 0 || unresolvedCount > 0) {
    summaryLines.push(
      `Rincian: ${resolvedCount} item terhubung BOM, ${unresolvedCount} item belum bisa di-match.`,
    );
    for (const item of input.line_items ?? []) {
      const confidenceMark =
        item.confidence === 'high' ? '✓' : item.confidence === 'low' ? '⚠' : '·';
      const matchedSuffix = item.matched_product_name
        ? ` → ${item.matched_product_sku ?? '?'} ${item.matched_product_name}${item.matched_variant_name ? ` (${item.matched_variant_name})` : ''}`
        : '';
      summaryLines.push(
        `${confidenceMark} ${item.name} × ${item.qty} — ${IDR.format(Number(item.total))}${matchedSuffix}`,
      );
    }
    for (const item of input.display_line_items ?? []) {
      summaryLines.push(
        `⚠ ${item.name} × ${item.qty} — ${IDR.format(Number(item.amount))} (belum match, stok TIDAK dikurangi)`,
      );
    }
  }

  if (input.notes) {
    summaryLines.push(`Catatan: ${input.notes.slice(0, 120)}`);
  }

  const summary = summaryLines.filter(Boolean).join('\n');

  const { id, expiresAt } = await createDraft({
    sessionId: deps?.sessionId ?? 'ad-hoc',
    messageId: deps?.messageId,
    kind: 'manual_sale',
    summary,
    payload,
    ctx,
  });

  return {
    ok: true,
    draft_id: id,
    expires_at: expiresAt.toISOString(),
    summary,
    requires_confirmation: true,
    payload,
  };
}
