/**
 * Tests for tax.calculateTax + tax.calculateLineTaxes — T-0019c
 */

import { describe, it, expect } from 'vitest';
import { calculateTax, calculateLineTaxes } from '../src/tax/calculate';

describe('calculateTax', () => {
  // ---------------------------------------------------------------
  // Inclusive (PB1) — SD §19.2
  // ---------------------------------------------------------------

  describe('inclusive (PB1)', () => {
    it('should extract PB1 10% from gross Rp 33.000', () => {
      // gross = 33000, rate = 10% (1000 bps)
      // taxBase = 33000 * 10000 / 11000 = 30000
      // taxAmount = 33000 - 30000 = 3000
      const result = calculateTax({
        grossAmount: 33000n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxBase).toBe(30000n);
        expect(result.value.taxAmount).toBe(3000n);
        expect(result.value.totalAmount).toBe(33000n); // inclusive: total = gross
      }
    });

    it('should handle Rp 11.000 inclusive 10%', () => {
      const result = calculateTax({
        grossAmount: 11000n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxBase).toBe(10000n);
        expect(result.value.taxAmount).toBe(1000n);
      }
    });

    it('should handle rounding for non-divisible amounts', () => {
      // 10001 * 10000 / 11000 = 9092 (integer division)
      // tax = 10001 - 9092 = 909
      const result = calculateTax({
        grossAmount: 10001n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify that taxBase + taxAmount = grossAmount
        expect(result.value.taxBase + result.value.taxAmount).toBe(10001n);
      }
    });

    it('should handle zero amount', () => {
      const result = calculateTax({
        grossAmount: 0n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxBase).toBe(0n);
        expect(result.value.taxAmount).toBe(0n);
        expect(result.value.totalAmount).toBe(0n);
      }
    });

    it('should handle large amounts (Rp 100.000.000)', () => {
      const result = calculateTax({
        grossAmount: 100_000_000n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // taxBase = 100M * 10000 / 11000 ≈ 90909090
        expect(result.value.taxBase + result.value.taxAmount).toBe(100_000_000n);
        expect(result.value.taxAmount).toBeGreaterThan(0n);
      }
    });
  });

  // ---------------------------------------------------------------
  // Exclusive (PPN) — standard add-on tax
  // ---------------------------------------------------------------

  describe('exclusive (PPN)', () => {
    it('should add PPN 11% on top of Rp 100.000', () => {
      // taxAmount = 100000 * 1100 / 10000 = 11000
      const result = calculateTax({
        grossAmount: 100_000n,
        rateBps: 1100,
        calculation: 'exclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxBase).toBe(100_000n);
        expect(result.value.taxAmount).toBe(11000n);
        expect(result.value.totalAmount).toBe(111_000n);
      }
    });

    it('should calculate PPh 23 at 2%', () => {
      const result = calculateTax({
        grossAmount: 500_000n,
        rateBps: 200,
        calculation: 'exclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxAmount).toBe(10_000n);
        expect(result.value.totalAmount).toBe(510_000n);
      }
    });

    it('should handle 0.5% rate (PPh 25 UMKM)', () => {
      const result = calculateTax({
        grossAmount: 1_000_000n,
        rateBps: 50,
        calculation: 'exclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxAmount).toBe(5_000n);
        expect(result.value.totalAmount).toBe(1_005_000n);
      }
    });

    it('should handle zero amount', () => {
      const result = calculateTax({
        grossAmount: 0n,
        rateBps: 1100,
        calculation: 'exclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxAmount).toBe(0n);
        expect(result.value.totalAmount).toBe(0n);
      }
    });
  });

  // ---------------------------------------------------------------
  // Zero rate
  // ---------------------------------------------------------------

  describe('zero rate', () => {
    it('should return zero tax for 0 bps', () => {
      const result = calculateTax({
        grossAmount: 50_000n,
        rateBps: 0,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taxAmount).toBe(0n);
        expect(result.value.taxBase).toBe(50_000n);
        expect(result.value.totalAmount).toBe(50_000n);
      }
    });
  });

  // ---------------------------------------------------------------
  // Validation errors
  // ---------------------------------------------------------------

  describe('validation', () => {
    it('should reject negative rate', () => {
      const result = calculateTax({
        grossAmount: 10000n,
        rateBps: -100,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.messageKey).toBe('tax.calculate.negativeRate');
      }
    });

    it('should reject negative amount', () => {
      const result = calculateTax({
        grossAmount: -10000n,
        rateBps: 1000,
        calculation: 'inclusive',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.messageKey).toBe('tax.calculate.negativeAmount');
      }
    });
  });
});

describe('calculateLineTaxes', () => {
  it('should calculate PB1 for a single-tax line', () => {
    const result = calculateLineTaxes({
      grossAmount: 33000n,
      taxes: [
        {
          taxCode: 'PB1',
          rateBps: 1000,
          calculation: 'inclusive',
          postingAccountId: 'acc-pb1',
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].taxCode).toBe('PB1');
      expect(result.value[0].taxAmount).toBe(3000n);
      expect(result.value[0].postingAccountId).toBe('acc-pb1');
    }
  });

  it('should calculate multiple taxes for a line', () => {
    const result = calculateLineTaxes({
      grossAmount: 100_000n,
      taxes: [
        {
          taxCode: 'PB1',
          rateBps: 1000,
          calculation: 'inclusive',
          postingAccountId: 'acc-pb1',
        },
        {
          taxCode: 'PPN_OUT',
          rateBps: 1100,
          calculation: 'exclusive',
          postingAccountId: 'acc-ppn',
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].taxCode).toBe('PB1');
      expect(result.value[1].taxCode).toBe('PPN_OUT');
    }
  });

  it('should return empty array for no taxes', () => {
    const result = calculateLineTaxes({
      grossAmount: 50000n,
      taxes: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it('should propagate validation error from calculateTax', () => {
    const result = calculateLineTaxes({
      grossAmount: -1000n,
      taxes: [
        {
          taxCode: 'PB1',
          rateBps: 1000,
          calculation: 'inclusive',
          postingAccountId: 'acc-pb1',
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
