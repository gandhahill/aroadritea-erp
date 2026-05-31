/**
 * Money — BigInt arithmetic helpers.
 *
 * All monetary values in the ERP are stored as bigint (IDR, no decimals).
 * These helpers avoid lossy Number() conversions when scaling or
 * apportioning money amounts.
 */

/**
 * Multiply a bigint value by a rational fraction (numerator / denominator)
 * without intermediate floating-point conversion.
 *
 * Example – 60% of 1 000 000:
 *   scaleBigInt(1_000_000n, 60n, 100n) → 600_000n
 *
 * The result truncates toward zero (standard BigInt division).
 * Callers that need banker's rounding should add (denominator / 2n)
 * to the numerator product before dividing.
 */
export function scaleBigInt(value: bigint, numerator: bigint, denominator: bigint): bigint {
  return (value * numerator) / denominator;
}
