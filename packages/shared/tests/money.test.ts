import { describe, expect, it } from 'vitest';
import {
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
  ZERO,
} from '../src/money';

describe('rupiah / formatRupiah', () => {
  it('parses numbers and locale-formatted strings', () => {
    expect(rupiah(12345)).toBe(12345n);
    expect(rupiah('Rp 12.345')).toBe(12345n);
  });

  it('formats as IDR with no decimals', () => {
    const formatted = formatRupiah(12345n).replace(/ /g, ' ');
    expect(formatted).toContain('12.345');
    expect(formatted).toContain('Rp');
  });
});

describe('arithmetic', () => {
  it('add/subtract/negate/abs', () => {
    expect(add(100n, 50n)).toBe(150n);
    expect(subtract(100n, 50n)).toBe(50n);
    expect(negate(50n)).toBe(-50n);
    expect(abs(-50n)).toBe(50n);
  });

  it('sum returns ZERO for empty arrays', () => {
    expect(sum([])).toBe(ZERO);
    expect(sum([100n, 200n, 300n])).toBe(600n);
  });

  it('guards and comparisons', () => {
    expect(isZero(0n)).toBe(true);
    expect(isPositive(1n)).toBe(true);
    expect(isNegative(-1n)).toBe(true);
    expect(min(10n, 20n)).toBe(10n);
    expect(max(10n, 20n)).toBe(20n);
    expect(equals(10n, 10n)).toBe(true);
  });
});

describe('multiply / divide rounding', () => {
  it('multiply rounds to nearest rupiah (half rounds away from zero)', () => {
    // 100,005 * 0.5 = 50,002.5 -> rounds up to 50,003
    expect(multiply(100_005n, 0.5)).toBe(50_003n);
    // 100,004 * 0.5 = 50,002 -> exact
    expect(multiply(100_004n, 0.5)).toBe(50_002n);
  });

  it('divide rounds to nearest rupiah', () => {
    // 100 / 3 = 33.33... -> 33
    expect(divide(100n, 3)).toBe(33n);
    // 200 / 3 = 66.66... -> 67
    expect(divide(200n, 3)).toBe(67n);
  });

  it('divide throws on zero divisor', () => {
    expect(() => divide(100n, 0)).toThrow();
  });
});

describe('calculateExclusiveTax (PB1/PPN on top of base price)', () => {
  it('rounds half up — does not truncate like plain integer division', () => {
    // 123,456 @ 10% = 12,345.6 -> rounds up to 12,346 (plain division truncates to 12,345)
    expect(calculateExclusiveTax(123_456n, 1000)).toBe(12_346n);
  });

  it('rounds down when remainder is below half', () => {
    // 123,454 @ 10% = 12,345.4 -> rounds down to 12,345
    expect(calculateExclusiveTax(123_454n, 1000)).toBe(12_345n);
  });

  it('returns zero for a zero rate', () => {
    expect(calculateExclusiveTax(100_000n, 0)).toBe(0n);
  });
});

describe('extractInclusiveTax (PB1 10% inclusive)', () => {
  it('extracts the embedded tax from an inclusive price', () => {
    // Rp 110,000 inclusive of 10% PB1 -> tax = 110,000 * 1000 / 11000 = 10,000
    expect(extractInclusiveTax(110_000n, 1000)).toBe(10_000n);
  });

  it('rounds to the nearest rupiah', () => {
    // Rp 11,000 inclusive of 10% -> 11,000 * 1000 / 11000 = 1,000 exactly
    expect(extractInclusiveTax(11_000n, 1000)).toBe(1_000n);
    // Rp 11,001 inclusive of 10% -> 11,001,000 / 11,000 = 1,000.09 -> 1,000
    expect(extractInclusiveTax(11_001n, 1000)).toBe(1_000n);
  });
});
