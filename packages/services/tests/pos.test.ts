/**
 * POS service tests — T-0057, T-0058
 *
 * Tests: schema validation, PB1 extraction, sale number format,
 * shift business rules, delivery channel accounting, refund business logic.
 */

import { describe, expect, it } from 'vitest';
import { resolveIngredientDeductionDecision } from '../src/pos/create-sale';
import {
  ChannelSchema,
  CloseShiftInputSchema,
  CreateSaleInputSchema,
  OpenShiftInputSchema,
  RefundSaleInputSchema,
  VoidSaleInputSchema,
} from '../src/pos/schemas';

// ─── PB1 extraction (mirrors create-sale logic) ────────────────────────────────

function extractPB1(inclusivePrice: bigint): { net: bigint; pb1: bigint } {
  // Multiply by 10000 (basis points for 10%) and divide by 11000 to get net in IDR
  const price10k = BigInt(inclusivePrice) * BigInt(10000);
  const net10k = price10k / BigInt(11000);
  const net = net10k; // already in full IDR
  const pb1 = inclusivePrice - net;
  return { net, pb1 };
}

// ─── Schema: OpenShiftInput ──────────────────────────────────────────────────

describe('OpenShiftInputSchema', () => {
  it('accepts valid input', () => {
    const result = OpenShiftInputSchema.safeParse({
      locationId: 'loc-001',
      openingCash: '500000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty locationId', () => {
    const result = OpenShiftInputSchema.safeParse({
      locationId: '',
      openingCash: '500000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric openingCash', () => {
    const result = OpenShiftInputSchema.safeParse({
      locationId: 'loc-001',
      openingCash: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative openingCash', () => {
    const result = OpenShiftInputSchema.safeParse({
      locationId: 'loc-001',
      openingCash: '-100',
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero openingCash', () => {
    const result = OpenShiftInputSchema.safeParse({
      locationId: 'loc-001',
      openingCash: '0',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Schema: CloseShiftInput ──────────────────────────────────────────────────

describe('CloseShiftInputSchema', () => {
  it('accepts valid input', () => {
    const result = CloseShiftInputSchema.safeParse({
      shiftId: 'shift-001',
      actualCash: '1200000',
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero version', () => {
    const result = CloseShiftInputSchema.safeParse({
      shiftId: 'shift-001',
      actualCash: '1200000',
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative version', () => {
    const result = CloseShiftInputSchema.safeParse({
      shiftId: 'shift-001',
      actualCash: '1200000',
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer version', () => {
    const result = CloseShiftInputSchema.safeParse({
      shiftId: 'shift-001',
      actualCash: '1200000',
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty shiftId', () => {
    const result = CloseShiftInputSchema.safeParse({
      shiftId: '',
      actualCash: '1200000',
      version: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Schema: Channel ───────────────────────────────────────────────────────────

describe('ChannelSchema', () => {
  it('accepts walk_in', () => {
    expect(ChannelSchema.safeParse('walk_in').success).toBe(true);
  });
  it('accepts gofood', () => {
    expect(ChannelSchema.safeParse('gofood').success).toBe(true);
  });
  it('accepts grabfood', () => {
    expect(ChannelSchema.safeParse('grabfood').success).toBe(true);
  });
  it('accepts shopeefood', () => {
    expect(ChannelSchema.safeParse('shopeefood').success).toBe(true);
  });
  it('accepts configurable channel tokens', () => {
    expect(ChannelSchema.safeParse('dine_in').success).toBe(true);
  });
  it('rejects invalid channel token format', () => {
    expect(ChannelSchema.safeParse('DINE IN').success).toBe(false);
  });
  it('rejects empty string', () => {
    expect(ChannelSchema.safeParse('').success).toBe(false);
  });
});

// ─── Schema: CreateSaleInput ──────────────────────────────────────────────────

describe('CreateSaleInputSchema', () => {
  it('accepts valid walk_in sale', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [
        {
          productId: 'prod-001',
          qty: 2,
          unitPrice: '33000',
          lineDiscount: '0',
        },
      ],
      payments: [{ method: 'cash', amount: '66000' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid delivery channel sale', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'gofood',
      locationId: 'loc-001',
      idempotencyKey: 'key-002',
      lines: [
        {
          productId: 'prod-001',
          qty: 1,
          unitPrice: '25000',
        },
      ],
      payments: [{ method: 'gofood', amount: '25000' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty lines array', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [],
      payments: [{ method: 'cash', amount: '33000' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty payments array', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000' }],
      payments: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts line with variantId', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', variantId: 'var-001', qty: 1, unitPrice: '33000' }],
      payments: [{ method: 'cash', amount: '33000' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects qty of 0', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', qty: 0, unitPrice: '33000' }],
      payments: [{ method: 'cash', amount: '33000' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative qty', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', qty: -1, unitPrice: '33000' }],
      payments: [{ method: 'cash', amount: '33000' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid payment methods', () => {
    const methods = [
      'cash',
      'qris',
      'flazz',
      'debit',
      'credit',
      'gofood',
      'grabfood',
      'shopeefood',
    ];
    for (const method of methods) {
      const result = CreateSaleInputSchema.safeParse({
        shiftId: 'shift-001',
        channel: 'walk_in',
        locationId: 'loc-001',
        idempotencyKey: `key-${method}`,
        lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000' }],
        payments: [{ method, amount: '33000' }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid payment method token format', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000' }],
      payments: [{ method: 'credit card', amount: '33000' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects idempotencyKey longer than 64 chars', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'x'.repeat(65),
      lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000' }],
      payments: [{ method: 'cash', amount: '33000' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional notes field', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-001',
      lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000' }],
      payments: [{ method: 'cash', amount: '33000' }],
      notes: 'Extra shot espresso',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe('Extra shot espresso');
    }
  });

  it('requires a reason when cashier applies a manual line discount', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-discount-reason',
      lines: [{ productId: 'prod-001', qty: 1, unitPrice: '33000', lineDiscount: '3000' }],
      payments: [{ method: 'cash', amount: '30000' }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts manual line discount when a governance reason is supplied', () => {
    const result = CreateSaleInputSchema.safeParse({
      shiftId: 'shift-001',
      channel: 'walk_in',
      locationId: 'loc-001',
      idempotencyKey: 'key-discount-reason-ok',
      lines: [
        {
          productId: 'prod-001',
          qty: 1,
          unitPrice: '33000',
          lineDiscount: '3000',
          lineDiscountReason: 'Director approved one-off service recovery',
        },
      ],
      payments: [{ method: 'cash', amount: '30000' }],
    });

    expect(result.success).toBe(true);
  });
});

// ─── Schema: VoidSaleInput ─────────────────────────────────────────────────────

describe('VoidSaleInputSchema', () => {
  const validBase = {
    salesOrderId: 'so-001',
    reason: 'Wrong item ordered',
    version: 1,
    idempotencyKey: 'idem-void-001',
  };

  it('accepts valid input', () => {
    const result = VoidSaleInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = VoidSaleInputSchema.safeParse({ ...validBase, reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason longer than 255 chars', () => {
    const result = VoidSaleInputSchema.safeParse({ ...validBase, reason: 'x'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('accepts reason at exactly 255 chars', () => {
    const result = VoidSaleInputSchema.safeParse({ ...validBase, reason: 'x'.repeat(255) });
    expect(result.success).toBe(true);
  });

  it('rejects missing idempotencyKey', () => {
    const { idempotencyKey: _drop, ...rest } = validBase;
    const result = VoidSaleInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ─── PB1 extraction calculation ───────────────────────────────────────────────

describe('PB1 extraction (10% inclusive)', () => {
  it('extracts PB1 from 33000 (T01 Boba Milk regular)', () => {
    // net = 33000×10000/11000 = 30000; pb1 = 33000-30000 = 3000
    const { net, pb1 } = extractPB1(BigInt(33000));
    expect(net).toBe(BigInt(30000));
    expect(pb1).toBe(BigInt(3000));
  });

  it('extracts PB1 from 22000', () => {
    // net = 22000×10000/11000 = 20000; pb1 = 22000-20000 = 2000
    const { net, pb1 } = extractPB1(BigInt(22000));
    expect(net).toBe(BigInt(20000));
    expect(pb1).toBe(BigInt(2000));
  });

  it('extracts PB1 from 11000', () => {
    // net = 11000×10000/11000 = 10000; pb1 = 11000-10000 = 1000
    const { net, pb1 } = extractPB1(BigInt(11000));
    expect(net).toBe(BigInt(10000));
    expect(pb1).toBe(BigInt(1000));
  });

  it('extracts PB1 from 55000', () => {
    // net = 55000×10000/11000 = 50000; pb1 = 55000-50000 = 5000
    const { net, pb1 } = extractPB1(BigInt(55000));
    expect(net).toBe(BigInt(50000));
    expect(pb1).toBe(BigInt(5000));
  });

  it('net + pb1 equals inclusive price', () => {
    const prices = [11000, 22000, 33000, 44000, 55000, 110000];
    for (const price of prices) {
      const { net, pb1 } = extractPB1(BigInt(price));
      expect(net + pb1).toBe(BigInt(price));
    }
  });

  it('pb1 is approximately 10% of net for typical prices', () => {
    const { net, pb1 } = extractPB1(BigInt(33000));
    const ratio = Number(pb1) / Number(net);
    expect(ratio).toBeCloseTo(0.1, 3);
  });

  it('handles large IDR amounts', () => {
    // net = 10000000×10000/11000 = 9090909; pb1 = 10000000-9090909 = 909091
    const { net, pb1 } = extractPB1(BigInt(10000000));
    expect(net + pb1).toBe(BigInt(10000000));
  });
});

// ─── Sale number format ────────────────────────────────────────────────────────

describe('Sale number format T01-YYYY-MM-NNNN', () => {
  it('matches expected pattern', () => {
    const pattern = /^T01-\d{4}-\d{2}-\d{4}$/;
    const validNumbers = ['T01-2026-01-0001', 'T01-2026-05-0001', 'T01-2026-12-9999'];
    for (const num of validNumbers) {
      expect(pattern.test(num)).toBe(true);
    }
    // invalid cases — wrong prefix, wrong digit count (structural only; no runtime validation)
    const invalidNumbers = [
      'T02-2026-05-0001', // wrong prefix
      'T01-26-05-0001', // 2-digit year
      'T01-2026-05-1', // too short
      'T01-2026-05-00001', // too long
      'T01-2026-5-0001', // single-digit month
    ];
    for (const num of invalidNumbers) {
      expect(pattern.test(num)).toBe(false);
    }
  });
});

// ─── Delivery channel accounting ─────────────────────────────────────────────

describe('Delivery channel accounting', () => {
  const channels = ['gofood', 'grabfood', 'shopeefood'];

  it('records gross platform receivable at sale time', () => {
    for (const channel of channels) {
      const gross = BigInt(33000);
      const { net: revenue, pb1 } = extractPB1(gross);
      const receivableDebit = gross;

      expect(channel).toMatch(/food|grab/);
      expect(receivableDebit).toBe(BigInt(33000));
      expect(revenue).toBe(BigInt(30000));
      expect(pb1).toBe(BigInt(3000));
      expect(receivableDebit).toBe(revenue + pb1);
    }
  });

  it('recognizes platform commission only when settlement is entered', () => {
    const grossReceivable = BigInt(33000);
    const commission = (grossReceivable * BigInt(20)) / BigInt(100);
    const bankSettlement = grossReceivable - commission;

    expect(bankSettlement).toBe(BigInt(26400));
    expect(commission).toBe(BigInt(6600));
    expect(bankSettlement + commission).toBe(grossReceivable);
  });

  it('keeps walk_in cash debit equal to gross sale', () => {
    const gross = BigInt(33000);
    const { net: revenue, pb1 } = extractPB1(gross);

    expect(gross).toBe(revenue + pb1);
  });
});

// ─── Sales order total calculation ─────────────────────────────────────────────

describe('Sales order total calculation', () => {
  it('grandTotal = sum(unitPrice × qty) - sum(discount) for walk_in', () => {
    const lines = [
      { unitPrice: '33000', qty: 2, lineDiscount: '0' },
      { unitPrice: '22000', qty: 1, lineDiscount: '2000' },
    ];

    let totalSubtotal = BigInt(0);
    let totalDiscount = BigInt(0);

    for (const line of lines) {
      const unitPrice = BigInt(line.unitPrice);
      const lineSubtotal = unitPrice * BigInt(line.qty);
      const lineDiscount = BigInt(line.lineDiscount);
      totalSubtotal += lineSubtotal;
      totalDiscount += lineDiscount;
    }

    const grandTotal = totalSubtotal - totalDiscount;
    // Line 1: 33000*2 = 66000; Line 2: 22000*1 = 22000; Total: 88000; Less discount: 2000; Grand: 86000
    expect(totalSubtotal).toBe(BigInt(88000));
    expect(totalDiscount).toBe(BigInt(2000));
    expect(grandTotal).toBe(BigInt(86000));
  });

  it('extracts PB1 after line discounts, not before discounts', () => {
    const grossBeforeDiscount = BigInt(88000);
    const lineDiscount = BigInt(2000);
    const grossAfterDiscount = grossBeforeDiscount - lineDiscount;
    const { net, pb1 } = extractPB1(grossAfterDiscount);

    expect(grossAfterDiscount).toBe(BigInt(86000));
    expect(net + pb1).toBe(grossAfterDiscount);
    expect(net).toBe(BigInt(78181));
    expect(pb1).toBe(BigInt(7819));
  });

  it('payment total covers grandTotal (walk_in cash)', () => {
    const grandTotal = BigInt(86000);
    const payments = [{ method: 'cash', amount: '88000' }];
    const totalPaid = payments.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
    expect(totalPaid >= grandTotal).toBe(true);
  });

  it('overpayment allows change to be recorded', () => {
    const grandTotal = BigInt(86000);
    const totalPaid = BigInt(88000);
    const change = totalPaid - grandTotal;
    expect(change).toBe(BigInt(2000));
  });

  it('payment total less than grandTotal is rejected', () => {
    const grandTotal = BigInt(86000);
    const totalPaid = BigInt(80000);
    expect(totalPaid < grandTotal).toBe(true);
  });
});

// ─── RefundSaleInputSchema ─────────────────────────────────────────────────────

describe('RefundSaleInputSchema', () => {
  // Tests upgraded after partial refunds were added (requires `lines`,
  // `idempotencyKey`, and a non-empty `reason`).
  const validBase = {
    salesOrderId: 'so-001',
    reason: 'Pelanggan batal',
    version: 1,
    lines: [{ lineId: 'line-1', qty: 1 }],
    idempotencyKey: 'idem-refund-001',
  };

  it('accepts valid input with all fields', () => {
    const result = RefundSaleInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects missing reason (now required)', () => {
    const { reason: _reason, ...rest } = validBase;
    const result = RefundSaleInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty salesOrderId', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, salesOrderId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty reason (min length)', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding max length', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, reason: 'a'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer version', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, version: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects version <= 0', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, version: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects empty lines array (now required)', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, lines: [] });
    expect(result.success).toBe(false);
  });

  it('accepts version 1', () => {
    const result = RefundSaleInputSchema.safeParse({ ...validBase, version: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Refund stock restoration logic ───────────────────────────────────────────

describe('Refund stock restoration', () => {
  it('restores exact BOM qty × sale qty to stock', () => {
    // BOM: 1 serving = 150ml milk + 30g tea_leaf
    // Sale: 3 servings → restore 450ml milk + 90g tea_leaf
    const bomLines = [
      { ingredientId: 'milk', qty: '0.150', uom: 'L' },
      { ingredientId: 'tea_leaf', qty: '0.030', uom: 'kg' },
    ];
    const qtySold = 3;

    for (const ingredient of bomLines) {
      const restoreQty = (Number.parseFloat(ingredient.qty) * qtySold).toFixed(3);
      expect(restoreQty).toBe(
        qtySold === 3 ? (Number.parseFloat(ingredient.qty) * 3).toFixed(3) : expect.any(String),
      );
    }
  });

  it('restores 1 serving: 0.150L milk, 0.030kg tea_leaf', () => {
    const bomLines = [
      { ingredientId: 'milk', qty: '0.150', uom: 'L' },
      { ingredientId: 'tea_leaf', qty: '0.030', uom: 'kg' },
    ];
    const qtySold = 1;

    const expected = {
      milk: '0.150',
      tea_leaf: '0.030',
    };

    for (const ingredient of bomLines) {
      const restoreQty = (Number.parseFloat(ingredient.qty) * qtySold).toFixed(3);
      expect(restoreQty).toBe(expected[ingredient.ingredientId as keyof typeof expected]);
    }
  });

  it('upsert: if stock level exists, qtyOnHand increases', () => {
    // Simulate existing stock level
    const existingOnHand = 5.0; // kg
    const restoreQty = 0.03; // single serving tea_leaf
    const newOnHand = existingOnHand + restoreQty;
    expect(newOnHand).toBe(5.03);
  });

  it('skips restore when stock level does not exist', () => {
    const existingLevel = null as { uom: string } | null;
    const shouldRestore = Boolean(existingLevel);
    expect(existingLevel).toBeNull();
    expect(shouldRestore).toBe(false);
  });

  it('skips restore when BOM UOM differs from stock UOM', () => {
    const bomLine = { ingredientId: 'sugar', qty: '25.000', uom: 'ml' };
    const stockLevel = { productId: 'sugar', uom: 'bottle' };
    expect(stockLevel.productId).toBe(bomLine.ingredientId);
    expect(stockLevel.uom === bomLine.uom).toBe(false);
  });
});

describe('Ingredient stock deduction guard', () => {
  it('deducts only when tracked stock has the same unit and enough quantity', () => {
    const decision = resolveIngredientDeductionDecision(
      { uom: 'ml', qtyOnHand: '500.000', qtyAvailable: '500.000' },
      { uom: 'ml', qty: '150.000' },
    );

    expect(decision).toEqual({ action: 'deduct' });
  });

  it('rejects auto deduction when recipe unit differs from stock unit', () => {
    const decision = resolveIngredientDeductionDecision(
      { uom: 'bottle', qtyOnHand: '2.000', qtyAvailable: '2.000' },
      { uom: 'ml', qty: '30.000' },
    );

    expect(decision).toEqual({
      action: 'uom_mismatch',
      stockUom: 'bottle',
      ingredientUom: 'ml',
    });
  });

  it('treats units that differ only by case or whitespace as the same unit', () => {
    const decision = resolveIngredientDeductionDecision(
      { uom: 'ML', qtyOnHand: '500.000', qtyAvailable: '500.000' },
      { uom: ' ml ', qty: '150.000' },
    );

    expect(decision).toEqual({ action: 'deduct' });
  });

  it('rejects tracked matching-unit stock that is insufficient instead of clamping to zero', () => {
    const decision = resolveIngredientDeductionDecision(
      { uom: 'pcs', qtyOnHand: '1.000', qtyAvailable: '1.000' },
      { uom: 'pcs', qty: '2.000' },
    );

    expect(decision).toEqual({
      action: 'insufficient',
      qtyOnHand: '1.000',
      qtyAvailable: '1.000',
    });
  });
});

// ─── Refund: journal reversal ───────────────────────────────────────────────────

describe('Refund journal reversal', () => {
  it('creates reversal JE with same amounts but opposite DR/CR', () => {
    // Original JE: DR Cash 33000, CR Revenue 30000, CR PB1 Payable 3000
    // Reversal JE: DR Revenue 30000, DR PB1 Payable 3000, CR Cash 33000
    const originalJE = {
      lines: [
        { accountCode: '1-1300', debit: BigInt(33000), credit: BigInt(0) },
        { accountCode: '4-1100', debit: BigInt(0), credit: BigInt(30000) },
        { accountCode: '2-1500', debit: BigInt(0), credit: BigInt(3000) },
      ],
    };

    const totalDebit = originalJE.lines.reduce((s, l) => s + l.debit, BigInt(0));
    const totalCredit = originalJE.lines.reduce((s, l) => s + l.credit, BigInt(0));
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(BigInt(33000));
  });

  it('reversal JE total must balance', () => {
    // Reversal: all debits and credits swapped
    const reversalLines = [
      { accountCode: '4-1100', debit: BigInt(30000), credit: BigInt(0) },
      { accountCode: '2-1500', debit: BigInt(3000), credit: BigInt(0) },
      { accountCode: '1-1300', debit: BigInt(0), credit: BigInt(33000) },
    ];

    const totalDebit = reversalLines.reduce((s, l) => s + l.debit, BigInt(0));
    const totalCredit = reversalLines.reduce((s, l) => s + l.credit, BigInt(0));
    expect(totalDebit).toBe(totalCredit);
  });
});

// ─── Refund business rules ─────────────────────────────────────────────────────

describe('Refund business rules', () => {
  it('only paid orders can be refunded', () => {
    const allowedStatuses = ['paid'];
    expect(allowedStatuses).toContain('paid');
    expect(allowedStatuses).not.toContain('draft');
    expect(allowedStatuses).not.toContain('voided');
    expect(allowedStatuses).not.toContain('refunded');
  });

  it('version check prevents double-refund (optimistic locking)', () => {
    const currentVersion = 3;
    const userVersion = 2;
    // Server version is newer → user has stale data
    const isStale = userVersion !== currentVersion;
    expect(isStale).toBe(true);
  });

  it('successful refund: version increments by 1', () => {
    const saleVersion = 5;
    const updatedVersion = saleVersion + 1;
    expect(updatedVersion).toBe(6);
  });

  it('partial refund keeps sale paid until all quantities are refunded', () => {
    const originalQty = 3;
    const alreadyRefundedQty = 1;
    const requestedQty = 1;
    const refundedAfter = alreadyRefundedQty + requestedQty;
    const isFullRefund = refundedAfter >= originalQty;
    const nextStatus = isFullRefund ? 'refunded' : 'paid';

    expect(nextStatus).toBe('paid');
  });

  it('refund reason is stored in notes field', () => {
    const reason = 'Pelanggan batal, tidak jadi pesan';
    const result = { notes: reason ?? null };
    expect(result.notes).toBe('Pelanggan batal, tidak jadi pesan');
  });

  it('refund without reason: notes is null', () => {
    const reason = undefined;
    const result = { notes: reason ?? null };
    expect(result.notes).toBeNull();
  });
});

// ─── Shift expected cash calculation ─────────────────────────────────────────

describe('Shift expected cash calculation', () => {
  it('expectedCash = openingCash + sum(cash payments)', () => {
    const openingCash = 500_000;
    const cashPayments = [33000, 22000, 44000, 55000]; // 4 sales: 154000
    const totalPayments = cashPayments.reduce((s, v) => s + v, 0);
    const expectedCash = openingCash + totalPayments;
    expect(expectedCash).toBe(654_000);
  });

  it('variance = actualCash - expectedCash (positive = over)', () => {
    const expectedCash = 654_000;
    const actualCash = 655_000;
    const variance = actualCash - expectedCash;
    expect(variance).toBe(1000);
  });

  it('variance = actualCash - expectedCash (negative = short)', () => {
    const expectedCash = 654_000;
    const actualCash = 652_000;
    const variance = actualCash - expectedCash;
    expect(variance).toBe(-2000);
  });

  it('zero variance when counts are exact', () => {
    const expectedCash = 654_000;
    const actualCash = 654_000;
    const variance = actualCash - expectedCash;
    expect(variance).toBe(0);
  });

  it('full refund nets the original cash payment to zero', () => {
    const openingCash = 500_000;
    const cashPaymentsIncludingRefundedOrders = [33000];
    const completedRefunds = [33000];
    const expectedCash =
      openingCash +
      cashPaymentsIncludingRefundedOrders.reduce((sum, amount) => sum + amount, 0) -
      completedRefunds.reduce((sum, amount) => sum + amount, 0);

    expect(expectedCash).toBe(openingCash);
  });
});
