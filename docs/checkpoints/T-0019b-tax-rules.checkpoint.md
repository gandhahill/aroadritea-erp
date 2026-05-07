# T-0019b — Schema `tax_rules` + Seed Default Rules

## Status: 🟨 IN_PROGRESS
## Owner: Antigravity (Opus 4.6)
## Started: 2026-05-07
## Last Updated: 2026-05-07 21:57

---

## Goal
Add `tax_rules` table to the accounting schema (SD §19.3.2) and seed 6 default rules per §19.3.2.

## Plan
1. [x] Add `taxRules` table to `packages/db/schema/accounting.ts`
2. [x] Add relations for `taxRules`
3. [x] Export from `packages/db/index.ts`
4. [x] Create seed data in `packages/db/seed/tax-rules.ts` (append)
5. [x] Update seed runner `packages/db/seed/index.ts`
6. [x] Typecheck

## Spec Reference
- SYSTEM-DESIGN.md §19.3.2 — tax_rules schema
- ADR-0010 — PPN opt-in engine

## Next step
Schema and seed done. Proceed to T-0019c.
