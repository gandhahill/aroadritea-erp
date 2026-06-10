# Checkpoint: T-0291 - SAK EP reporting/tax code gap closure

- **Owner**: Claude Opus 4.8
- **Started**: 2026-06-10 22:30 WIB
- **Last updated**: 2026-06-10 22:45 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: `master`

## Goal

Close the code-level gaps left "Partial" by the T-0290 documentation audit so the
accounting/tax/reporting modules actually emit SAK EP-compliant presentation and
correct withholding amounts.

## Scope (user approved: "semua")

1. **Balance sheet current/non-current** — SAK EP Bab 4 (4.4-4.7). `balanceSheet()`
   only grouped by top-level `type`. Add `subtype` to trial-balance lines and emit
   `currentAssets`/`nonCurrentAssets`/`currentLiabilities`/`nonCurrentLiabilities`.
2. **P&L classification** — SAK EP Bab 5 (5.5). Separate other income, finance
   costs, and income tax expense out of Revenue/Operating using COA subtypes.
   Reclassify account `7-4100 Beban Pajak Penghasilan` to subtype `income_tax`.
3. **PPh 23 no-NPWP surcharge** — UU PPh Ps.23(1a): double the rate (e.g. 2% -> 4%)
   when the vendor partner has no NPWP.

## Done

- trial-balance.ts: added `accountSubtype` to `TrialBalanceLine` + account select.
- balance-sheet.ts: added current/non-current asset & liability sections (SAK EP Bab 4); `filterSection` takes optional subtype predicate.
- profit-loss.ts: SAK EP Bab 5 layout — `otherIncome`, `financeCosts`, `incomeTaxExpense`, `operatingProfit`, `profitBeforeTax`; operating buckets are default-safe.
- coa.ts: `7-4100` subtype `non_operating` → `income_tax`.
- withholding.ts: PPh 23 no-NPWP surcharge (rate ×2) via `NO_NPWP_SURCHARGE_CODES`; `generateBuktiPotong` resolves vendor NPWP.
- reporting.test.ts: extended fixtures + 2 new tests (current/non-current BS, SAK EP P&L split).
- Updated `docs/audit/sak-ep-tax-compliance-2026-06-10.md` matrix + residual risks.
- Flagged pre-existing MCP bigint serialization bug (out of scope) as a follow-up task.

## Verification

- Typecheck PASS: `@erp/services`, `@erp/db`, `@erp/mcp`, `@erp/web`.
- Tests PASS (63): `reporting.test.ts cash-flow.test.ts tax-calculate.test.ts tax-resolve.test.ts tax-list-rates.test.ts reporting-financial-statement-notes.test.ts`.
- Biome PASS on all changed files.
- DB reseed required to apply `7-4100` subtype change on existing deployments (`pnpm --filter @erp/db seed`).

## Decisions

- contra_asset accounts default to non-current (accumulated depreciation dominates in
  this F&B COA); allowance-for-doubtful-debt edge case documented as a known minor
  limitation. Subtype-driven, not code-prefix (less fragile across tenants).
- COA subtype reclassification applied via seed `onConflictDoUpdate` (no manual
  migration needed; re-running `pnpm --filter @erp/db seed` updates existing rows).
- PPh 23 surcharge computed in `calculateWithholding` based on `partners.npwp`;
  rate doubling is +100% per statute.

## Next Step

DONE. Optional follow-ups (separate tasks): (1) bigint-aware MCP serializer
(flagged); (2) formal SAK EP PDF/XLSX renderer that consumes the new
current/non-current + Bab 5 sections and `financialStatementNotes()`; (3) reseed
production DB so `7-4100` subtype = `income_tax` takes effect.

## Test Status

- See Verification section above — all PASS.
