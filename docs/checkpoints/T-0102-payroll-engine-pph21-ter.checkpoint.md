# T-0102 — Payroll Engine (PPh 21 Progressive TER)

- **Status**: 🟩 DONE
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §19.5, §21.8 §Payroll Run
- **Branch**: master

## Goal

Build the payroll calculation engine:
- Per-employee per-period payroll run
- PPh 21 TER (Tarif Efektif Rata-rata) progressive calculation
- BPJS Kesehatan + TK deductions (with PTKP ceiling)
- Late penalty (3 free per month, then Rp 50,000 each)
- Generate `payrolls` header + `payroll_lines` per employee

## Plan

1. [x] `payroll-engine.ts` — core TER calculation + line build
2. [x] `runPayroll.ts` — service: create payrolls header, call engine per employee
3. [x] Unit tests for TER progressive brackets (19 tests pass)
4. [x] UI: Payroll run page (select period, preview, approve)

## PPh 21 TER Brackets (PTKP 2024, PTKP K/1, K/2, K/3)

PTKP base: Rp 54,000,000/year (single). Brackets per UU PPh 21:

| PKP (IDR/year) | Rate | PPh21/year |
|---|---|---|
| 0 – 60,000,000 | 5% | 0 |
| 60,000,001 – 250,000,000 | 15% | 0 |
| 250,000,001 – 500,000,000 | 25% | 0 |
| 500,000,001 – 5,000,000,000 | 30% | 0 |
| > 5,000,000,000 | 35% | 0 |

**TER = PPh21/year / (gross annual income)** — applied monthly.

## Files to Touch

| Path | Action |
|------|--------|
| `packages/services/src/payroll/payroll-engine.ts` | new — TER calc + line build |
| `packages/services/src/payroll/run-payroll.ts` | new — payroll run service |
| `packages/services/tests/payroll-engine.test.ts` | new — unit tests |
| `apps/web/app/(dash)/hr/payroll/page.tsx` | new |

## Next step

Read SD §19.5 (PPh 21 TER) in detail, then implement `payroll-engine.ts` — TER progressive brackets, BPJS caps, late penalty logic.