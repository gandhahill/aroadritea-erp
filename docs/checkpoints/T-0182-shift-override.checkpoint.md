# Checkpoint: T-0182 — Per-date shift override (swap)

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 19:35 WIB
- **Last updated**: 2026-05-25 19:55 WIB
- **Status**: 🟩 DONE

## Why

User: "tambah fitur penyesuaian jadwal shift pada tanggal tertentu".
The schedule grid already stored per-date assignments — what was
missing was a one-click way to *swap* a specific date's assignment to
a different employee (sick / family leave) with the reason captured
for the audit trail and both employees notified.

## Done

- **Schema** `packages/db/schema/hr.ts` + migration 0034:
  - `schedule_overrides` — id, tenant_id, location_id, work_date,
    shift_definition_id, **original_employee_id**,
    **substitute_employee_id**, reason, new_assignment_id (FK back to
    `shift_assignments.id`), plus standard audit cols. Indexed on
    date, tenant+date, original_emp, substitute_emp so we can list
    "all swaps for this date / person" cheaply.
- **Audit entity type** `schedule_override` added to
  `KNOWN_ENTITY_TYPES`.
- **Server Action** `swapShiftAssignmentAction(input, ctx)`
  (`apps/web/app/(dash)/hr/schedule/actions.ts`):
  - Permission gate `hr.manage_attendance` (same as upsert/delete).
  - Loads the original assignment; rejects swap to self; checks the
    substitute doesn't already have a row for the same date+shift.
  - **Re-points** the existing `shift_assignments` row to the
    substitute (in-place update, keeps id stable so downstream
    attendance/notification FKs survive).
  - Inserts a `schedule_overrides` row.
  - Writes an `audit_log` entry (entity = `schedule_override`).
  - Fans out two notifications via the existing `notifyShiftChange`
    helper: `deleted` to the original, `created` to the substitute,
    both annotated with the swap reason.
- **UI** `apps/web/app/(dash)/hr/schedule/schedule-grid.tsx`:
  - New `swapAssignment(assignment)` helper that uses two
    `window.prompt` dialogs — pick substitute by index from a
    numbered list, type reason. Kept lightweight; a dedicated modal
    is a follow-up if usage gets heavy.
  - Each "on" shift cell now shows a `⇄` button beside the shift
    code; Alt+click on the cell itself also triggers swap (tip
    surfaced in the cell tooltip when on).
- **i18n** id/en/zh: full `hr.schedule.swap.*` block (button label,
  short hint, pick prompt with date placeholder, pick instruction,
  invalid-index error, reason prompt, reason-required error,
  no-candidates fallback).

## Notes / decisions

- Stayed with in-place mutation rather than delete+insert so the
  attendance record (referenced by `attendance.shiftAssignmentId`)
  doesn't break if it was already recorded.
- The `window.prompt` UX is intentional for v1 — it's the cheapest
  way to ship the feature working today. A proper modal is on the
  follow-up list.
- `notifyShiftChange` was already best-effort (errors don't roll
  back the schedule mutation) per T-0175 design, so the swap also
  inherits that resilience.
- Permission check is global, not per-location, because the existing
  schedule actions are also global. Future: tighten to the
  assignment's location (matches the GRN.confirm pattern from
  T-0180).

## Verification

- `pnpm -r typecheck` PASS across 10 workspaces.
- `pnpm -r test`: 685/685 PASS (no regression).

## Backlog (carry-over to T-0183+)

- T-0183 Member-data page for management.
- T-0184 Helpdesk/ticketing + AI integration.
- T-0185 Internal courier shipment tracking (BinderByte).
- Replace `window.prompt` swap UX with a dedicated modal.
- Expose `schedule_overrides` history on the schedule page (so the
  manager can see "Erni took over for Bagas on May 14 — reason: family
  emergency").
- MCP tool `swap_shift_draft` so the AI can propose a swap when an
  attendance record is missing.
