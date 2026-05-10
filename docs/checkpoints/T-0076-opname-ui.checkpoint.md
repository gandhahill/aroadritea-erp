# T-0076 Checkpoint — Stock Opname UI

**Task**: UI stock opname (session create + input fisik + approve variance)
**Status**: ✅ DONE
**Commit**: 68e4782
**Date**: 2026-05-10

---

## Files Created

- `apps/web/app/(dash)/inventory/opname/page.tsx` — session list page
- `apps/web/app/(dash)/inventory/opname/new/page.tsx` — create session form
- `apps/web/app/(dash)/inventory/opname/[id]/page.tsx` — session detail page
- `apps/web/app/(dash)/inventory/opname/[id]/opname-workflow-bar.tsx` — 4-step progress indicator
- `apps/web/app/(dash)/inventory/opname/[id]/opname-lines-table.tsx` — interactive line table
- `apps/web/app/(dash)/inventory/opname/actions.ts` — server actions

**Files Modified**:
- `apps/web/messages/id.json` — added opname i18n keys + status in_progress/submitted/cancelled
- `apps/web/tsconfig.json` — added drizzle-orm path alias for `@erp/db` re-export

---

## What Was Built

### List Page (`/inventory/opname`)
- Table of opname sessions with: number, date, period, status badge, prepared by
- "Buat Sesi Opname" button → `/inventory/opname/new`
- Empty state with illustration

### New Session Page (`/inventory/opname/new`)
- Form: location (select), session date (date input), period code (text), notes (textarea)
- Uses `useActionState` + `createOpnameSessionAction`
- Redirects to detail page on success

### Detail Page (`/inventory/opname/[id]`)
- Workflow progress bar (4 steps: Buat → Hitung → Ajukan → Setujui)
- 4 stat cards: total lines, lines with variance, total variance value, JE status
- Progress card showing count vs total for draft/in_progress
- Action buttons: submit (in_progress when all counted), approve (submitted), cancel
- Variance info banner (submitted status)
- `OpnameLineTable` component (full table)

### OpnameLineTable (client component)
- Optimistic updates: dirty-tracking per line
- Inline number input for countedQty when draft/in_progress
- Per-line "Simpan" button + bulk "Simpan N Perubahan" button
- Color-coded variance: green (surplus), red (shortage), normal (no variance)
- Counted badge (jade checkmark) vs unchecked (—)
- Read-only for submitted/approved/cancelled with variance value shown

### Server Actions
- `createOpnameSessionAction`, `recordCountAction`, `submitOpnameAction`, `approveOpnameAction`, `cancelOpnameAction`, `loadOpnameSessionAction`
- `buildCtx()` helper builds AuditContext from session
- `resolveLocationId()` loads session from DB to get locationId (needed by opname-service)

### Key Technical Fixes
- `AuditContext` uses `locationId: string` (not `ctx.locationId` — it's required field, no `ip`/`userAgent`)
- `createOpnameDraft` expects `input: { sessionDate, periodCode, notes? }` — no locationId in input, location from ctx
- `recordCount` signature: `input: { sessionId, counts: Array<{ productId, variantId?, countedQty, notes? }> }` — lineId mapping done by service internally
- `result.value` not `.data` for Result<T> pattern (uses `value` not `data`)

---

## TypeScript

- `pnpm tsc -p packages/services/tsconfig.json --noEmit` — clean
- `pnpm tsc -p apps/web/tsconfig.json --noEmit` — clean

---

## Next Steps

**Immediate next**: T-0085c — UI reporting/daily-summary (table + charts + export XLSX)
**Also**: T-0077 — UI inventory variance dashboard + report