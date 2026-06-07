import type { CategoryResult, VariantResult } from '@erp/services/inventory';

export type ProductKind =
  | 'finished_good'
  | 'raw_material'
  | 'merchandise'
  | 'consumable'
  | 'service';

export interface ProductFormInitial {
  id: string;
  sku: string;
  name: { id: string; en: string; zh: string };
  description: { id: string; en: string; zh: string } | null;
  categoryId: string;
  kind: string;
  opnameFrequency: string;
  opnameFrequencies: Array<'daily' | 'weekly' | 'monthly'>;
  uom: string;
  isSellable: boolean;
  isPurchasable: boolean;
  trackBatch: boolean;
  trackExpiry: boolean;
  shelfLifeDays: number | null;
  defaultSellPrice: string;
  defaultCostPrice: string;
  taxCode: string | null;
  hppCategory: 'hpp' | 'supply_expense' | null;
  imageUrl: string | null;
  isActive: boolean;
  version: number;
  variants: VariantResult[];
}

export type ProductCategoryOption = CategoryResult;
