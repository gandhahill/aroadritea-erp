# T-0101 — Attendance Check-In Service (mobile + GPS)

- **Status**: 🟨 IN_PROGRESS
- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-11
- **Last Updated**: 2026-05-11
- **Spec**: SD §21.8 §Attendance SOP
- **Branch**: master

## Goal

Build attendance check-in/check-out service for mobile (PWA) use:
- GPS location verification (within radius of registered location)
- QR scan fallback
- Late detection based on shift definition
- Late minutes calculation for payroll deduction

## Plan

1. [ ] Service `attendance.checkIn(employeeId, shiftDefinitionId, method, gpsData)`
2. [ ] Service `attendance.checkOut(attendanceId, gpsData)`
3. [ ] Attendance list page (employee + date range filter)
4. [ ] UI attendance check-in button (mobile PWA, location permission)

## Attendance SOP (SD §21.8)

- **On time**: check-in ≤ shift start time
- **Late**: check-in > shift start time → `late_minutes` = diff (rounded to nearest minute)
- **Max grace**: 15 minutes (after that = no show / needs SP)
- GPS stored as JSONB: `{ lat, lng, accuracy_m, source }`

## Files to Touch

| Path | Action |
|------|--------|
| `packages/services/src/hr/attendance-service.ts` | new |
| `apps/web/app/(dash)/hr/attendance/page.tsx` | new |
| `apps/web/app/(dash)/hr/attendance/actions.ts` | new |
| `packages/db/schema/hr.ts` | add `check_out` index if missing |

## Next step

Read SD §21.8 §Attendance SOP for exact late threshold, grace period, and late deduction formula. Then implement `attendance.checkIn` service.