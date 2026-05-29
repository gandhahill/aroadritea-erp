import type { PromotionBenefitConfig, PromotionConditionConfig, PromotionKind } from '@erp/db/schema/promotion';
import { type Money, rupiah } from '@erp/shared/money';

export interface PromotionItem {
  id: string;
  kind: PromotionKind;
  conditions: PromotionConditionConfig;
  benefits: PromotionBenefitConfig;
  stackable: boolean;
  priority: number;
}

export interface CartLine {
  id: string;
  productId: string;
  categoryId?: string;
  qty: number;
  unitPrice: Money;
  subtotal: Money;
}

export interface Cart {
  lines: CartLine[];
  subtotal: Money;
}

export interface AppliedPromotion {
  promotionId: string;
  discountAmount: Money;
  appliesTo: 'order' | 'line';
  lineId?: string;
}

export interface EvaluationResult {
  appliedPromotions: AppliedPromotion[];
  totalDiscount: Money;
}

export function evaluatePromotions(cart: Cart, activePromotions: PromotionItem[]): EvaluationResult {
  const result: EvaluationResult = {
    appliedPromotions: [],
    totalDiscount: rupiah(0),
  };

  // Sort by priority (lower number = higher priority)
  const sorted = [...activePromotions].sort((a, b) => a.priority - b.priority);

  let remainingCartSubtotal = cart.subtotal;
  let hasNonStackable = false;

  for (const promo of sorted) {
    if (hasNonStackable) break;

    // Check conditions
    if (promo.conditions.minSubtotal && remainingCartSubtotal < rupiah(promo.conditions.minSubtotal)) {
      continue;
    }

    if (promo.conditions.requiredProductIds && promo.conditions.requiredProductIds.length > 0) {
      const hasProduct = cart.lines.some(l => promo.conditions.requiredProductIds?.includes(l.productId));
      if (!hasProduct) continue;
    }
    
    if (promo.conditions.requiredCategoryIds && promo.conditions.requiredCategoryIds.length > 0) {
      const hasCategory = cart.lines.some(l => l.categoryId && promo.conditions.requiredCategoryIds?.includes(l.categoryId));
      if (!hasCategory) continue;
    }

    if (promo.conditions.minQty) {
      const totalQty = cart.lines.reduce((sum, l) => sum + l.qty, 0);
      if (totalQty < promo.conditions.minQty) continue;
    }

    let discountAmount = rupiah(0);

    if (promo.kind === 'percent_discount') {
      const percentBps = promo.benefits.percentBps ?? 0;
      let calculatedDiscount = (remainingCartSubtotal * BigInt(percentBps)) / BigInt(10000);
      
      if (promo.benefits.maxDiscountAmount) {
        const maxDisc = rupiah(promo.benefits.maxDiscountAmount);
        if (calculatedDiscount > maxDisc) {
          calculatedDiscount = maxDisc;
        }
      }
      discountAmount = calculatedDiscount;
    } else if (promo.kind === 'fixed_discount') {
      discountAmount = rupiah(promo.benefits.amount ?? '0');
      if (discountAmount > remainingCartSubtotal) {
        discountAmount = remainingCartSubtotal;
      }
    } else {
      // 'buy_x_get_y', 'free_item', 'complimentary' not fully implemented yet
      continue;
    }

    if (discountAmount > rupiah(0)) {
      result.appliedPromotions.push({
        promotionId: promo.id,
        discountAmount,
        appliesTo: 'order',
      });
      result.totalDiscount += discountAmount;
      remainingCartSubtotal -= discountAmount;

      if (!promo.stackable) {
        hasNonStackable = true;
      }
    }
  }

  return result;
}
