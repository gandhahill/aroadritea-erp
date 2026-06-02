# Checkpoint: T-0265 - Production instrumentation import hotfix

- **Owner**: Codex
- **Started**: 2026-06-02 11:00 WIB
- **Last updated**: 2026-06-02 11:16 WIB
- **Status**: DONE

## Goal
Fix production PM2 startup crash:

`ERR_MODULE_NOT_FOUND: Cannot find module .../packages/db/client imported from .../packages/db/index.ts`

The crash happens while loading the Next.js instrumentation hook.

Spec references: SYSTEM-DESIGN sections 26 and 35; ADR-0012 PM2 + HestiaCP runtime.

## Plan
1. [x] Read TASK.md, SOURCE-OF-TRUTH.md, and SYSTEM-DESIGN.md.
2. [x] Inspect `apps/web/instrumentation.ts`, `packages/db/index.ts`, and package export configuration.
3. [x] Patch instrumentation/build config so production uses bundled/transpiled workspace packages instead of raw runtime TS ESM resolution.
4. [x] Run focused verification for `@erp/web` build.
5. [x] Update TASK.md/checkpoint with result.

## Done so far
- Confirmed the hook uses `webpackIgnore: true` for `@erp/services/notification`, which bypasses Next bundling and lets Node resolve workspace TS files directly.
- Confirmed `packages/db/index.ts` imports `./client` without an extension, which is not valid when Node resolves ESM source directly.
- Updated `apps/web/instrumentation.ts` to remove the webpack-ignore runtime import and keep `@erp/services/notification` bundled by Next.
- Updated `apps/web/next.config.ts` to include `@erp/services` in `transpilePackages`.
- Verified `.next/server/instrumentation.js` now loads the notification module through a bundled chunk instead of a raw package import.

## Decisions
- Prefer fixing the instrumentation import path through Next bundling instead of changing every internal workspace import to include `.ts`; the observed failure is caused by the hook bypassing the bundler.

## Open issues
- `pnpm --filter @erp/web typecheck` still fails on unrelated existing service errors:
  - `packages/services/src/accounting/fixed-assets.ts(1123,9)` uses audit action `"dispose"` not assignable to `AuditAction`.
  - `packages/services/src/pos/create-sale.ts(649-657)` references `partners` without an import.

## Next step
Deploy the hotfix to VPS, rebuild `@erp/web`, and reload PM2. Then verify PM2 logs no longer show `ERR_MODULE_NOT_FOUND` for `packages/db/client`.

## Test status
- `pnpm --filter @erp/web build`: PASS.
- Standalone production startup on local port 3105 with dummy `DATABASE_URL`: PASS, server reached `Ready` with empty stderr.
- `pnpm --filter @erp/web typecheck`: FAIL due unrelated pre-existing service errors listed above.
