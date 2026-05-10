/**
 * purchasing/schemas.ts — Zod input schemas for purchasing services (SD §21.6)
 */

import { z } from 'zod';

// ─── Common ─────────────────────────────────────────────────────────────────────

export const POLineInputSchema = z.object({
  productId: z.string().min(1, 'product is required'),
  variantId: z.string().optional(),
  qtyOrdered: z.string().regex(/^\d+(\.\d{1,3})?$/, 'qty must be positive decimal'),
  uom: z.string().min(1, 'uom is required'),
  unitPrice: z.string().regex(/^\d+$/, 'unit price must be non-negative integer'),
  taxCode: z.string().optional(),
});

export type POLineInput = z.infer<typeof POLineInputSchema>;

// ─── Create PO ─────────────────────────────────────────────────────────────────

export const CreatePOInputSchema = z.object({
  supplierId: z.string().min(1, 'supplier is required'),
  locationId: z.string().min(1, 'location is required'),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format'),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format').optional(),
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