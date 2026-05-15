/**
 * Inventory Zod schemas — SD §9.3, §21.5
 *
 * All inputs validated at service layer so both UI (Server Actions)
 * and MCP calls go through the same validation.
 */

import { z } from 'zod';

// --- Locale String helper (reusable) ---

const LocaleStringSchema = z.object({
  id: z.string().min(1),
  en: z.string().min(1),
  zh: z.string().min(1),
});

const ImageReferenceSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith('/') || z.string().url().safeParse(value).success, {
    message: 'Image reference must be an absolute URL or public path',
  });

// ─── Product Category ─────────────────────────────────────────────────────────

export const CreateCategoryInputSchema = z.object({
  code: z.string().min(1).max(32),
  name: LocaleStringSchema,
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

export const UpdateCategoryInputSchema = z.object({
  categoryId: z.string().min(1),
  name: LocaleStringSchema.optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;

// ─── Product ──────────────────────────────────────────────────────────────────

export const CreateProductInputSchema = z.object({
  sku: z.string().min(1).max(64),
  name: LocaleStringSchema,
  description: LocaleStringSchema.optional(),
  categoryId: z.string().min(1),
  kind: z
    .enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service'])
    .optional()
    .default('finished_good'),
  uom: z.string().min(1).max(16).optional().default('pcs'),
  isSellable: z.boolean().optional().default(true),
  isPurchasable: z.boolean().optional().default(false),
  trackBatch: z.boolean().optional().default(false),
  trackExpiry: z.boolean().optional().default(false),
  shelfLifeDays: z.number().int().positive().optional(),
  /** Default sell price in rupiah (string for bigint serialization) */
  defaultSellPrice: z.string().regex(/^\d+$/).optional().default('0'),
  /** Default cost price in rupiah */
  defaultCostPrice: z.string().regex(/^\d+$/).optional().default('0'),
  cogsAccountId: z.string().optional(),
  revenueAccountId: z.string().optional(),
  inventoryAccountId: z.string().optional(),
  taxCode: z.string().optional(),
  imageUrl: ImageReferenceSchema.optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = z.object({
  productId: z.string().min(1),
  name: LocaleStringSchema.optional(),
  description: LocaleStringSchema.nullable().optional(),
  categoryId: z.string().optional(),
  kind: z
    .enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service'])
    .optional(),
  uom: z.string().min(1).max(16).optional(),
  isSellable: z.boolean().optional(),
  isPurchasable: z.boolean().optional(),
  trackBatch: z.boolean().optional(),
  trackExpiry: z.boolean().optional(),
  shelfLifeDays: z.number().int().positive().nullable().optional(),
  defaultSellPrice: z.string().regex(/^\d+$/).optional(),
  defaultCostPrice: z.string().regex(/^\d+$/).optional(),
  cogsAccountId: z.string().nullable().optional(),
  revenueAccountId: z.string().nullable().optional(),
  inventoryAccountId: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
  imageUrl: ImageReferenceSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1),
});

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

// ─── Product Variant ──────────────────────────────────────────────────────────

export const CreateVariantInputSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1).max(64),
  name: LocaleStringSchema,
  sellPrice: z.string().regex(/^\d+$/).optional().default('0'),
  costPrice: z.string().regex(/^\d+$/).optional().default('0'),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type CreateVariantInput = z.infer<typeof CreateVariantInputSchema>;

export const UpdateVariantInputSchema = z.object({
  variantId: z.string().min(1),
  name: LocaleStringSchema.optional(),
  sellPrice: z.string().regex(/^\d+$/).optional(),
  costPrice: z.string().regex(/^\d+$/).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1),
});

export type UpdateVariantInput = z.infer<typeof UpdateVariantInputSchema>;

// ─── List / Filter ────────────────────────────────────────────────────────────

export const ListProductsInputSchema = z.object({
  categoryId: z.string().optional(),
  kind: z
    .enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service'])
    .optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  isSellable: z.boolean().optional(),
  isPurchasable: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListProductsInput = z.infer<typeof ListProductsInputSchema>;

// ─── Stock Adjustment ─────────────────────────────────────────────────────────

export const AdjustmentReasonSchema = z.enum([
  'waste',
  'damage',
  'count_correction',
  'opening_balance',
  'other',
]);

export type AdjustmentReason = z.infer<typeof AdjustmentReasonSchema>;

export const AdjustmentLineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  batchNo: z.string().optional(),
  qtyBefore: z.string().regex(/^\d+(\.\d+)?$/),
  qtyAfter: z.string().regex(/^\d+(\.\d+)?$/),
  qtyDelta: z.string().regex(/^-?\d+(\.\d+)?$/),
  uom: z.string().min(1).max(16),
  unitCost: z.string().regex(/^\d+$/).optional(),
  notes: z.string().optional(),
});

export type AdjustmentLineInput = z.infer<typeof AdjustmentLineInputSchema>;

export const CreateAdjustmentInputSchema = z.object({
  locationId: z.string().min(1),
  adjustmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: AdjustmentReasonSchema,
  notes: z.string().optional(),
  lines: z.array(AdjustmentLineInputSchema).min(1),
});

export type CreateAdjustmentInput = z.infer<typeof CreateAdjustmentInputSchema>;

export const ApproveAdjustmentInputSchema = z.object({
  adjustmentId: z.string().min(1),
  version: z.number().int().min(1),
});

export type ApproveAdjustmentInput = z.infer<typeof ApproveAdjustmentInputSchema>;

export const RejectAdjustmentInputSchema = z.object({
  adjustmentId: z.string().min(1),
  version: z.number().int().min(1),
  reason: z.string().min(1),
});

export type RejectAdjustmentInput = z.infer<typeof RejectAdjustmentInputSchema>;

// ─── Stock Transfer ────────────────────────────────────────────────────────────

export const TransferLineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  batchNo: z.string().optional(),
  qty: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .refine((v) => Number.parseFloat(v) > 0, {
      message: 'Transfer qty must be greater than 0',
    }),
  uom: z.string().min(1).max(16),
});

export type TransferLineInput = z.infer<typeof TransferLineInputSchema>;

export const CreateTransferInputSchema = z
  .object({
    fromLocationId: z.string().min(1),
    toLocationId: z.string().min(1),
    transferDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional(),
    lines: z.array(TransferLineInputSchema).min(1),
  })
  .refine((data) => data.fromLocationId !== data.toLocationId, {
    message: 'fromLocationId and toLocationId must be different',
    path: ['toLocationId'],
  });

export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const ShipTransferInputSchema = z.object({
  transferId: z.string().min(1),
  version: z.number().int().min(1),
});

export type ShipTransferInput = z.infer<typeof ShipTransferInputSchema>;

export const ReceiveTransferInputSchema = z.object({
  transferId: z.string().min(1),
  version: z.number().int().min(1),
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        qtyReceived: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .refine((v) => Number.parseFloat(v) > 0, {
            message: 'qtyReceived must be greater than 0',
          }),
      }),
    )
    .optional(),
});

export type ReceiveTransferInput = z.infer<typeof ReceiveTransferInputSchema>;
