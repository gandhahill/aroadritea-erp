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
  kind: z.enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service'])
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
  imageUrl: z.string().url().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = z.object({
  productId: z.string().min(1),
  name: LocaleStringSchema.optional(),
  description: LocaleStringSchema.nullable().optional(),
  categoryId: z.string().optional(),
  kind: z.enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service']).optional(),
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
  imageUrl: z.string().url().nullable().optional(),
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
  kind: z.enum(['finished_good', 'raw_material', 'merchandise', 'consumable', 'service']).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  isSellable: z.boolean().optional(),
  isPurchasable: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ListProductsInput = z.infer<typeof ListProductsInputSchema>;
