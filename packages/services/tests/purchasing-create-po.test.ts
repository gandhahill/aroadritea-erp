/**
 * Tests for purchasing services — T-0064
 *
 * Schema validation + pure computation tests.
 * Integration tests (DB) run via full test harness.
 */

import { describe, it, expect } from 'vitest';
import {
  CreatePOInputSchema,
  POLineInputSchema,
  SubmitPOInputSchema,
  ApprovePOInputSchema,
  CancelPOInputSchema,
} from '../src/purchasing/schemas';

// ─── POLineInputSchema ──────────────────────────────────────────────────────

describe('POLineInputSchema', () => {
  it('accepts valid line with all fields', () => {
    const input = {
      productId: 'prod-001',
      variantId: 'var-001',
      qtyOrdered: '10.000',
      uom: 'kg',
      unitPrice: '25000',
      taxCode: 'PPN-11',
    };
    const result = POLineInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts line without optional fields', () => {
    const input = {
      productId: 'prod-001',
      qtyOrdered: '5',
      uom: 'pcs',
      unitPrice: '10000',
    };
    const result = POLineInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts integer qty', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '100',
      uom: 'pcs',
      unitPrice: '5000',
    });
    expect(result.success).toBe(true);
  });

  it('accepts decimal qty up to 3 places', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '10.500',
      uom: 'kg',
      unitPrice: '5000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects qty with 4+ decimals', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '10.1234',
      uom: 'kg',
      unitPrice: '5000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative qty', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '-5',
      uom: 'kg',
      unitPrice: '5000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty productId', () => {
    const result = POLineInputSchema.safeParse({
      productId: '',
      qtyOrdered: '5',
      uom: 'pcs',
      unitPrice: '10000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty uom', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '5',
      uom: '',
      unitPrice: '10000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative unitPrice', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '5',
      uom: 'kg',
      unitPrice: '-1000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects decimal unitPrice', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '5',
      uom: 'kg',
      unitPrice: '1000.50',
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero unitPrice', () => {
    const result = POLineInputSchema.safeParse({
      productId: 'p1',
      qtyOrdered: '5',
      uom: 'kg',
      unitPrice: '0',
    });
    expect(result.success).toBe(true);
  });
});

// ─── CreatePOInputSchema ────────────────────────────────────────────────────

