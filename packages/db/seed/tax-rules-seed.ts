/**
 * Tax rules seed data — SD §19.3.2, ADR-0010
 *
 * Default rules for the PPN opt-in engine:
 * - PB1 applied by default to all retail F&B channels
 * - PPN_IN applied globally (for purchase invoices from PKP suppliers)
 * - PPN_OUT seeded but NOT applied by default (opt-in for B2B later)
 */

export type TaxRuleScopeKind =
  | 'channel'
  | 'customer_segment'
  | 'product_category'
  | 'global_default';

export interface TaxRuleSeed {
  scopeKind: TaxRuleScopeKind;
  scopeId: string | null;
  taxCode: string;
  isAppliedDefault: boolean;
  priority: number;
  effectiveFrom: string;
}

export const TAX_RULES_SEED: TaxRuleSeed[] = [
  // PB1 for retail channels (walk-in, delivery platforms)
  {
    scopeKind: 'channel',
    scopeId: 'walk_in',
    taxCode: 'PB1',
    isAppliedDefault: true,
    priority: 100,
    effectiveFrom: '2024-01-01',
  },
  {
    scopeKind: 'channel',
    scopeId: 'gofood',
    taxCode: 'PB1',
    isAppliedDefault: true,
    priority: 100,
    effectiveFrom: '2024-01-01',
  },
  {
    scopeKind: 'channel',
    scopeId: 'grabfood',
    taxCode: 'PB1',
    isAppliedDefault: true,
    priority: 100,
    effectiveFrom: '2024-01-01',
  },
  {
    scopeKind: 'channel',
    scopeId: 'shopeefood',
    taxCode: 'PB1',
    isAppliedDefault: true,
    priority: 100,
    effectiveFrom: '2024-01-01',
  },
  // PPN_IN — always active globally (for purchase invoices from PKP suppliers)
  {
    scopeKind: 'global_default',
    scopeId: null,
    taxCode: 'PPN_IN',
    isAppliedDefault: true,
    priority: 10,
    effectiveFrom: '2024-01-01',
  },
  // PPN_OUT — seeded but NOT applied by default (opt-in for future B2B)
  {
    scopeKind: 'global_default',
    scopeId: null,
    taxCode: 'PPN_OUT',
    isAppliedDefault: false,
    priority: 10,
    effectiveFrom: '2024-01-01',
  },
] as const;
