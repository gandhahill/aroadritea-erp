/**
 * POS order history server actions.
 *
 * Lists today's orders for the cashier's current location and proxies
 * the existing voidSale / refundSale services. Permission gates remain
 * inside the services — these wrappers only resolve the session-scoped
 * audit context and re-validate after writes.
 */

'use server';

import { getSession } from '@/lib/auth';
import { pickLocalized } from '@/lib/pick-localized';
import { and, db, desc, eq, gte, inArray, lte } from '@erp/db';
import { users } from '@erp/db/schema/auth';
import { products } from '@erp/db/schema/inventory';
import { payments, salesOrderLines, salesOrders } from '@erp/db/schema/pos';
import { refundSale, voidSale } from '@erp/services/pos';
import type { AuditContext } from '@erp/shared/types';
import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';

export interface OrderListRow {
  id: string;
  number: string;
  status: string;
  channel: string;
  grandTotal: string;
  subtotal: string;
  taxTotal: string;
  placedAt: string;
  version: number;
  cashierName: string;
  paymentMethods: string[];
}

export interface OrderDetail extends OrderListRow {
  notes: string | null;
  discountTotal: string;
  lines: Array<{
    id: string;
    lineNo: number;
    productName: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  paymentRows: Array<{
    id: string;
    method: string;
    amount: string;
    reference: string | null;
  }>;
}

async function resolveCtx(): Promise<{ ctx: AuditContext; locationId: string } | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  const locationId = String(user.locationId ?? '');
  if (!locationId) return null;
  return {
    locationId,
    ctx: {
      userId: String(user.id ?? ''),
      tenantId: String(user.tenantId ?? 'default'),
      locationId,
    },
  };
}

/** WIB-aware day window for `date` (YYYY-MM-DD). */
function dayWindowJakarta(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function fetchTodaysOrders(date?: string): Promise<{
  ok: boolean;
  rows: OrderListRow[];
  locationId: string | null;
  error?: string;
}> {
  const session = await resolveCtx();
  if (!session) return { ok: false, rows: [], locationId: null, error: 'Unauthenticated' };
  const { ctx, locationId } = session;

  const targetDate = date ?? new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const { start, end } = dayWindowJakarta(targetDate);

  const orderRows = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      channel: salesOrders.channel,
      grandTotal: salesOrders.grandTotal,
      subtotal: salesOrders.subtotal,
      taxTotal: salesOrders.taxTotal,
      placedAt: salesOrders.placedAt,
      version: salesOrders.version,
      cashierId: salesOrders.cashierId,
      cashierName: users.displayName,
    })
    .from(salesOrders)
    .leftJoin(
      users,
      and(eq(users.id, salesOrders.cashierId), eq(users.tenantId, ctx.tenantId)),
    )
    .where(
      and(
        eq(salesOrders.tenantId, ctx.tenantId),
        eq(salesOrders.locationId, locationId),
        gte(salesOrders.placedAt, start),
        lte(salesOrders.placedAt, end),
      ),
    )
    .orderBy(desc(salesOrders.placedAt))
    .limit(200);

  const ids = orderRows.map((r) => r.id);
  // payments has no tenant_id column (it inherits scope from the parent
  // sales_orders row); filter by the order IDs we just selected so a
  // tenant boundary is still preserved.
  const paymentRows =
    ids.length > 0
      ? await db
          .select({ salesOrderId: payments.salesOrderId, method: payments.method })
          .from(payments)
          .where(inArray(payments.salesOrderId, ids))
      : [];
  const paymentByOrder = new Map<string, string[]>();
  for (const p of paymentRows) {
    const list = paymentByOrder.get(p.salesOrderId) ?? [];
    if (!list.includes(p.method)) list.push(p.method);
    paymentByOrder.set(p.salesOrderId, list);
  }

  return {
    ok: true,
    locationId,
    rows: orderRows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      channel: r.channel,
      grandTotal: r.grandTotal.toString(),
      subtotal: r.subtotal.toString(),
      taxTotal: r.taxTotal.toString(),
      placedAt: r.placedAt.toISOString(),
      version: r.version,
      cashierName: r.cashierName ?? '—',
      paymentMethods: paymentByOrder.get(r.id) ?? [],
    })),
  };
}

