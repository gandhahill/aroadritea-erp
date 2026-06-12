import type {
  PromotionBenefitConfig,
  PromotionConditionConfig,
  PromotionKind,
} from '@erp/db/schema/promotion';
import { type Money, rupiah } from '@erp/shared/money';

export interface PromotionItem {
  id: string;
  kind: PromotionKind;
  conditions: PromotionConditionConfig;
  benefits: PromotionBenefitConfig;
  stackable: boolean;
  priority: number;
  usageLimit: number | null;
  usageCount: number;
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
  isMember?: boolean;
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

export function evaluatePromotions(
  cart: Cart,
  activePromotions: PromotionItem[],
): EvaluationResult {
  const result: EvaluationResult = {
    appliedPromotions: [],
    totalDiscount: rupiah(0),
  };

  // Sort by priority (lower number = higher priority)
  const sorted = [...activePromotions].sort((a, b) => a.priority - b.priority);

  let remainingCartSubtotal = cart.subtotal;
  let hasNonStackable = false;
  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const wibDay = wibDate.getDay();
  const wibTimeStr =
    wibDate.getHours().toString().padStart(2, '0') +
    ':' +
    wibDate.getMinutes().toString().padStart(2, '0');

  for (const promo of sorted) {
    if (hasNonStackable) break;

    // Check usage limits
    if (
      promo.usageLimit !== null &&
      promo.usageLimit !== undefined &&
      promo.usageCount >= promo.usageLimit
    ) {
      continue;
    }

    // Check conditions
    if (promo.conditions.memberOnly && !cart.isMember) continue;

    if (promo.conditions.daysOfWeek && promo.conditions.daysOfWeek.length > 0) {
      if (!promo.conditions.daysOfWeek.includes(wibDay)) continue;
    }

    if (promo.conditions.startTime && wibTimeStr < promo.conditions.startTime) continue;
    if (promo.conditions.endTime && wibTimeStr > promo.conditions.endTime) continue;
    if (
      promo.conditions.minSubtotal &&
      remainingCartSubtotal < rupiah(promo.conditions.minSubtotal)
    ) {
      continue;
    }

    if (promo.conditions.requiredProductIds && promo.conditions.requiredProductIds.length > 0) {
      const hasProduct = cart.lines.some((l) =>
        promo.conditions.requiredProductIds?.includes(l.productId),
      );
      if (!hasProduct) continue;
    }

    if (promo.conditions.requiredCategoryIds && promo.conditions.requiredCategoryIds.length > 0) {
      const hasCategory = cart.lines.some(
        (l) => l.categoryId && promo.conditions.requiredCategoryIds?.includes(l.categoryId),
      );
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
    } else if (promo.kind === 'buy_x_get_y' || promo.kind === 'free_item') {
      const lineDiscounts = applyGetItemBenefit(promo, cart);
      if (lineDiscounts.length === 0) continue;

      for (const entry of lineDiscounts) {
        result.appliedPromotions.push(entry);
        result.totalDiscount += entry.discountAmount;
        remainingCartSubtotal -= entry.discountAmount;
      }

      if (!promo.stackable) {
        hasNonStackable = true;
      }
      continue;
    } else {
      // 'complimentary' not implemented yet — GL expense routing needs an ADR (see G3b)
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

/**
 * Computes line-level discounts for 'buy_x_get_y' and 'free_item' promotions.
 *
 * Both kinds discount up to `getQty` units of `getProductId` by `discountBps`
 * (default 10000 = 100%, i.e. free). 'buy_x_get_y' additionally requires the
 * cart to already hold >= `buyQty` units of `buyProductId`; 'free_item' relies
 * only on the generic conditions checked earlier in evaluatePromotions.
 *
 * Promotions only discount items already in the cart — they never add new lines.
 * `getVariantId` is not matched: CartLine carries no variant dimension yet.
 */
function applyGetItemBenefit(promo: PromotionItem, cart: Cart): AppliedPromotion[] {
  const { benefits } = promo;
  const getProductId = benefits.getProductId;
  const getQty = benefits.getQty ?? 0;
  if (!getProductId || getQty <= 0) return [];

  if (promo.kind === 'buy_x_get_y') {
    const buyProductId = benefits.buyProductId;
    const buyQty = benefits.buyQty ?? 0;
    if (!buyProductId || buyQty <= 0) return [];

    const ownedQty = cart.lines
      .filter((l) => l.productId === buyProductId)
      .reduce((sum, l) => sum + l.qty, 0);
    if (ownedQty < buyQty) return [];
  }

  const targetLines = cart.lines.filter((l) => l.productId === getProductId);
  if (targetLines.length === 0) return [];

  const discountBps = benefits.discountBps ?? 10000;
  let remainingQty = getQty;
  const applied: AppliedPromotion[] = [];

  for (const line of targetLines) {
    if (remainingQty <= 0) break;
    const units = Math.min(line.qty, remainingQty);
    const perUnitDiscount = (line.unitPrice * BigInt(discountBps)) / BigInt(10000);
    const discountAmount = perUnitDiscount * BigInt(units);
    if (discountAmount <= rupiah(0)) continue;

    applied.push({
      promotionId: promo.id,
      discountAmount,
      appliesTo: 'line',
      lineId: line.id,
    });
    remainingQty -= units;
  }

  return applied;
}
