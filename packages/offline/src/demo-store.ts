/**
 * @erp/offline — Demo Mode Store (in-memory reactive state)
 *
 * SD §34, ADR-0008.
 *
 * This module provides:
 * 1. In-memory state for the demo cart (product lines, payments)
 * 2. Demo order history (in-memory list of completed demo orders)
 * 3. Helper to compute totals (PB1 inclusive, same as production)
 *
 * All state is in-memory only — never persisted to IndexedDB (orders are ephemeral).
 * Master data (products, variants, modifiers, tax_rates) IS in IndexedDB (snapshot).
 */

import type { DbModifier, DbProduct, DbTaxRate, DbVariant } from './indexeddb';

// ─── Cart types ───────────────────────────────────────────────────────────────

export interface DemoCartLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  qty: number;
  unitPrice: string; // bigint string
  modifierJson?: Record<string, unknown>;
  notes?: string;
  lineDiscount?: string;
  lineDiscountReason?: string;
}

export interface DemoCartPayment {
  id: string;
  method: string;
  amount: string;
  reference?: string;
  donationAmount?: string;
  roundingOption?: string;
}

/** Customer attached to the demo order. Demo never queries the real
 * member API (would leak demo activity into production member records);
 * the cashier instead enters details manually in the demo sandbox. */
export interface DemoCartCustomer {
  name: string;
  phone?: string;
  loyaltyTier?: string;
  points?: number;
}

export interface DemoCartState {
  // `walk_in` retained as legacy alias — production POS migrated to
  // `dine_in` / `take_away`. Stored demo carts from older sessions might
  // still hold the old value.
  channel:
    | 'dine_in'
    | 'take_away'
    | 'walk_in'
    | 'gofood'
    | 'grabfood'
    | 'shopeefood';
  lines: DemoCartLine[];
  payments: DemoCartPayment[];
  notes: string;
  /** Attached member info (manual entry in demo). Cleared on payment. */
  customer?: DemoCartCustomer | null;
  /** "Atas nama" (a/n) guest name — printed on the receipt header even
   * when no member is attached. */
  guestName?: string;
}

export interface DemoOrder {
  orderNumber: string;
  channel: DemoCartState['channel'];
  lines: DemoCartLine[];
  payments: DemoCartPayment[];
  grandTotal: string;
  taxTotal: string;
  subtotal: string;
  notes: string;
  placedAt: string;
  /** Captured at payment time so the receipt + history reflect the
   * customer/guest the cashier attached. */
  customer?: DemoCartCustomer | null;
  guestName?: string;
}

// ─── Derived totals ───────────────────────────────────────────────────────────

export function calcDemoTotals(state: DemoCartState): {
  subtotal: bigint;
  taxTotal: bigint;
  totalDiscount: bigint;
  grandTotal: bigint;
  totalPaid: bigint;
  remainingBalance: bigint;
  excess: bigint;
} {
  const subtotal = state.lines.reduce(
    (sum, l) => sum + BigInt(l.unitPrice) * BigInt(l.qty),
    BigInt(0),
  );
  const totalDiscount = state.lines.reduce((sum, l) => sum + BigInt(l.lineDiscount ?? '0'), BigInt(0));
  const subtotalAfterDiscount = subtotal - totalDiscount;
  // PB1 is inclusive — back-out tax: tax = subtotal * 10 / 110
  const taxTotal = (subtotalAfterDiscount * BigInt(10)) / BigInt(110);
  const grandTotal = subtotalAfterDiscount;
  const totalPaid = state.payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
  const remainingBalance = grandTotal - totalPaid > BigInt(0) ? grandTotal - totalPaid : BigInt(0);
  const excess = totalPaid - grandTotal > BigInt(0) ? totalPaid - grandTotal : BigInt(0);

  return { subtotal, taxTotal, totalDiscount, grandTotal, totalPaid, remainingBalance, excess };
}

// ─── Default empty state ───────────────────────────────────────────────────────

export const DEMO_CART_DEFAULT: DemoCartState = {
  channel: 'walk_in',
  lines: [],
  payments: [],
  notes: '',
};
