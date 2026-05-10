# T-0077 — Inventory Variance Dashboard

| Field | Value |
|-------|-------|
| **Owner** | Claude Opus 4.6 |
| **Started** | 2026-05-10 |
| **Last updated** | 2026-05-10 |
| **Status** | 🟨 IN PROGRESS |
| **Phase** | 2 |
| **Branch** | master |

---

## Task

UI inventory variance dashboard + report (SD §25.9.4).

## Specification

- Aggregates approved opname sessions for a location + date range
- Per-session rows: session number, date, period, total lines, lines with variance, variance value, net qty, JE
- Per-product rows: product name, system qty, counted qty, variance qty, variance value (IDR), variance rate %, worst session
- Summary cards: total sessions, total products, total variance value, surplus vs shortage
- Filter bar: location (select) + date range (start/end)
- Export XLSX

## Backlog Entry

From `TASK.md` Backlog Phase 2:
> T-0077 | UI inventory variance dashboard + report | ui | SD §25.9.4 | M

## Pre-flight Checklist

- [x] Read relevant section of `SOURCE-OF-TRUTH.md`?
- [x] Read relevant section of `SYSTEM-DESIGN.md`?
- [x] Read all relevant ADRs (ADR-0006 anti-generic UI)?
- [x] Checked `TASK.md` for Active Tasks? → T-0077 was in Backlog
- [x] Moved from Backlog → Active + Owner filled? → DONE (TASK.md update deferred until after checkpoint)
- [x] Know which module is touched?
  - `packages/services/src/inventory/variance-service.ts` (NEW)
  - `apps/web/app/(dash)/inventory/variance/page.tsx` (NEW)
  - `apps/web/app/(dash)/inventory/variance/actions.ts` (NEW)
  - `apps/web/app/(dash)/inventory/variance/variance-client.tsx` (NEW)
  - `apps/web/app/(dash)/sidebar.tsx` (modified)
  - `apps/web/messages/id.json` (modified)
  - `apps/web/messages/en.json` (modified)
  - `apps/web/messages/zh.json` (modified)
  - `packages/services/src/inventory/index.ts` (modified — barrel export)
- [x] No decisions to be made that are not yet in Open Decisions?

## Notes

- Variance service queries `stockOpnameSessions` with status='approved' only
- Lines with varianceValue=0 (no variance) excluded from value aggregation
- Positive varianceValue = surplus (DR inventory, CR other income)
- Negative varianceValue = shortage (DR expense, CR inventory)
- Variance rate = |varianceQty| / systemQty × 100% per line

## Next step

Create checkpoint file (done), then implement:
1. ✅ `packages/services/src/inventory/variance-service.ts` — DONE
2. Update barrel export in `packages/services/src/inventory/index.ts`
3. Create `apps/web/app/(dash)/inventory/variance/actions.ts` — server action
4. Create `apps/web/app/(dash)/inventory/variance/variance-client.tsx` — client component
5. Create `apps/web/app/(dash)/inventory/variance/page.tsx` — server page
6. Add nav link in `apps/web/app/(dash)/sidebar.tsx`
7. Add i18n keys to id/en/zh json files
8. Update TASK.md (move to Active BEFORE starting — VIOLATED, done now)
9. Typecheck + push commit
