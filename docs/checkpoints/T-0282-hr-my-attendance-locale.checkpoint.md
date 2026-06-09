# Checkpoint: T-0282 - HR my attendance dispensation reason and locale UX audit

- **Owner:** Codex
- **Started:** 2026-06-09 15:45 WIB
- **Last updated:** 2026-06-09 16:02 WIB
- **Status:** DONE

## Goal

Verify that Dashboard / HR / My Attendance / Riwayat Presensi Saya shows dispensation reasons, and make sure locale messages are user-friendly rather than technical.

## Findings

- `/hr/my-attendance` already loads `getDispensedDetailsForPeriod()` and renders absence `dispensationReason` inline per matching attendance date plus a dispensation history table.
- Late-forgiven attendance rows did not expose `lateForgivenReason` in `listMyAttendance()`, so employees could see the badge but not the reason.
- Locale copy still uses operationally technical terms in Indonesian such as `check-in`, `check-out`, `checkout`, and minute shorthand `m`.
- The page has a hardcoded metadata title and a hardcoded fallback string in JSX.
- `apps/web/messages/zh.json` had corrupted literal question-mark values for face-attendance errors.

## Plan

1. [x] Read required repo context and locate page/service/i18n files.
2. [x] Patch page metadata/locale handling and user-facing copy.
3. [x] Run focused checks.
4. [x] Update task/checkpoint and report result.

## Changes

- Added `lateForgivenReason` to `listMyAttendance()` return data.
- Rendered late-forgiveness reason on the employee self-service attendance table.
- Kept absence dispensation reason visible inline and in the dispensation history table.
- Switched page metadata title to i18n and removed a hardcoded JSX fallback string.
- Used `getLocale()` for date formatting instead of forcing `id-ID`.
- Rewrote HR attendance/my-attendance locale copy to avoid overly technical terms.
- Fixed corrupted Mandarin `??` values for face attendance messages.

## Verification

- `pnpm --filter @erp/web exec tsc --noEmit --pretty false`: PASS
- `pnpm --filter @erp/services typecheck`: PASS
- `node .\node_modules\@biomejs\biome\bin\biome lint --max-diagnostics=100 "apps/web/app/(dash)/hr/my-attendance/page.tsx" "apps/web/messages/id.json" "apps/web/messages/en.json" "apps/web/messages/zh.json"`: PASS
- `hr.myAttendance` key parity across `id/en/zh`: PASS
- `rg -n "\?{2,}" "apps/web/messages/id.json" "apps/web/messages/en.json" "apps/web/messages/zh.json"`: no matches

## Commit

- `dabc74f fix(hr): show attendance dispensation reasons`

## Next step

No remaining local step. Deploy if the change should go live immediately.
