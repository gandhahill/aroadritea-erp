/**
 * Tests for GRN (Goods Receipt Note) services — T-0065
 *
 * Schema validation + pure computation tests.
 */

import { describe, it, expect } from 'vitest';
import {
  CreateGRNInputSchema,
  GRNLineInputSchema,
  ConfirmGRNInputSchema,
} from '../src/purchasing/grn-schemas';

// ─── GRNLineInputSchema ─────────────────────────────────────────────────────

describe('GRNLineInputSchema', () => {
  it('accepts valid line with all fields', () => {
    const input = {
      poLineId: 'pol-001',
      productId: 'prod-001',
      variantId: 'var-001',
      qtyReceived: '10.000',
      uom: 'kg',
      batchNo: 'BATCH-2026-05',
      expiryDate: '2026-08-15',
      notes: 'Good condition',
    };
    const result = GRNLineInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts line without optional fields', () => {
    const input = {
      poLineId: 'pol-001',
      productId: 'prod-001',
      qtyReceived: '5',
      uom: 'pcs',
    };
    const result = GRNLineInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts integer qty', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: 'p1',
      qtyReceived: '100',
      uom: 'pcs',
    });
    expect(result.success).toBe(true);
  });

  it('accepts decimal qty up to 3 places', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: 'p1',
      qtyReceived: '10.500',
      uom: 'kg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects qty with 4+ decimals', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: 'p1',
      qtyReceived: '10.1234',
      uom: 'kg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative qty', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: 'p1',
      qtyReceived: '-5',
      uom: 'kg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty poLineId', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: '',
      productId: 'p1',
      qtyReceived: '5',
      uom: 'pcs',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty productId', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: '',
      qtyReceived: '5',
      uom: 'pcs',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid expiryDate format', () => {
    const result = GRNLineInputSchema.safeParse({
      poLineId: 'pol-001',
      productId: 'p1',
      qtyReceived: '5',
      uom: 'pcs',
      expiryDate: '15-08-2026',
    });
    expect(result.success).toBe(false);
  });
});

// ─── CreateGRNInputSchema ───────────────────────────────────────────────────

