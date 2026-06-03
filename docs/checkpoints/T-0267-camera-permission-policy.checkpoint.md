# Checkpoint: T-0267 - Attendance face camera permission hotfix

- **Owner**: Codex
- **Started**: 2026-06-03 03:49 WIB
- **Last updated**: 2026-06-03 03:49 WIB
- **Status**: DONE

## Goal
Fix `/hr/checkin` face verification so the browser can request camera access.

## Done
- Changed web `Permissions-Policy` from `camera=()` to `camera=(self)` while keeping `microphone=()` disabled.
- Added automatic camera request on check-in when an employee and shift are available and face capture is required.
- Kept manual retry button as fallback if the browser blocks the automatic prompt.
- Made stream attachment resilient when camera permission returns before the `<video>` element is mounted.

## Test status
- `pnpm --filter @erp/web typecheck` PASS.
- `git diff --check` PASS.

## Next step
Deploy/rebuild `@erp/web`, then open `/hr/checkin` over HTTPS and verify the browser camera permission prompt appears.
