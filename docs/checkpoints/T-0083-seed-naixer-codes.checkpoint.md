# T-0083 — Script seed-naixer-codes.ts (CSV import)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: ADR-0007, SD §33.6

## Goal

Create `scripts/seed-naixer-codes.ts` — a CLI script that imports Naixer product codes and modifier codes from CSV files into the database. Per ADR-0007: "import via `pnpm seed naixer-codes <file.csv>`".

## Plan

1. Create CSV parser (pure function, no external deps)
2. Create the script with two sub-commands: `products` and `modifiers`
3. Write unit tests for CSV parsing logic
4. Add npm script to root + db package.json
5. Typecheck + commit

## CSV Formats

**Products** (`--type products`):
```
product_id,variant_id,naixer_code
abc-123,,T003
abc-123,var-456,T003A
```

**Modifiers** (`--type modifiers`):
```
modifier_kind,modifier_option_id,naixer_code,display_order
size,opt-001,C01,1
ice,opt-002,S02,2
```

## Files

- `scripts/seed-naixer-codes.ts` — CLI entry point
- `packages/services/src/kitchen/parse-naixer-csv.ts` — pure CSV parsing logic (testable)
- `packages/services/tests/parse-naixer-csv.test.ts` — unit tests

## Next step

Implement the script and tests.
