/**
 * Money type — bigint in rupiah (no decimals). SD §7.8 / P7.
 *
 * IDR has no sub-unit in daily use. All monetary values stored as
 * whole rupiah in bigint. Never use `number` for money.
 */

export type Money = bigint;

/** Parse a number or locale-formatted string to Money. */
export const rupiah = (n: number | string): Money =>
  BigInt(typeof n === 'string' ? n.replace(/\D/g, '') : Math.round(n));

/** Format Money as localized IDR string. */
export const formatRupiah = (m: Money, locale = 'id-ID'): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(m));

// --- Constants ---

export const ZERO: Money = 0n;

// --- Arithmetic ---

export const add = (a: Money, b: Money): Money => a + b;
export const subtract = (a: Money, b: Money): Money => a - b;

/** Multiply money by a scalar (quantity, rate). Rounds to nearest rupiah. */
export const multiply = (amount: Money, factor: number): Money =>
  BigInt(Math.round(Number(amount) * factor));

/**
 * Divide money by a divisor. Rounds to nearest rupiah.
 * Throws if divisor is zero.
 */
export const divide = (amount: Money, divisor: number): Money => {
  if (divisor === 0) throw new Error('Cannot divide money by zero');
  return BigInt(Math.round(Number(amount) / divisor));
};

/** Sum an array of Money values. Returns ZERO for empty arrays. */
export const sum = (amounts: readonly Money[]): Money =>
  amounts.reduce<Money>((acc, m) => acc + m, ZERO);

/** Absolute value. */
export const abs = (m: Money): Money => (m < 0n ? -m : m);

/** Negate a Money value. */
export const negate = (m: Money): Money => -m;

// --- Guards ---

export const isZero = (m: Money): boolean => m === 0n;
export const isPositive = (m: Money): boolean => m > 0n;
export const isNegative = (m: Money): boolean => m < 0n;

// --- Comparison ---

export const min = (a: Money, b: Money): Money => (a < b ? a : b);
export const max = (a: Money, b: Money): Money => (a > b ? a : b);
export const equals = (a: Money, b: Money): boolean => a === b;

// --- Tax helpers (PB1 inclusive) ---

/**
 * Extract tax from an inclusive price.
 * E.g. PB1 10% inclusive: rateBps = 1000 → tax = price * 1000 / (10000 + 1000)
 *
 * @param inclusivePrice — price already including tax
 * @param rateBps — tax rate in basis points (10% = 1000, 11% = 1100)
 * @returns tax amount in rupiah (rounded)
 */
export const extractInclusiveTax = (inclusivePrice: Money, rateBps: number): Money =>
  BigInt(Math.round((Number(inclusivePrice) * rateBps) / (10_000 + rateBps)));

/**
 * Calculate tax on top of a base price (exclusive).
 *
 * @param basePrice — price before tax
 * @param rateBps — tax rate in basis points
 * @returns tax amount in rupiah (rounded)
 */
export const calculateExclusiveTax = (basePrice: Money, rateBps: number): Money =>
  BigInt(Math.round((Number(basePrice) * rateBps) / 10_000));
