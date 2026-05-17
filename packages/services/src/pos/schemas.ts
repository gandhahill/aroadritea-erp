/**
 * POS Zod schemas — SD §9.5, §21.4
 *
 * Channels and payment methods are configurable tokens.
 * Built-ins include walk_in, gofood, grabfood, and shopeefood.
 */

import { z } from 'zod';
// (Channel and Shift schemas — no locale needed here)

// ─── Channel ───────────────────────────────────────────────────────────────────

export const ChannelSchema = z.string().regex(/^[a-z0-9_-]{2,32}$/);
export type Channel = z.infer<typeof ChannelSchema>;

// ─── Shift ────────────────────────────────────────────────────────────────────

export const OpenShiftInputSchema = z.object({
  locationId: z.string().min(1),
  openingCash: z.string().regex(/^\d+$/, 'Must be non-negative integer string'),
});

export type OpenShiftInput = z.infer<typeof OpenShiftInputSchema>;

export const CloseShiftInputSchema = z.object({
  shiftId: z.string().min(1),
  actualCash: z.string().regex(/^\d+$/, 'Must be non-negative integer string'),
  version: z.number().int().min(1),
});

export type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;

// ─── Sales Order ──────────────────────────────────────────────────────────────

const LineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  qty: z.number().int().positive(),
  unitPrice: z.string().regex(/^\d+$/), // bigint rupiah (inclusive PB1)
  lineDiscount: z.string().regex(/^\d+$/).optional().default('0'),
  modifierJson: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

const PaymentInputSchema = z.object({
  method: z.string().regex(/^[a-z0-9_-]{2,32}$/),
  amount: z.string().regex(/^\d+$/), // bigint rupiah
  reference: z.string().optional(),
  /** SD §25.11 — donation amount (donated instead of given as change). */
  donationAmount: z.string().regex(/^\d+$/).optional(),
  /** SD §25.11 — 'donate' | 'round_up' | 'no_donation' */
  roundingOption: z.enum(['donate', 'round_up', 'no_donation']).optional(),
});

export const RoundingOptionSchema = z.enum(['donate', 'round_up', 'no_donation']);
export type RoundingOption = z.infer<typeof RoundingOptionSchema>;

export const CreateSaleInputSchema = z.object({
  shiftId: z.string().min(1),
  channel: ChannelSchema,
  locationId: z.string().min(1),
  customerId: z.string().optional(),
  idempotencyKey: z.string().min(1).max(64),

  lines: z.array(LineInputSchema).min(1, 'At least one line item is required'),
  payments: z.array(PaymentInputSchema).min(1, 'At least one payment is required'),

  notes: z.string().optional(),
});

export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;

export type LineInput = z.infer<typeof LineInputSchema>;
export type PaymentInput = z.infer<typeof PaymentInputSchema>;

// ─── Void (cancel before payment) ────────────────────────────────────────────

export const VoidSaleInputSchema = z.object({
  salesOrderId: z.string().min(1),
  reason: z.string().min(1).max(255),
  version: z.number().int().min(1),
});

export type VoidSaleInput = z.infer<typeof VoidSaleInputSchema>;

// ─── Refund ────────────────────────────────────────────────────────────────────

const RefundLineSchema = z.object({
  lineId: z.string().min(1),
  qty: z.number().int().positive(),
});

export const RefundSaleInputSchema = z.object({
  salesOrderId: z.string().min(1),
  reason: z.string().min(1).max(255),
  version: z.number().int().min(1),
  lines: z.array(RefundLineSchema).min(1),
});

export type RefundSaleInput = z.infer<typeof RefundSaleInputSchema>;
export type RefundLineInput = z.infer<typeof RefundLineSchema>;

// ─── Shift status enum ────────────────────────────────────────────────────────

export const ShiftStatusSchema = z.enum(['open', 'closed']);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

// ─── Return types ──────────────────────────────────────────────────────────────

export interface SaleResult {
  id: string;
  number: string;
  status: string;
  channel: Channel;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  lines: SaleLineResult[];
  payments: PaymentResult[];
  journalEntryId: string | null;
}

export interface SaleLineResult {
  id: string;
  lineNo: number;
  productId: string;
  variantId: string | null;
  qty: string;
  unitPrice: string;
  lineSubtotal: string;
  lineDiscount: string;
  lineTax: string;
  lineTotal: string;
  modifierJson: unknown | null;
  notes: string | null;
}

export interface PaymentResult {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  donationAmount: string | null; // SD §25.11
  roundingOption: string | null; // SD §25.11
}

export interface ShiftResult {
  id: string;
  locationId: string;
  status: string;
  openingCash: string;
  openedBy: string;
  openedAt: string;
  expectedCash: string | null;
  actualCash: string | null;
  variance: string | null;
  closedBy: string | null;
  closedAt: string | null;
}