describe('CreateGRNInputSchema', () => {
  const validLine = {
    poLineId: 'pol-001',
    productId: 'prod-001',
    qtyReceived: '10',
    uom: 'kg',
  };

  it('accepts valid GRN with all fields', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [validLine],
      notes: 'First delivery',
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts GRN without optional fields', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [validLine],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts GRN with multiple lines', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [
        { ...validLine, poLineId: 'pol-001' },
        { ...validLine, poLineId: 'pol-002', productId: 'prod-002' },
      ],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines).toHaveLength(2);
    }
  });

  it('rejects empty lines array', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty purchaseOrderId', () => {
    const input = {
      purchaseOrderId: '',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [validLine],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '11-05-2026',
      lines: [validLine],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('validates nested line errors', () => {
    const input = {
      purchaseOrderId: 'po-001',
      locationId: 'loc-mli',
      receivedDate: '2026-05-11',
      lines: [{ poLineId: '', productId: '', qtyReceived: '-1', uom: '' }],
    };
    const result = CreateGRNInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ─── ConfirmGRNInputSchema ──────────────────────────────────────────────────

describe('ConfirmGRNInputSchema', () => {
  it('accepts valid grnId', () => {
    const result = ConfirmGRNInputSchema.safeParse({ grnId: 'grn-001' });
    expect(result.success).toBe(true);
  });

  it('rejects empty grnId', () => {
    const result = ConfirmGRNInputSchema.safeParse({ grnId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing grnId', () => {
    const result = ConfirmGRNInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── GRN Number format ──────────────────────────────────────────────────────

describe('GRN Number format', () => {
  it('follows GRN-YYYY-MM-NNNN pattern', () => {
    const pattern = /^GRN-\d{4}-\d{2}-\d{4}$/;
    expect(pattern.test('GRN-2026-05-0001')).toBe(true);
    expect(pattern.test('GRN-2026-12-0099')).toBe(true);
  });

  it('rejects invalid GRN number formats', () => {
    const pattern = /^GRN-\d{4}-\d{2}-\d{4}$/;
    expect(pattern.test('GRN-2026-5-0001')).toBe(false);
    expect(pattern.test('PO-2026-05-0001')).toBe(false);
    expect(pattern.test('GRN-2026-05-001')).toBe(false);
  });
});

// ─── GRN qty remaining computation ─────────────────────────────────────────

describe('GRN qty remaining computation', () => {
  function computeRemaining(qtyOrdered: string, qtyReceived: string): number {
    return parseFloat(qtyOrdered) - parseFloat(qtyReceived);
  }

  it('full remaining when nothing received', () => {
    expect(computeRemaining('100.000', '0')).toBeCloseTo(100.0);
  });

  it('partial remaining', () => {
    expect(computeRemaining('100.000', '60.000')).toBeCloseTo(40.0);
  });

  it('zero remaining when fully received', () => {
    expect(computeRemaining('100.000', '100.000')).toBeCloseTo(0.0);
  });

  it('decimal remaining', () => {
    expect(computeRemaining('10.500', '7.250')).toBeCloseTo(3.25);
  });
});

// ─── PO status after GRN ────────────────────────────────────────────────────

describe('PO status after GRN confirmation', () => {
  function determinePOStatus(
    poLines: Array<{ qtyOrdered: string; qtyReceived: string }>,
  ): 'partial' | 'received' {
    const allFullyReceived = poLines.every(
      (l) => parseFloat(l.qtyReceived) >= parseFloat(l.qtyOrdered) - 0.001,
    );
    return allFullyReceived ? 'received' : 'partial';
  }

  it('partial when one line not fully received', () => {
    const lines = [
      { qtyOrdered: '100', qtyReceived: '100' },
      { qtyOrdered: '50', qtyReceived: '30' },
    ];
    expect(determinePOStatus(lines)).toBe('partial');
  });

  it('received when all lines fully received', () => {
    const lines = [
      { qtyOrdered: '100', qtyReceived: '100' },
      { qtyOrdered: '50', qtyReceived: '50' },
    ];
    expect(determinePOStatus(lines)).toBe('received');
  });

  it('received with floating point tolerance', () => {
    const lines = [
      { qtyOrdered: '10.500', qtyReceived: '10.500' },
    ];
    expect(determinePOStatus(lines)).toBe('received');
  });

  it('partial when no lines received', () => {
    const lines = [
      { qtyOrdered: '100', qtyReceived: '0' },
    ];
    expect(determinePOStatus(lines)).toBe('partial');
  });

  it('partial with one line zero received', () => {
    const lines = [
      { qtyOrdered: '100', qtyReceived: '100' },
      { qtyOrdered: '50', qtyReceived: '0' },
    ];
    expect(determinePOStatus(lines)).toBe('partial');
  });
});

// ─── GRN JE computation ────────────────────────────────────────────────────

describe('GRN JE total value computation', () => {
  function computeTotalValue(
    lines: Array<{ qtyReceived: string; unitPrice: bigint }>,
  ): bigint {
    let total = 0n;
    for (const line of lines) {
      const qty = BigInt(Math.round(parseFloat(line.qtyReceived) * 1000));
      total += (qty * line.unitPrice) / 1000n;
    }
    return total;
  }

  it('single line integer qty', () => {
    const result = computeTotalValue([
      { qtyReceived: '10', unitPrice: 25000n },
    ]);
    expect(result).toBe(250000n);
  });

  it('single line decimal qty', () => {
    const result = computeTotalValue([
      { qtyReceived: '10.500', unitPrice: 25000n },
    ]);
    expect(result).toBe(262500n);
  });

  it('multiple lines', () => {
    const result = computeTotalValue([
      { qtyReceived: '10', unitPrice: 25000n },
      { qtyReceived: '5', unitPrice: 15000n },
    ]);
    expect(result).toBe(325000n);
  });

  it('zero qty produces zero', () => {
    const result = computeTotalValue([
      { qtyReceived: '0', unitPrice: 25000n },
    ]);
    expect(result).toBe(0n);
  });
});
