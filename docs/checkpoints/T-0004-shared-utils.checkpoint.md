# Checkpoint: T-0004 — `packages/shared/{result,errors,money,id,date,types}`

- **Owner**: Antigravity (Opus 4.6)
- **Started**: 2026-05-06 09:50 WIB
- **Last updated**: 2026-05-06 09:50
- **Status**: 🟨 IN_PROGRESS
- **Phase**: 1
- **Branch**: feat/T-0004-shared-utils

## Goal

Harden `packages/shared` dari scaffold awal menjadi production-ready utilities:
- Ganti UUID → ULID (SD §7.10)
- Extend Money type dengan operasi aritmatika lengkap
- Tambah timezone-aware date helpers (WIB)
- Tambah common types (AuditContext, SortDirection, etc.)
- Implement InventoryPort interface
- Base i18n key constants
- Setup vitest + unit tests

Spec: SYSTEM-DESIGN §7

## Plan

1. [ ] Fix `id/` — implement ULID generator (internal ≤100 lines per SD P16)
2. [ ] Enhance `money/` — multiply, divide, sum, guard functions
3. [ ] Enhance `date/` — WIB helpers, posting date, period check
4. [ ] Enhance `types/` — AuditContext, SortDirection, FilterOperator
5. [ ] Check/implement `ports/inventory.ts` — InventoryPort interface
6. [ ] Check/implement `i18n-keys/` — base key constants
7. [ ] Add vitest to shared + write unit tests for money, id, date
8. [ ] pnpm typecheck — verify all pass

## Done so far

_(starting)_

## Decisions

_(none yet)_

## Open issues

_(none yet)_

## Next step

Start with step 1: implement ULID generator in `packages/shared/src/id/index.ts`.

## Test status

- **Unit**: not started
- **Integration**: N/A
- **E2E**: N/A
