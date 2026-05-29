import { z } from 'zod';

export const PurchaseInvoiceLineInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  qty: z.string().min(1, 'Qty is required'),
  uom: z.string().min(1, 'UOM is required'),
  unitPrice: z.string().min(1, 'Unit Price is required'),
  taxCode: z.string().optional().nullable(),
});

export type PurchaseInvoiceLineInput = z.infer<typeof PurchaseInvoiceLineInputSchema>;

export const CreatePurchaseInvoiceInputSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice Number is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  purchaseOrderId: z.string().optional().nullable(),
  grnId: z.string().optional().nullable(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD'),
  lines: z.array(PurchaseInvoiceLineInputSchema).min(1, 'At least 1 line is required'),
  notes: z.string().optional(),
});

export type CreatePurchaseInvoiceInput = z.infer<typeof CreatePurchaseInvoiceInputSchema>;

export const VerifyPurchaseInvoiceInputSchema = z.object({
  invoiceId: z.string().min(1),
});

export const CancelPurchaseInvoiceInputSchema = z.object({
  invoiceId: z.string().min(1),
});
