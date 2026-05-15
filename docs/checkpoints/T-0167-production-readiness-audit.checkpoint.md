# T-0167 — Production Readiness Audit and Critical Fixes

## Status

🟨 IN_PROGRESS

## Goal

Audit SOURCE-OF-TRUTH, SYSTEM-DESIGN, ADRs, TASK.md, and current code so production readiness is based on evidence. Fix critical blockers immediately, especially member signup crash, admin permission gaps, journal entry usability, route 404s, docs/help center, ERP language switcher, and POS/accounting/tax blockers.

## Findings So Far

- Production member signup crashed with digest `3669462378`.
  - VPS PM2 log showed `RangeError: Attempt to access memory outside buffer bounds` in `/[locale]/member/daftar`.
  - Root cause found in `packages/services/src/member/index.ts`: `randomBytes(3).readUInt32BE(0)` reads 4 bytes from a 3-byte buffer.
  - Fix applied locally: use `crypto.randomInt(0, 1_000_000)` for OTP generation.
- Admin permission issue:
  - Permission engine supports `*.*` wildcard.
  - Seed mapped director to explicit permission list only, so new service permissions like `hr.employee.read`, `inventory.product.read`, `inventory.opname`, etc. can lock director/admin out.
  - Fix applied locally: seed `*.*` permission and add `scripts/ensure-admin-access.ts`.
- Journal entry blocker:
  - Service requires existing open accounting period.
  - Seed did not ensure `accounting_periods`.
  - Fix partially applied locally: seed current + next year periods.
- Route/sidebar 404 candidates found:
  - `/accounting/periods`
  - `/tax/rates`
  - `/tax/rules`
  - `/hr/leave`
  - `/docs` requested by user but not yet added.
- Button visibility root cause:
  - UI uses classes such as `bg-brand-ember-5`, `bg-brand-ember-6`, `text-brand-muted`, `bg-brand-paper`, `bg-brand-porcelain`, but web globals did not define all tokens.
  - Fix applied locally: add missing tokens in `apps/web/app/globals.css`.
- Master data UI gap:
  - User reported DB data such as product list cannot be managed from ERP UI.
  - This violates the documented goal that non-secret operational configuration/master data should be UI-managed, not edited in source/DB.
  - Prioritize product/menu master UI because POS depends on it.
- Research baseline:
  - MCP Scholar was used for ERP success factors and AI-code verification/debugging literature.
  - Practical audit stance applied here: every AI-generated fix is treated as a hypothesis until typecheck/test/build/smoke evidence exists.
- Legal/public site gap:
  - Member Terms and Privacy pages existed but were too thin for public/member registration use.
  - Expanded locally into professional numbered policy pages in ID/EN/ZH message files.
- ERP usability/security gaps fixed locally:
  - Added logout button in ERP shell.
  - Added in-dashboard locale switcher.
  - Added permission matrix UI for role-permission management.
  - Added `scripts/ensure-admin-access.ts` so the admin user can be re-bound to director + `*.*` wildcard access in production.
- Master data UI fixed locally:
  - Added Inventory -> Produk & Menu UI for categories, products, and variants.
  - Fixed inventory list service query for variants by replacing unsafe raw `ANY(...)` usage with Drizzle `inArray`.
- Purchasing/config UI gaps fixed locally:
  - Added Purchasing sidebar section.
  - Added `/purchasing` dashboard with supplier list and supplier creation form.
  - Added `/purchasing/po/new` form wired to `createPO`.
  - Replaced empty notification service with DB-backed notification channel service.
  - Added `/settings/notifications` UI so outage/stock-alert recipients are configurable from ERP.
- HR/accounting workflow blockers fixed locally:
  - `/hr/employees/new` now exists and submits through `createEmployee`.
  - `/accounting/journals/new` now exists and submits through `createJournal`.
  - Seed now creates current + next year accounting periods.
  - Seed now creates leave types.
- Test findings:
  - Initial service test run had 526/527 pass; IAM cache test timed out due dynamic cold import inside the test.
  - Test was made deterministic by importing the module once at test setup.
- Follow-up run: 527/527 service tests passed.
- Stub scan:
  - `rg "^export {};|TODO|FIXME|NOT_IMPLEMENTED|not implemented|stub"` over `apps` and `packages/services/src` returns no matches after notification service implementation.
- Deployment evidence:
  - Commit `3eab86b` pushed and pulled to VPS.
  - Commit `bdb1b73` pushed and pulled to VPS for standalone PM2 runtime.
  - `pnpm db:seed`, `pnpm admin:ensure-access`, and `pnpm jobs:disable-unconfigured` passed on VPS.
  - VPS `pnpm --filter @erp/web build`, `pnpm --filter @erp/site build`, `pnpm --filter @erp/mcp build`, and `pnpm --filter @erp/worker build` passed across the deploy sequence.
  - PM2 processes are online; site/web now run standalone `server.js` instead of `next start`.
  - Health checks passed: site 200, web 200 with DB ok, MCP 200.
  - Public smoke passed for public site pages, ERP login, and protected ERP routes redirecting to login instead of 404.
  - CSS assets for public site and ERP returned HTTP 200, addressing the plain-HTML symptom.

## Plan

1. [x] Pull production log for member signup digest.
2. [x] Fix OTP crash root cause.
3. [x] Add product/menu master UI for categories/products/variants.
4. [x] Finish admin permission + permission UI.
5. [x] Add journal entry create UI.
6. [x] Finish missing route pages found so far.
7. [ ] Build audit matrix from MD requirements to backend/UI/tests/status.
8. [x] Run local typecheck/test/build checks.
9. [x] Commit, push, deploy, run production DB scripts, verify.

## Next Step

Build the full MD requirement matrix from `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, ADRs, and `TASK.md`: for each requirement, record backend status, UI status, test status, production smoke status, and remaining gap. Then fix the highest-risk gaps module by module.

## Test Status

- `pnpm --filter @erp/services test` PASS: 24 files, 527 tests.
- `pnpm --filter @erp/web typecheck` PASS.
- `pnpm --filter @erp/site typecheck` PASS.
- `pnpm --filter @erp/worker typecheck` PASS.
- `pnpm --filter @erp/mcp typecheck` PASS.
- `pnpm --filter @erp/db typecheck` PASS.
- `pnpm --filter @erp/worker typecheck` PASS.
- `pnpm --filter @erp/web build` PASS.
- `pnpm --filter @erp/site build` PASS.
- `pnpm --filter @erp/worker build` PASS.
- `pnpm --filter @erp/mcp build` PASS.
- `pnpm lint` PASS (warnings remain in older files, no lint errors).
