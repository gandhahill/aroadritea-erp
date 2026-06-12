/**
 * Tests for the promotion evaluator (G3a / T-0300, see TASK.md backlog "🍵 Backlog T-0299").
 *
 * Covers all 5 PromotionKind values: percent_discount, fixed_discount,
 * buy_x_get_y, free_item (newly implemented here), and complimentary (still a
 * documented no-op pending G3b GL-expense routing). Also covers usageLimit
 * gating and stacking of a line-level discount with an order-level discount —
 * none of this had any test coverage before this file existed.
 */

import { rupiah } from '@erp/shared/money';
import { describe, expect, it } from 'vitest';
import {
  type Cart,
  type CartLine,
  type PromotionItem,
  evaluatePromotions,
} from '../src/promotion/evaluator';

function makePromotion(overrides: Partial<PromotionItem> = {}): PromotionItem {
  return {
    id: 'promo-1',
    kind: 'percent_discount',
    conditions: {},
    benefits: {},
    stackable: false,
    priority: 100,
    usageLimit: null,
    usageCount: 0,
    ...overrides,
  };
}

function makeLine(params: { productId: string; qty: number; unitPrice: bigint }): CartLine {
  const subtotal = params.unitPrice * BigInt(params.qty);
  return {
    id: params.productId,
    productId: params.productId,
    qty: params.qty,
    unitPrice: params.unitPrice,
    subtotal,
  };
}

function makeCart(lines: CartLine[], extra: Partial<Pick<Cart, 'isMember'>> = {}): Cart {
  return {
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.subtotal, 0n),
    ...extra,
  };
}

