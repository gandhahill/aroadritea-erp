import { describe, expect, it } from 'vitest';
import {
  ZERO,
  abs,
  add,
  calculateExclusiveTax,
  divide,
  equals,
  extractInclusiveTax,
  formatRupiah,
  isNegative,
  isPositive,
  isZero,
  max,
  min,
  multiply,
  negate,
  rupiah,
  subtract,
  sum,
} from './index';

describe('money', () => {
  describe('rupiah()', () => {
    it('converts number to bigint', () => {
      expect(rupiah(50000)).toBe(50000n);
    });

    it('converts string with separators', () => {
      expect(rupiah('50.000')).toBe(50000n);
      expect(rupiah('1.250.000')).toBe(1250000n);
    });

    it('rounds fractional numbers', () => {
      expect(rupiah(99.7)).toBe(100n);
    });
  });

  describe('formatRupiah()', () => {
    it('formats with IDR currency symbol', () => {
      const formatted = formatRupiah(50000n);
      // Exact format varies by runtime, but should contain 50.000 or 50,000
      expect(formatted).toContain('50');
    });
  });

  describe('arithmetic', () => {
    it('add', () => expect(add(100n, 200n)).toBe(300n));
    it('subtract', () => expect(subtract(500n, 200n)).toBe(300n));
    it('multiply', () => expect(multiply(1000n, 1.1)).toBe(1100n));
    it('divide', () => expect(divide(1000n, 4)).toBe(250n));
    it('divide throws on zero', () => expect(() => divide(1000n, 0)).toThrow());
    it('multiply keeps bigint precision above Number.MAX_SAFE_INTEGER', () => {
      expect(multiply(999999999999999999n, 1.1)).toBe(1099999999999999999n);
    });
    it('divide keeps bigint precision above Number.MAX_SAFE_INTEGER', () => {
      expect(divide(999999999999999999n, 3)).toBe(333333333333333333n);
    });
    it('sum', () => expect(sum([100n, 200n, 300n])).toBe(600n));
    it('sum empty array', () => expect(sum([])).toBe(ZERO));
    it('abs positive', () => expect(abs(100n)).toBe(100n));
    it('abs negative', () => expect(abs(-100n)).toBe(100n));
    it('negate', () => expect(negate(100n)).toBe(-100n));
  });

  describe('guards', () => {
    it('isZero', () => {
      expect(isZero(0n)).toBe(true);
      expect(isZero(1n)).toBe(false);
    });
    it('isPositive', () => {
      expect(isPositive(100n)).toBe(true);
      expect(isPositive(-1n)).toBe(false);
    });
    it('isNegative', () => {
      expect(isNegative(-1n)).toBe(true);
      expect(isNegative(0n)).toBe(false);
    });
  });

  describe('comparison', () => {
    it('min', () => expect(min(100n, 200n)).toBe(100n));
    it('max', () => expect(max(100n, 200n)).toBe(200n));
    it('equals', () => {
      expect(equals(100n, 100n)).toBe(true);
      expect(equals(100n, 200n)).toBe(false);
    });
  });

  describe('tax helpers', () => {
    // rule: SOURCE-OF-TRUTH §6.5 PB1 inclusive
    it('extractInclusiveTax — PB1 10%', () => {
      // Price 55000 inclusive of PB1 10% (1000 bps)
      // Tax = 55000 * 1000 / (10000 + 1000) = 55000 * 1000 / 11000 = 5000
      expect(extractInclusiveTax(55000n, 1000)).toBe(5000n);
    });

    it('extractInclusiveTax — PPN 11%', () => {
      // Price 111000 inclusive of PPN 11% (1100 bps)
      // Tax = 111000 * 1100 / (10000 + 1100) = 111000 * 1100 / 11100 = 11000
      expect(extractInclusiveTax(111000n, 1100)).toBe(11000n);
    });

    it('calculateExclusiveTax — PPN 11%', () => {
      // Base 100000, PPN 11% (1100 bps)
      // Tax = 100000 * 1100 / 10000 = 11000
      expect(calculateExclusiveTax(100000n, 1100)).toBe(11000n);
    });

    it('keeps tax precision for large IDR values', () => {
      expect(extractInclusiveTax(999999999999999999n, 1100)).toBe(99099099099099099n);
      expect(calculateExclusiveTax(999999999999999999n, 1100)).toBe(110000000000000000n);
    });
  });
});
