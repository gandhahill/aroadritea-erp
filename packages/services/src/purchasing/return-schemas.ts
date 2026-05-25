/**
 * Purchase return Zod schemas — T-0180.
 */

import { z } from 'zod';

export const PurchaseReturnLineInputSchema = z.object({
  grnLineId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  qtyReturned: z.string().refine((v) => Number.parseFloat(v) > 0, {
    message: 'qty_returned must be greater than 0',
  }),
  uom: z.string().min(1),
  unitCost: z.string().regex(/^\d+$/),
  taxCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type PurchaseReturnLineInput = z.infer<typeof PurchaseReturnLineInputSchema>;

export const CreatePurchaseReturnInputSchema = z.object({
  locationId: z.string().min(1),
  grnId: z.string().min(1),
  supplierId: z.string().min(1),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3).max(500),
  notes: z.string().max(1000).optional(),
  lines: z.array(PurchaseReturnLineInputSchema).min(1),
});

export type CreatePurchaseReturnInput = z.infer<typeof CreatePurchaseReturnInputSchema>;

export const PurchaseReturnIdInputSchema = z.object({
  returnId: z.string().min(1),
});

export type PurchaseReturnIdInput = z.infer<typeof PurchaseReturnIdInputSchema>;
