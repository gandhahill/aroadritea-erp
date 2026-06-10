import { z } from 'zod';

export const PurchaseRequisitionLineInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  qtyRequested: z.string().min(1, 'Qty is required'),
  uom: z.string().min(1, 'UOM is required'),
  notes: z.string().optional(),
});

export type PurchaseRequisitionLineInput = z.infer<typeof PurchaseRequisitionLineInputSchema>;

export const CreatePurchaseRequisitionInputSchema = z.object({
  locationId: z.string().min(1, 'Location is required'),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  lines: z.array(PurchaseRequisitionLineInputSchema).min(1, 'At least 1 line is required'),
  notes: z.string().optional(),
});

export type CreatePurchaseRequisitionInput = z.infer<typeof CreatePurchaseRequisitionInputSchema>;

export const PRIdInputSchema = z.object({
  prId: z.string().min(1),
});

export const CreateRFQInputSchema = z.object({
  prId: z.string().optional().nullable(),
  locationId: z.string().min(1, 'Location is required'),
  rfqDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional().nullable(),
        qty: z.string().min(1),
        uom: z.string().min(1),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});
