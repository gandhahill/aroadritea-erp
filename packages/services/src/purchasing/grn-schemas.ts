/**
 * purchasing/grn-schemas.ts — Zod input schemas for GRN services (SD §21.6)
 */

import { z } from 'zod';

export const GRNLineInputSchema = z.object({
  poLineId: z.string().min(1, 'PO line ID is required'),
  productId: z.string().min(1, 'product is required'),
  variantId: z.string().optional(),
  qtyReceived: z.string().regex(/^\d+(\.\d{1,3})?$/, 'qty must be positive decimal').refine((v) => Number.parseFloat(v) > 0, { message: 'qty must be > 0' }),
  uom: z.string().min(1, 'uom is required'),
  batchNo: z.string().optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format')
    .optional(),
  notes: z.string().optional(),
});

export type GRNLineInput = z.infer<typeof GRNLineInputSchema>;

export const CreateGRNInputSchema = z.object({
  purchaseOrderId: z.string().min(1, 'PO ID is required'),
  locationId: z.string().min(1, 'location is required'),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format'),
  lines: z.array(GRNLineInputSchema).min(1, 'at least one line is required'),
  notes: z.string().optional(),
});

export type CreateGRNInput = z.infer<typeof CreateGRNInputSchema>;

export const ConfirmGRNInputSchema = z.object({
  grnId: z.string().min(1),
});

export type ConfirmGRNInput = z.infer<typeof ConfirmGRNInputSchema>;
