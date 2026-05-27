import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { createDraft } from '../drafts';
import { resolveOcrLineItems, type ResolvedLineItem } from './resolve-line-items';
import { type LocationCandidate, findLocationCandidates } from './resolve-location';
import { db, and, eq } from '@erp/db';
import { stockLevels } from '@erp/db/schema/inventory';

export const CreateStockAdjustmentDraftInputSchema = z.object({
  location_id: z.string().min(1).max(64).optional(),
  adjustment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(['waste', 'damage', 'count_correction', 'other']),
  notes: z.string().max(1000).optional(),
  outlet_hint: z.string().min(1).max(200).optional(),
  raw_line_items: z.array(z.object({
    name: z.string().min(1).max(200),
    qty_delta: z.number(),
  })).min(1),
});

export type CreateStockAdjustmentDraftInput = z.infer<typeof CreateStockAdjustmentDraftInputSchema>;

export async function createStockAdjustmentDraftTool(
  input: CreateStockAdjustmentDraftInput,
  ctx: AuditContext,
  deps?: { sessionId?: string; messageId?: string }
) {
  let locationId = input.location_id?.trim() || ctx.locationId?.trim() || '';

  if (locationId && !(/^[A-Za-z0-9_-]{16,64}$/.test(locationId))) {
    const candidates = await findLocationCandidates(locationId, ctx, 5);
    const only = candidates.length === 1 ? candidates[0] : undefined;
    if (only) locationId = only.id;
    else {
      return {
        ok: false,
        error: 'location_ambiguous',
        summary: `Outlet "${input.location_id}" ambiguous.`,
        location_candidates: candidates,
      };
    }
  }

  if (!locationId) {
    return {
      ok: false,
      error: 'location_required',
      summary: 'Outlet belum diketahui. Tanyakan outlet atau panggil resolve_location.',
    };
  }

  // Use resolveOcrLineItems to match products
  const toResolve = input.raw_line_items.map(item => ({
    name: item.name,
    qty: Math.abs(item.qty_delta),
    amount: '0',
  }));

  const resolvedItems = await resolveOcrLineItems(toResolve, ctx);
  
  const lines = [];
  const displayUnresolved = [];

  for (let i = 0; i < input.raw_line_items.length; i++) {
    const raw = input.raw_line_items[i];
    if (!raw) continue;
    const resolved = resolvedItems[i];
    
    if (resolved?.resolved) {
      // Find current stock
      const variantCondition = resolved.variantId
        ? eq(stockLevels.variantId, resolved.variantId)
        : eq(stockLevels.variantId, '' as any);
        
      const level = await db.select().from(stockLevels).where(
        and(
          eq(stockLevels.tenantId, ctx.tenantId),
          eq(stockLevels.locationId, locationId),
          eq(stockLevels.productId, resolved.productId),
          variantCondition
        )
      ).then(r => r[0]);

      const qtyBefore = level ? parseFloat(level.qtyOnHand) : 0;
      const qtyAfter = qtyBefore + raw.qty_delta;

      lines.push({
        productId: resolved.productId,
        variantId: resolved.variantId,
        qtyBefore: qtyBefore.toString(),
        qtyAfter: qtyAfter.toString(),
        qtyDelta: raw.qty_delta.toString(),
        uom: level ? level.uom : 'pcs',
        notes: `${raw.name} (${resolved.confidence} match)`
      });
    } else {
      displayUnresolved.push({ name: raw.name, qty_delta: raw.qty_delta });
    }
  }

  if (lines.length === 0) {
    return {
      ok: false,
      error: 'no_lines_resolved',
      summary: 'Tidak ada item yang berhasil dicocokkan dengan master produk.',
      unresolved: displayUnresolved,
    };
  }

  const payload = {
    locationId,
    adjustmentDate: input.adjustment_date,
    reason: input.reason,
    notes: input.notes,
    lines,
    displayUnresolved,
  };

  const summaryLines = [
    `Stock adjustment draft untuk ${input.adjustment_date}`,
    `Outlet ${locationId} · Alasan: ${input.reason}`,
    `Berhasil mencocokkan ${lines.length} item.`
  ];
  if (displayUnresolved.length > 0) {
    summaryLines.push(`⚠ ${displayUnresolved.length} item gagal dicocokkan.`);
  }

  const summary = summaryLines.join('\n');

  const { id, expiresAt } = await createDraft({
    sessionId: deps?.sessionId ?? 'ad-hoc',
    messageId: deps?.messageId,
    kind: 'stock_adjustment',
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