describe('evaluatePromotions', () => {
  describe('percent_discount', () => {
    it('applies as an order-level discount', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 1, unitPrice: rupiah(100000) })]);
      const promo = makePromotion({
        id: 'promo-percent',
        kind: 'percent_discount',
        benefits: { percentBps: 1000 }, // 10%
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.totalDiscount).toBe(rupiah(10000));
      expect(result.appliedPromotions).toEqual([
        { promotionId: 'promo-percent', discountAmount: rupiah(10000), appliesTo: 'order' },
      ]);
    });

    it('caps the discount at maxDiscountAmount', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 1, unitPrice: rupiah(1000000) })]);
      const promo = makePromotion({
        kind: 'percent_discount',
        benefits: { percentBps: 5000, maxDiscountAmount: '100000' }, // 50%, capped at 100k
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.totalDiscount).toBe(rupiah(100000));
    });
  });

  describe('fixed_discount', () => {
    it('applies a flat amount as an order-level discount', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 2, unitPrice: rupiah(25000) })]);
      const promo = makePromotion({ kind: 'fixed_discount', benefits: { amount: '20000' } });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.totalDiscount).toBe(rupiah(20000));
      expect(result.appliedPromotions).toEqual([
        { promotionId: 'promo-1', discountAmount: rupiah(20000), appliesTo: 'order' },
      ]);
    });

    it('caps the discount at the cart subtotal', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 1, unitPrice: rupiah(15000) })]);
      const promo = makePromotion({ kind: 'fixed_discount', benefits: { amount: '20000' } });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.totalDiscount).toBe(rupiah(15000));
    });
  });

  describe('buy_x_get_y', () => {
    it('discounts the get-product when the buy-quantity is met', () => {
      const cart = makeCart([
        makeLine({ productId: 'tea-large', qty: 2, unitPrice: rupiah(15000) }),
        makeLine({ productId: 'topping-boba', qty: 1, unitPrice: rupiah(5000) }),
      ]);
      const promo = makePromotion({
        id: 'promo-bogo',
        kind: 'buy_x_get_y',
        benefits: {
          buyProductId: 'tea-large',
          buyQty: 2,
          getProductId: 'topping-boba',
          getQty: 1,
          discountBps: 10000, // free
        },
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([
        {
          promotionId: 'promo-bogo',
          discountAmount: rupiah(5000),
          appliesTo: 'line',
          lineId: 'topping-boba',
        },
      ]);
      expect(result.totalDiscount).toBe(rupiah(5000));
    });

    it('does not apply when the buy-quantity is not met', () => {
      const cart = makeCart([
        makeLine({ productId: 'tea-large', qty: 1, unitPrice: rupiah(15000) }), // needs 2
        makeLine({ productId: 'topping-boba', qty: 1, unitPrice: rupiah(5000) }),
      ]);
      const promo = makePromotion({
        kind: 'buy_x_get_y',
        benefits: {
          buyProductId: 'tea-large',
          buyQty: 2,
          getProductId: 'topping-boba',
          getQty: 1,
          discountBps: 10000,
        },
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([]);
      expect(result.totalDiscount).toBe(rupiah(0));
    });

    it('does not apply when the get-product is absent from the cart', () => {
      const cart = makeCart([makeLine({ productId: 'tea-large', qty: 2, unitPrice: rupiah(15000) })]);
      const promo = makePromotion({
        kind: 'buy_x_get_y',
        benefits: {
          buyProductId: 'tea-large',
          buyQty: 2,
          getProductId: 'topping-boba',
          getQty: 1,
          discountBps: 10000,
        },
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([]);
    });
  });

  describe('free_item', () => {
    it('discounts up to getQty units of the target product', () => {
      const cart = makeCart([
        makeLine({ productId: 'pearl-topping', qty: 3, unitPrice: rupiah(4000) }),
      ]);
      const promo = makePromotion({
        id: 'promo-free',
        kind: 'free_item',
        benefits: { getProductId: 'pearl-topping', getQty: 2, discountBps: 10000 },
      });

      const result = evaluatePromotions(cart, [promo]);

      // Only 2 of the 3 units are discounted
      expect(result.totalDiscount).toBe(rupiah(8000));
      expect(result.appliedPromotions).toEqual([
        {
          promotionId: 'promo-free',
          discountAmount: rupiah(8000),
          appliesTo: 'line',
          lineId: 'pearl-topping',
        },
      ]);
    });

    it('supports a partial discountBps (not just 100% free)', () => {
      const cart = makeCart([
        makeLine({ productId: 'pearl-topping', qty: 1, unitPrice: rupiah(4000) }),
      ]);
      const promo = makePromotion({
        kind: 'free_item',
        benefits: { getProductId: 'pearl-topping', getQty: 1, discountBps: 5000 }, // 50% off
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.totalDiscount).toBe(rupiah(2000));
    });

    it('does not apply when the target product is absent from the cart', () => {
      const cart = makeCart([makeLine({ productId: 'tea-large', qty: 1, unitPrice: rupiah(15000) })]);
      const promo = makePromotion({
        kind: 'free_item',
        benefits: { getProductId: 'pearl-topping', getQty: 1, discountBps: 10000 },
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([]);
      expect(result.totalDiscount).toBe(rupiah(0));
    });
  });

  describe('complimentary', () => {
    it('does not apply yet — pending G3b GL expense routing', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 1, unitPrice: rupiah(10000) })]);
      const promo = makePromotion({
        kind: 'complimentary',
        benefits: {
          getProductId: 'p1',
          getQty: 1,
          discountBps: 10000,
          requiresReason: true,
          expenseAccountCode: '6-9999',
        },
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([]);
      expect(result.totalDiscount).toBe(rupiah(0));
    });
  });

  describe('usageLimit', () => {
    it('skips a promotion that has reached its usage limit', () => {
      const cart = makeCart([makeLine({ productId: 'p1', qty: 1, unitPrice: rupiah(100000) })]);
      const promo = makePromotion({
        kind: 'percent_discount',
        benefits: { percentBps: 1000 },
        usageLimit: 5,
        usageCount: 5,
      });

      const result = evaluatePromotions(cart, [promo]);

      expect(result.appliedPromotions).toEqual([]);
    });
  });

  describe('stacking', () => {
    it('stacks a line-level buy_x_get_y discount with an order-level percent_discount', () => {
      const cart = makeCart([
        makeLine({ productId: 'tea-large', qty: 2, unitPrice: rupiah(15000) }), // subtotal 30000
        makeLine({ productId: 'topping-boba', qty: 1, unitPrice: rupiah(5000) }), // subtotal 5000
      ]); // cart subtotal = 35000

      const bogo = makePromotion({
        id: 'promo-bogo',
        kind: 'buy_x_get_y',
        priority: 1,
        stackable: true,
        benefits: {
          buyProductId: 'tea-large',
          buyQty: 2,
          getProductId: 'topping-boba',
          getQty: 1,
          discountBps: 10000,
        },
      });
      const memberDiscount = makePromotion({
        id: 'promo-member',
        kind: 'percent_discount',
        priority: 2,
        stackable: true,
        benefits: { percentBps: 1000 }, // 10%
      });

      const result = evaluatePromotions(cart, [bogo, memberDiscount]);

      // BOGO: free topping = 5000 discount on the 'topping-boba' line.
      // Remaining subtotal after BOGO = 35000 - 5000 = 30000.
      // 10% of 30000 = 3000, applied at order level.
      expect(result.appliedPromotions).toEqual([
        {
          promotionId: 'promo-bogo',
          discountAmount: rupiah(5000),
          appliesTo: 'line',
          lineId: 'topping-boba',
        },
        { promotionId: 'promo-member', discountAmount: rupiah(3000), appliesTo: 'order' },
      ]);
      expect(result.totalDiscount).toBe(rupiah(8000));
    });
  });
});