export async function fetchOrderDetail(orderId: string): Promise<{
  ok: boolean;
  detail?: OrderDetail;
  error?: string;
}> {
  const session = await resolveCtx();
  if (!session) return { ok: false, error: 'Unauthenticated' };
  const { ctx, locationId } = session;
  const locale = await getLocale();

  const [row] = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      channel: salesOrders.channel,
      grandTotal: salesOrders.grandTotal,
      subtotal: salesOrders.subtotal,
      taxTotal: salesOrders.taxTotal,
      discountTotal: salesOrders.discountTotal,
      placedAt: salesOrders.placedAt,
      version: salesOrders.version,
      notes: salesOrders.notes,
      cashierId: salesOrders.cashierId,
      cashierName: users.displayName,
    })
    .from(salesOrders)
    .leftJoin(
      users,
      and(eq(users.id, salesOrders.cashierId), eq(users.tenantId, ctx.tenantId)),
    )
    .where(
      and(
        eq(salesOrders.tenantId, ctx.tenantId),
        eq(salesOrders.locationId, locationId),
        eq(salesOrders.id, orderId),
      ),
    )
    .limit(1);

  if (!row) return { ok: false, error: 'not_found' };

  const [lineRows, paymentRows] = await Promise.all([
    db
      .select({
        id: salesOrderLines.id,
        lineNo: salesOrderLines.lineNo,
        qty: salesOrderLines.qty,
        unitPrice: salesOrderLines.unitPrice,
        lineTotal: salesOrderLines.lineTotal,
        productId: salesOrderLines.productId,
        productName: products.name,
      })
      .from(salesOrderLines)
      .leftJoin(products, eq(products.id, salesOrderLines.productId))
      .where(eq(salesOrderLines.salesOrderId, orderId)),
    db
      .select({
        id: payments.id,
        method: payments.method,
        amount: payments.amount,
        reference: payments.reference,
      })
      .from(payments)
      .where(eq(payments.salesOrderId, orderId)),
  ]);

  return {
    ok: true,
    detail: {
      id: row.id,
      number: row.number,
      status: row.status,
      channel: row.channel,
      grandTotal: row.grandTotal.toString(),
      subtotal: row.subtotal.toString(),
      taxTotal: row.taxTotal.toString(),
      discountTotal: row.discountTotal.toString(),
      placedAt: row.placedAt.toISOString(),
      version: row.version,
      notes: row.notes,
      cashierName: row.cashierName ?? '—',
      paymentMethods: paymentRows.map((p) => p.method),
      lines: lineRows.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        productName: pickLocalized(l.productName, locale, l.productId),
        qty: l.qty,
        unitPrice: l.unitPrice.toString(),
        lineTotal: l.lineTotal.toString(),
      })),
      paymentRows: paymentRows.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount.toString(),
        reference: p.reference ?? null,
      })),
    },
  };
}

export async function voidOrderAction(input: {
  orderId: string;
  reason: string;
  version: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await resolveCtx();
  if (!session) return { ok: false, error: 'Unauthenticated' };

  const result = await voidSale(
    { salesOrderId: input.orderId, reason: input.reason, version: input.version },
    session.ctx,
  );
  if (!result.ok) {
    return { ok: false, error: result.error.messageKey };
  }
  revalidatePath('/pos/orders');
  return { ok: true };
}

export async function refundOrderAction(input: {
  orderId: string;
  reason: string;
  version: number;
  /**
   * Per-line refund qty captured from the UI for the cashier's
   * confirmation. The underlying refundSale service currently refunds
   * the whole order (RefundSaleInputSchema), so we don't forward
   * `lines` to it — but we keep the field in the action signature so
   * future partial-refund support doesn't require a UI rewrite, and we
   * fold the selection into the audit reason so the rationale is
   * preserved.
   */
  lines?: Array<{ lineId: string; qty: number }>;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await resolveCtx();
  if (!session) return { ok: false, error: 'Unauthenticated' };

  const lineSummary = (input.lines ?? [])
    .filter((l) => l.qty > 0)
    .map((l) => `${l.lineId}:${l.qty}`)
    .join(',');
  const reasonWithLines = lineSummary
    ? `${input.reason} | refundLines=${lineSummary}`
    : input.reason;

  const result = await refundSale(
    {
      salesOrderId: input.orderId,
      reason: reasonWithLines.slice(0, 255),
      version: input.version,
    },
    session.ctx,
  );
  if (!result.ok) {
    return { ok: false, error: result.error.messageKey };
  }
  revalidatePath('/pos/orders');
  return { ok: true };
}
