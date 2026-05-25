# Checkpoint: T-0181 — Self-service My Attendance page

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 19:25 WIB
- **Last updated**: 2026-05-25 19:35 WIB
- **Status**: 🟩 DONE

## Why

User: "tambah halaman Riwayat presensi bagi karyawan". The existing
`/hr/attendance` is a management/HR view that lists everyone and
requires `hr.attendance.read`. Staff couldn't see their own records
because they don't have that permission.

## Done

- **Service** `listMyAttendance(input, ctx)` in
  `packages/services/src/hr/attendance-service.ts`:
  - Resolves the requester via `users.email` → `employees.email`
    using the same encrypted-PII lookup as `listMyPayslips`.
  - Returns empty array when there's no matching employee row (e.g.
    director-only users) instead of erroring.
  - No permission gate — owning the record IS the authorization
    (self-service).
  - Optional `dateFrom` / `dateTo` filter; cap 365 rows.
- **UI** `/hr/my-attendance/page.tsx`:
  - Default window = first-of-month → today.
  - 3 summary cards: total days, late days (with rose tint when > 0),
    total minutes worked (`Xj Ym`).
  - Table with date / shift / check-in / check-out / worked / status.
  - Status badge: green "Tepat Waktu" / red "Terlambat Xm" /
    amber "Dispensasi" when forgiven.
- **Sidebar** entry "Presensi Saya" placed right after
  "Kehadiran" so the HR group reads:
  schedule → check-in → attendance (admin view) → my-attendance →
  leave → payroll → my-payslips.
- **i18n** id/en/zh keys added:
  - `hr.myAttendance.*` (title, description, from/to/filter, summary
    cards, table headers, status labels).
  - Sidebar `myAttendance` label.

## Notes / decisions

- No new permission added — visibility is intrinsic to ownership.
  Future: if we want supervisors to view team-only attendance without
  full `hr.attendance.read`, add a `hr.attendance.read.team`
  granular permission.
- Cap of 365 rows is generous (>1 year). If someone needs CSV export
  for a tax-year window the existing `/hr/attendance` admin page
  already supports it.
- Locale formatter falls back to `id-ID` for now —
  `getTranslations()` doesn't expose the active locale directly and
  pulling `useLocale` into a server component requires more setup
  than this page warrants.

## Verification

- `pnpm -r typecheck` PASS across 10 workspaces.
- No new tests written; existing 685/685 PASS.

## Backlog (carry-over to T-0182+)

- T-0182 Shift schedule override per specific date.
- T-0183 Member-data page for management.
- T-0184 Helpdesk/ticketing + AI integration.
- T-0185 Internal courier shipment tracking (BinderByte).
- Wire `?from=YYYY-MM-DD` deep-link from "Late" alert email (T-0175
  notification) → /hr/my-attendance.
