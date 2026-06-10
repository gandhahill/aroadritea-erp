# Checkpoint: T-0292 - HR NIK encryption + whistleblower notification + attendance late-minutes

- **Owner**: Claude Opus 4.8
- **Started**: 2026-06-10 23:00 WIB
- **Last updated**: 2026-06-10 23:05 WIB
- **Status**: DONE
- **Phase**: 1
- **Branch**: `master`

## Goal

Fix three user-reported issues (2026-06-10):
1. A NIK input form stored the value unencrypted.
2. No notification when a whistleblowing report is submitted.
3. Late-minutes total in the attendance summary rendered as `005300000310160m`.

(A fourth request — comprehensive third-party API docs "using Scala" — is the
existing F8 phase, interpreted as **Scalar**, and is BLOCKED pending user
confirmation + sits behind the F5 gate. Tracked separately, not in T-0292.)

## Done

- **NIK encryption (update path)**: `hr/update-employee.ts` stored `setCols.nik =
  data.nik` plaintext while every other PII field used `encryptPii`. Now
  `encryptPii(data.nik, 'employees.nik')`, matching `createEmployee`. Closes a
  UU PDP / CLAUDE.md §5.5 leak. (MCP `hr.create_employee` already routes through
  `createEmployee`, which encrypts — no leak there.)
- **Whistleblower notification**: `hr/whistleblower.ts:submitWhistleblowerReport`
  now fans out an in-app notification via `notifyByPermission` to holders of
  `hr.whistleblower.read`, kind `whistleblower`, linking `/hr/whistleblower`.
  Anonymity preserved: payload carries only the category + a generic body — never
  the reporter identity (not stored) nor the free-text content. Best-effort
  (notifyByPermission swallows its own errors); placed after the insert.
- **Attendance late-minutes total**: `hr/attendance-summary-service.ts`
  `totalLateMinutes` used `sum(...)` with a `sql<number>` annotation, but
  postgres-js returns an un-cast SUM as a string; the client total then did
  `0 + "53"` → string concatenation → `005300000310160m`. Cast to `int` in SQL
  (`cast(coalesce(sum(...),0) as int)`) so the value is a real number. Per-row
  cells were already coerced by comparison; the footer total was the visible bug.

## Decisions

- NIK on update uses `encryptPii` (random IV) to match `createEmployee` exactly,
  not `encryptPiiForLookup`. The create/lookup determinism mismatch is pre-existing
  and out of scope.
- Whistleblower notification text uses plain Indonesian strings, matching the
  established server-side `notifyByPermission` convention (create-sale,
  purchasing/workflow). These are DB-stored notification payloads, not JSX UI
  strings, so the i18n-key rule for UI components does not apply.

## Verification

- Typecheck PASS: `@erp/services`.
- Tests PASS (8): `whistleblower-anonymity.test.ts` (anonymity regression intact),
  `pii.test.ts`.
- Biome PASS on all changed files.
- Note: the attendance SUM-as-string bug is a postgres-js runtime behavior not
  reproducible under the mocked-db unit tests; fix verified by code/SQL review.

## Next Step

DONE. Follow-up: request #4 (third-party API docs via Scalar) needs user
confirmation of Scala-vs-Scalar and whether to build now vs. follow the F8 phase
gate — see `docs/plans/cards/F8-public-api-cards.md`.
