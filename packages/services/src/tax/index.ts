/**
 * @erp/services/tax — Tax service barrel export.
 */

export { listRates, getRateByCode, type TaxRateResult } from './list-rates';
export { resolve, type TaxResolutionContext, type ResolvedTax } from './resolve';
export {
  calculateTax,
  calculateLineTaxes,
  type TaxCalculationInput,
  type TaxCalculationResult,
  type TaxLineInput,
  type TaxLineResult,
} from './calculate';
export * from './efaktur';
export * from './spt-masa';
export * from './withholding';
export * from './bupot21';
