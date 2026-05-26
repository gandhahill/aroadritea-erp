/**
 * Tool: get_recent_orders — T-0171 (Phase 2).
 *
 * Returns the most recent sales orders for a single outlet so the
 * assistant can answer cashier reconciliation questions
 * ("berapa transaksi terakhir saya?", "ada void terakhir tidak?").
 *
 * The query is **always** scoped by `tenant_id` (from session) and
 * `location_id` (from input or session). The conversation runner
 * separately checks the `reporting.view` permission before invoking.
 */

import { and, db, desc, eq, gte } from '@erp/db';
import { payments, salesOrders } from '@erp/db/schema/pos';
import type { AuditContext } from '@erp/shared/types';
import { z } from 'zod';
import { resolveLocationRef } from './resolve-location';

export const GetRecentOrdersInputSchema = z.object({
  location_id: z.string().min(1).max(64).optional(),
  location: z.string().min(1).max(120).optional(),
  limit: z.number().int().min(1).max(25).optional(),
  since_minutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 7)
    .optional(),
});

export type GetRecentOrdersInput = z.infer<typeof GetRecentOrdersInputSchema>;

export interface GetRecentOrdersOutput {
  location_id: string;
  total_returned: number;
  cap: number;
  orders: Array<{
    order_id: string;
    number: string;
    status: string;
    channel: string;
    placed_at: string;
    subtotal: string;
    tax_total: string;
    grand_total: string;
    payment_methods: string[];
  }>;
}

const DEFAULT_LIMIT = 10;

export async function getRecentOrdersTool(
  input: GetRecentOrdersInput,
  ctx: AuditContext,
): Promise<GetRecentOrdersOutput> {
  const location = await resolveLocationRef(input.location_id ?? input.location, ctx);
  if (!location) {
    return {
      location_id: '',
      total_returned: 0,
      cap: input.limit ?? DEFAULT_LIMIT,
      orders: [],
    };
  }

  const limit = input.limit ?? DEFAULT_LIMIT;
  const conditions = [
    eq(salesOrders.tenantId, ctx.tenantId),
    eq(salesOrders.locationId, location.id),
  ];
  if (input.since_minutes) {
    const cutoff = new Date(Date.now() - input.since_minutes * 60 * 1000);
    conditions.push(gte(salesOrders.placedAt, cutoff));
  }

  const rows = await db
    .select({
      id: salesOrders.id,
      number: salesOrders.number,
      status: salesOrders.status,
      channel: salesOrders.channel,
      placedAt: salesOrders.placedAt,
      subtotal: salesOrders.subtotal,
      taxTotal: salesOrders.taxTotal,
      grandTotal: salesOrders.grandTotal,
    })
    .from(salesOrders)
    .where(and(...conditions))
    .orderBy(desc(salesOrders.placedAt))
    .limit(limit);

  const orderIds = rows.map((r) => r.id);
  const paymentRows = orderIds.length
    ? await db.select({ orderId: payments.salesOrderId, method: payments.method }).from(payments)
    : [];
  const paymentByOrder = new Map<string, Set<string>>();
  for (const p of paymentRows) {
    if (!orderIds.includes(p.orderId)) continue;
    const set = paymentByOrder.get(p.orderId) ?? new Set<string>();
    set.add(p.method);
    paymentByOrder.set(p.orderId, set);
  }

  return {
    location_id: location.id,
    total_returned: rows.length,
    cap: limit,
    orders: rows.map((r) => ({
      order_id: r.id,
      number: r.number,
      status: r.status,
      channel: r.channel,
      placed_at: r.placedAt.toISOString(),
      subtotal: r.subtotal.toString(),
      tax_total: r.taxTotal.toString(),
      grand_total: r.grandTotal.toString(),
      payment_methods: Array.from(paymentByOrder.get(r.id) ?? []),
    })),
  };
}
