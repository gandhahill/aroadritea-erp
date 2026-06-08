/**
 * purchasing/schemas.ts — Zod input schemas for purchasing services (SD §21.6)
 */

import { z } from 'zod';

// ─── Common ─────────────────────────────────────────────────────────────────────

export const POLineInputSchema = z.object({
  productId: z.string().min(1, 'product is required'),
  variantId: z.string().optional(),
  qtyOrdered: z.string().regex(/^\d+(\.\d{1,3})?$/, 'qty must be positive decimal').refine((v) => Number.parseFloat(v) > 0, { message: 'qty must be > 0' }),
  uom: z.string().min(1, 'uom is required'),
  // Price may be 0 at order time when it is not yet known; the actual price is
  // captured at receiving (GRN).
  unitPrice: z.string().regex(/^\d+$/, 'unit price must be a non-negative integer'),
  taxCode: z.string().optional(),
});

export type POLineInput = z.infer<typeof POLineInputSchema>;

// ─── Create PO ─────────────────────────────────────────────────────────────────

export const CreatePOInputSchema = z.object({
  supplierId: z.string().min(1, 'supplier is required'),
  locationId: z.string().min(1, 'location is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format'),
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format')
    .optional(),
  lines: z.array(POLineInputSchema).min(1, 'at least one line is required'),
  notes: z.string().optional(),
});

export type CreatePOInput = z.infer<typeof CreatePOInputSchema>;

// ─── Workflow ──────────────────────────────────────────────────────────────────

export const SubmitPOInputSchema = z.object({
  poId: z.string().min(1),
});

export const ApprovePOInputSchema = z.object({
  poId: z.string().min(1),
});

export const CancelPOInputSchema = z.object({
  poId: z.string().min(1),
  reason: z.string().min(1, 'cancellation reason is required'),
});

export const TrackShipmentInputSchema = z.object({
  poId: z.string().min(1),
  courierCode: z.enum([
    'jne',
    'pos',
    'jnt',
    'jnt_cargo',
    'sicepat',
    'tiki',
    'anteraja',
    'wahana',
    'ninja',
    'lion',
    'pcp',
    'jet',
    'rex',
    'first',
    'ide',
    'shopee',
    'kgx',
    'sap',
    'jx',
    'rpx',
    'lazada',
    'indah',
    'dakota',
    'kurir_rekomendasi',
  ]),
  awb: z.string().trim().min(3).max(64),
  phoneLast5: z
    .string()
    .trim()
    .regex(/^\d{5}$/)
    .optional()
    .or(z.literal('')),
});

export type TrackShipmentInput = z.infer<typeof TrackShipmentInputSchema>;
