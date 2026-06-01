/**
 * Purchase returns — Server Actions (T-0180).
 */

'use server';

import { getSession } from '@/lib/auth';
import { and, db, eq, inArray } from '@erp/db';
import { goodsReceiptNotes, grnLines, purchaseOrderLines } from '@erp/db/schema/purchasing';
import {
  type CreatePurchaseReturnInput,
  type PurchaseReturnDetail,
  type PurchaseReturnSummary,
  approvePurchaseReturn,
  cancelPurchaseReturn,
  createPurchaseReturn,
  getPurchaseReturn,
  listPurchaseReturns,
  postPurchaseReturn,
  submitPurchaseReturn,
} from '@erp/services/purchasing';
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

export async function fetchPurchaseReturnsAction(filter: {
  locationId?: string;
  status?: string;
}): Promise<{ data?: PurchaseReturnSummary[]; error?: string }> {
  const ctx = await buildCtx();
  const result = await listPurchaseReturns(filter, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function fetchPurchaseReturnAction(
  returnId: string,
): Promise<{ data?: PurchaseReturnDetail; error?: string }> {
  const ctx = await buildCtx();
  const result = await getPurchaseReturn(returnId, ctx);
  if (!result.ok) return { error: result.error.message };
  return { data: result.value };
}

export async function createPurchaseReturnAction(
  input: CreatePurchaseReturnInput,
): Promise<{ id?: string; error?: string }> {
  const ctx = await buildCtx();
  const result = await createPurchaseReturn(input, ctx);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/purchasing/returns');
  return { id: result.value.id };
}

export async function submitPurchaseReturnAction(
  returnId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const result = await submitPurchaseReturn({ returnId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath('/purchasing/returns');
  revalidatePath(`/purchasing/returns/${returnId}`);
  return { ok: true };
}

export async function approvePurchaseReturnAction(
  returnId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const result = await approvePurchaseReturn({ returnId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath('/purchasing/returns');
  revalidatePath(`/purchasing/returns/${returnId}`);
  return { ok: true };
}

export async function postPurchaseReturnAction(
  returnId: string,
): Promise<{ ok: boolean; error?: string; journalEntryId?: string | null }> {
  const ctx = await buildCtx();
  const result = await postPurchaseReturn({ returnId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath('/purchasing/returns');
  revalidatePath(`/purchasing/returns/${returnId}`);
  return { ok: true, journalEntryId: result.value.journalEntryId };
}

export async function cancelPurchaseReturnAction(
  returnId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await buildCtx();
  const result = await cancelPurchaseReturn({ returnId }, ctx);
  if (!result.ok) return { ok: false, error: result.error.message };
  revalidatePath('/purchasing/returns');
  revalidatePath(`/purchasing/returns/${returnId}`);
  return { ok: true };
}

/**
 * Load the GRN header + lines (joined with PO line cost) so the
 * new-return form can render a pickable list. Tenant-scoped lookup
 * by GRN id; we don't need to gate this behind a separate permission
 * because the user already needs `purchasing.return.create` to
 * submit, and the lookup itself doesn't leak across tenants.
 */
export async function fetchGrnForReturnAction(grnId: string): Promise<{
  grn?: {
    id: string;
    number: string;
    locationId: string;
    purchaseOrderId: string;
    receivedDate: string;
    status: string;
  };
  supplierId?: string;
  lines?: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    qtyReceived: string;
    uom: string;
    unitCost: string;
  }>;
  error?: string;
}> {
  const ctx = await buildCtx();
  if (!grnId) return { error: 'invalid_input' };
  const [g] = await db
    .select()
    .from(goodsReceiptNotes)
    .where(and(eq(goodsReceiptNotes.tenantId, ctx.tenantId), eq(goodsReceiptNotes.id, grnId)))
    .limit(1);
  if (!g) return { error: 'grn_not_found' };
  if (g.status !== 'confirmed') return { error: 'grn_not_confirmed' };

  const lines = await db
    .select({
      id: grnLines.id,
      productId: grnLines.productId,
      variantId: grnLines.variantId,
      qtyReceived: grnLines.qtyReceived,
      uom: grnLines.uom,
      poLineId: grnLines.poLineId,
    })
    .from(grnLines)
    .where(eq(grnLines.grnId, g.id));

  // Need the PO line cost so we can preset unit_cost on the return.
  const poLineIds = lines.map((l) => l.poLineId);
  const poLineRows = poLineIds.length
    ? await db
        .select({ id: purchaseOrderLines.id, unitPrice: purchaseOrderLines.unitPrice })
        .from(purchaseOrderLines)
        .where(inArray(purchaseOrderLines.id, poLineIds))
    : [];
  const costMap = new Map(poLineRows.map((r) => [r.id, r.unitPrice]));

  // Derive supplier from the PO (one extra small query).
  const { purchaseOrders } = await import('@erp/db/schema/purchasing');
  const [po] = await db
    .select({ supplierId: purchaseOrders.supplierId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, g.purchaseOrderId))
    .limit(1);

  return {
    grn: {
      id: g.id,
      number: g.number,
      locationId: g.locationId,
      purchaseOrderId: g.purchaseOrderId,
      receivedDate: g.receivedDate,
      status: g.status,
    },
    supplierId: po?.supplierId ?? '',
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      qtyReceived: l.qtyReceived,
      uom: l.uom,
      unitCost: (costMap.get(l.poLineId) ?? 0n).toString(),
    })),
  };
}
