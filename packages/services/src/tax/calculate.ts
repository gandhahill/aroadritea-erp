/**
 * tax.calculate — SD §19.2
 *
 * Pure calculation functions for tax amounts.
 * Supports both inclusive (PB1) and exclusive (PPN) tax modes.
 *
 * All monetary values use bigint (in smallest currency unit, e.g. Rupiah).
 * No permission check needed — these are pure math helpers.
 */

import { AppError } from '@erp/shared/errors';
import { type Result, err, ok } from '@erp/shared/result';

// --- Types ---

export interface TaxCalculationInput {
  /** Gross amount (total amount including/excluding tax depending on calculation mode). */
  grossAmount: bigint;
  /** Tax rate in basis points (e.g., 1000 = 10%). */
  rateBps: number;
  /** 'inclusive' = tax is already included in grossAmount. 'exclusive' = tax is added on top. */
  calculation: 'inclusive' | 'exclusive';
}

export interface TaxCalculationResult {
  /** The original gross amount passed in. */
  grossAmount: bigint;
  /** The tax-exclusive base amount (net of tax for inclusive, same as gross for exclusive). */
  taxBase: bigint;
  /** The computed tax amount. */
  taxAmount: bigint;
  /** Total amount (= taxBase + taxAmount). For inclusive, equals grossAmount. */
  totalAmount: bigint;
}

export interface TaxLineInput {
  /** Gross amount per line. */
  grossAmount: bigint;
  /** Resolved taxes to apply to this line. */
  taxes: Array<{
    taxCode: string;
    rateBps: number;
    calculation: 'inclusive' | 'exclusive';
    postingAccountId: string;
  }>;
}

export interface TaxLineResult {
  taxCode: string;
  taxBase: bigint;
  taxAmount: bigint;
  postingAccountId: string;
}

// --- Pure calculation functions ---

/**
 * Calculate tax for a single amount + rate.
 *
 * Inclusive (PB1):
 *   taxBase = grossAmount * 10000 / (10000 + rateBps)
 *   taxAmount = grossAmount - taxBase
 *
 * Exclusive (PPN):
 *   taxBase = grossAmount
 *   taxAmount = grossAmount * rateBps / 10000
 */
export function calculateTax(input: TaxCalculationInput): Result<TaxCalculationResult> {
  if (input.rateBps < 0) {
    return err(AppError.validation('tax.calculate.negativeRate', { rateBps: input.rateBps }));
  }
  if (input.grossAmount < 0n) {
    return err(
      AppError.validation('tax.calculate.negativeAmount', {
        grossAmount: input.grossAmount.toString(),
      }),
    );
  }

  if (input.rateBps === 0) {
    return ok({
      grossAmount: input.grossAmount,
      taxBase: input.grossAmount,
      taxAmount: 0n,
      totalAmount: input.grossAmount,
    });
  }

  if (input.calculation === 'inclusive') {
    // PB1 inclusive: gross already contains tax
    // taxBase = gross * 10000 / (10000 + rateBps)
    // Use integer arithmetic with rounding
    const denominator = BigInt(10000 + input.rateBps);
    const taxBase = (input.grossAmount * 10000n) / denominator;
    const taxAmount = input.grossAmount - taxBase;
    return ok({
      grossAmount: input.grossAmount,
      taxBase,
      taxAmount,
      totalAmount: input.grossAmount, // inclusive: total = gross
    });
  }

  // Exclusive: tax added on top
  // taxAmount = gross * rateBps / 10000
  const taxAmount = (input.grossAmount * BigInt(input.rateBps)) / 10000n;
  return ok({
    grossAmount: input.grossAmount,
    taxBase: input.grossAmount,
    taxAmount,
    totalAmount: input.grossAmount + taxAmount,
  });
}

/**
 * Calculate taxes for a line item with multiple tax codes.
 * Returns an array of tax line results.
 *
 * For inclusive taxes: they share the same gross amount (each extracts its own portion).
 * For exclusive taxes: they are stacked on top of the base.
 */
export function calculateLineTaxes(input: TaxLineInput): Result<TaxLineResult[]> {
  const results: TaxLineResult[] = [];

  for (const tax of input.taxes) {
    const calcResult = calculateTax({
      grossAmount: input.grossAmount,
      rateBps: tax.rateBps,
      calculation: tax.calculation,
    });

    if (!calcResult.ok) return calcResult as Result<never>;

    results.push({
      taxCode: tax.taxCode,
      taxBase: calcResult.value.taxBase,
      taxAmount: calcResult.value.taxAmount,
      postingAccountId: tax.postingAccountId,
    });
  }

  return ok(results);
}