describe('CreatePOInputSchema', () => {
  const validLine = {
    productId: 'prod-001',
    qtyOrdered: '10',
    uom: 'kg',
    unitPrice: '25000',
  };

  it('accepts valid PO with all fields', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      expectedDate: '2026-05-20',
      lines: [validLine],
      notes: 'Monthly tea leaf order',
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts PO without optional fields', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      lines: [validLine],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts PO with multiple lines', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      lines: [
        { ...validLine, productId: 'prod-001' },
        { ...validLine, productId: 'prod-002', unitPrice: '15000' },
        { ...validLine, productId: 'prod-003', qtyOrdered: '5.500' },
      ],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines).toHaveLength(3);
    }
  });

  it('rejects empty lines array', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      lines: [],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty supplierId', () => {
    const input = {
      supplierId: '',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      lines: [validLine],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty locationId', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: '',
      orderDate: '2026-05-11',
      lines: [validLine],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '11-05-2026',
      lines: [validLine],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid expectedDate format', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      expectedDate: '20-May-2026',
      lines: [validLine],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('validates nested line errors', () => {
    const input = {
      supplierId: 'sup-001',
      locationId: 'loc-mli',
      orderDate: '2026-05-11',
      lines: [{ productId: '', qtyOrdered: '-1', uom: '', unitPrice: 'abc' }],
    };
    const result = CreatePOInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── Workflow Schemas ───────────────────────────────────────────────────────

describe('SubmitPOInputSchema', () => {
  it('accepts valid poId', () => {
    const result = SubmitPOInputSchema.safeParse({ poId: 'po-001' });
    expect(result.success).toBe(true);
  });

  it('rejects empty poId', () => {
    const result = SubmitPOInputSchema.safeParse({ poId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing poId', () => {
    const result = SubmitPOInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('ApprovePOInputSchema', () => {
  it('accepts valid poId', () => {
    const result = ApprovePOInputSchema.safeParse({ poId: 'po-001' });
    expect(result.success).toBe(true);
  });

  it('rejects empty poId', () => {
    const result = ApprovePOInputSchema.safeParse({ poId: '' });
    expect(result.success).toBe(false);
  });
});

describe('CancelPOInputSchema', () => {
  it('accepts valid cancel input', () => {
    const result = CancelPOInputSchema.safeParse({
      poId: 'po-001',
      reason: 'Supplier unable to deliver',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty reason', () => {
    const result = CancelPOInputSchema.safeParse({
      poId: 'po-001',
      reason: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const result = CancelPOInputSchema.safeParse({
      poId: 'po-001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing poId', () => {
    const result = CancelPOInputSchema.safeParse({
      reason: 'Some reason',
    });
    expect(result.success).toBe(false);
  });
});

// ─── PO Number Format ───────────────────────────────────────────────────────

describe('PO Number format', () => {
  it('follows PO-YYYY-MM-NNNN pattern', () => {
    const pattern = /^PO-\d{4}-\d{2}-\d{4}$/;
    expect(pattern.test('PO-2026-05-0001')).toBe(true);
    expect(pattern.test('PO-2026-12-0099')).toBe(true);
    expect(pattern.test('PO-2026-05-1234')).toBe(true);
  });

  it('rejects invalid PO number formats', () => {
    const pattern = /^PO-\d{4}-\d{2}-\d{4}$/;
    expect(pattern.test('PO-2026-5-0001')).toBe(false);
    expect(pattern.test('PO-26-05-0001')).toBe(false);
    expect(pattern.test('PO-2026-05-001')).toBe(false);
    expect(pattern.test('INV-2026-05-0001')).toBe(false);
  });
});

// ─── Line computation (pure math) ──────────────────────────────────────────

describe('PO line computation (bigint)', () => {
  function computeLineSubtotal(qtyOrdered: string, unitPrice: string): bigint {
    const qty = BigInt(Math.round(parseFloat(qtyOrdered) * 1000));
    const price = BigInt(unitPrice);
    return (qty * price) / 1000n;
  }

  it('integer qty × price', () => {
    expect(computeLineSubtotal('10', '25000')).toBe(250000n);
  });

  it('decimal qty × price', () => {
    expect(computeLineSubtotal('10.500', '25000')).toBe(262500n);
  });

  it('single unit × price', () => {
    expect(computeLineSubtotal('1', '150000')).toBe(150000n);
  });

  it('large qty × small price', () => {
    expect(computeLineSubtotal('1000', '100')).toBe(100000n);
  });

  it('zero qty', () => {
    expect(computeLineSubtotal('0', '25000')).toBe(0n);
  });

  it('zero price', () => {
    expect(computeLineSubtotal('10', '0')).toBe(0n);
  });

  it('fractional qty rounds correctly', () => {
    // 2.5 × 30000 = 75000
    expect(computeLineSubtotal('2.500', '30000')).toBe(75000n);
  });
});

describe('PO tax computation (bigint)', () => {
  function computeExclusiveTax(subtotal: bigint, rateBps: number): bigint {
    return (subtotal * BigInt(rateBps)) / 10000n;
  }

  function computeInclusiveTax(subtotal: bigint, rateBps: number): bigint {
    return (subtotal * BigInt(rateBps)) / BigInt(10000 + rateBps);
  }

  it('PPN 11% exclusive on 100000', () => {
    const tax = computeExclusiveTax(100000n, 1100);
    expect(tax).toBe(11000n);
  });

  it('PPN 11% exclusive on 250000', () => {
    const tax = computeExclusiveTax(250000n, 1100);
    expect(tax).toBe(27500n);
  });

  it('PB1 10% inclusive on 100000', () => {
    const tax = computeInclusiveTax(100000n, 1000);
    // 100000 × 1000 / 11000 = 9090 (truncated)
    expect(tax).toBe(9090n);
  });

  it('zero rate produces zero tax', () => {
    expect(computeExclusiveTax(100000n, 0)).toBe(0n);
    expect(computeInclusiveTax(100000n, 0)).toBe(0n);
  });

  it('PPN 12% exclusive on 500000', () => {
    const tax = computeExclusiveTax(500000n, 1200);
    expect(tax).toBe(60000n);
  });
});

describe('PO total computation', () => {
  it('sums subtotals correctly', () => {
    const lineSubtotals = [250000n, 150000n, 75000n];
    const subtotal = lineSubtotals.reduce((sum, l) => sum + l, 0n);
    expect(subtotal).toBe(475000n);
  });

  it('grandTotal = subtotal + taxTotal', () => {
    const subtotal = 475000n;
    const taxTotal = 52250n; // 11% of 475000
    const grandTotal = subtotal + taxTotal;
    expect(grandTotal).toBe(527250n);
  });
});

// ─── State transition rules ─────────────────────────────────────────────────

describe('PO state transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'cancelled'],
    approved: ['partial', 'received', 'closed', 'cancelled'],
    partial: ['received', 'closed'],
    received: ['closed'],
    closed: [],
    cancelled: [],
  };

  it('draft can transition to submitted', () => {
    expect(VALID_TRANSITIONS['draft']).toContain('submitted');
  });

  it('submitted can transition to approved', () => {
    expect(VALID_TRANSITIONS['submitted']).toContain('approved');
  });

  it('draft cannot transition to approved directly', () => {
    expect(VALID_TRANSITIONS['draft']).not.toContain('approved');
  });

  it('closed cannot transition anywhere', () => {
    expect(VALID_TRANSITIONS['closed']).toHaveLength(0);
  });

  it('cancelled cannot transition anywhere', () => {
    expect(VALID_TRANSITIONS['cancelled']).toHaveLength(0);
  });

  it('all statuses can be cancelled except closed, cancelled, received', () => {
    const cancellable = ['draft', 'submitted', 'approved'];
    for (const status of cancellable) {
      expect(VALID_TRANSITIONS[status]).toContain('cancelled');
    }
    expect(VALID_TRANSITIONS['closed']).not.toContain('cancelled');
    expect(VALID_TRANSITIONS['cancelled']).not.toContain('cancelled');
    expect(VALID_TRANSITIONS['received']).not.toContain('cancelled');
  });
});
