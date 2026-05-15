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
- New user feedback after deploy:
  - ERP UI must remove internal/technical wording such as "Konfigurasi non-secret" and environment-variable explanation from user-facing settings pages.
  - Docs page is not sufficient; it must become a detailed user guide with table of contents, left navigation, step-by-step instructions, module purpose, troubleshooting, and guidance for confusing modules such as Workflow Editor.
  - Treat the review lens as ISO/IEC 27001, ISO 9001, ISO/IEC 25010, ISO 22301, ISO/IEC 38500, COBIT, and ITIL: fix gaps immediately where visible in UI/docs, especially usability, governance, access control, operational continuity, and supportability.
  - Ensure displayed language follows the selected ERP language, including shell labels and account area fallbacks.
- 2026-05-15 20:06 local audit update:
  - Added `docs/TRACEABILITY-AUDIT.md` as a SoT/SD requirement matrix with evidence/status per module instead of relying on verbal claims.
  - Added UI-managed promotion rules (`/settings/promotions`) for percent discount, fixed discount, buy-X-get-Y, free item, complimentary/giveaway, location scope, channel scope, priority, approval flag, and usage limit.
  - Added promotion DB schema/migration and service layer with permission/audit integration, plus MCP tools `promotion.list` and `promotion.upsert`.
  - Fixed MCP audit permission mismatch from `audit.read` to seeded `audit.view`; MCP health boot test passed with 47 tools.
  - Added Management BI page at `/reporting/business-intelligence` for non-director management views using daily summary data by active store.
  - Added parent route redirects for `/accounting`, `/hr`, `/inventory`, `/reporting`, `/settings`, and `/tax`; sidebar route audit now reports 49 hrefs, 0 missing routes.
  - Added ERP favicon and normalized ERP UI away from raw `bg-white` to semantic `bg-card` tokens.
  - Expanded i18n messages and fixed raw placeholder scans; `apps/web/messages` and `apps/site/messages` now have 0 missing keys across ID/EN/ZH.
  - Marker scan over `apps` and `packages` for `TODO/FIXME/not implemented/stub/coming soon/under construction/lorem/dummy/belum tersedia/segera hadir` returns no matches.
  - Important residual risk: hardcoded Indonesian UI strings still exist in older module pages (for example reimbursement, inventory, reporting, HR, purchasing forms). The selected language now works where migrated, but a full hardcoded-string migration remains a separate large pass.
- 2026-05-15 20:37 deploy smoke follow-up:
  - Commit `aaa31a0` was pushed, pulled on VPS, migrated, seeded, rebuilt, and PM2 reloaded.
  - Internal health checks passed for site, web, and MCP.
  - External smoke found a remaining ERP static asset bug: `/favicon.svg` redirected to login because middleware only excluded `favicon.ico`.
  - Local fix applied in `apps/web/middleware.ts` to allow `/favicon.svg`, `/icons/*`, `/sw.js`, `/workbox-*`, `/manifest.json`, and logo assets through middleware.
  - Verification after patch: `pnpm --filter @erp/web typecheck` PASS and `pnpm --filter @erp/web build` PASS.

## Plan

1. [x] Pull production log for member signup digest.
2. [x] Fix OTP crash root cause.
3. [x] Add product/menu master UI for categories/products/variants.
4. [x] Finish admin permission + permission UI.
5. [x] Add journal entry create UI.
6. [x] Finish missing route pages found so far.
7. [x] Build audit matrix from MD requirements to backend/UI/tests/status.
8. [x] Run local typecheck/test/build checks.
9. [x] Commit, push, deploy, run production DB scripts, verify.
10. [x] Rebuild ERP Docs into production-grade help center shell with left navigation, search-style layout, workflow guidance, and editable content integration.
11. [x] Commit, push, deploy latest local critical fixes, run production migrations, and smoke test live site/web/MCP.
12. [ ] Commit, push, deploy ERP static asset middleware patch, then live re-smoke favicon/PWA assets.

## Next Step

Commit the ERP static asset middleware patch, push to GitHub, pull on the VPS, rebuild `web`, reload PM2, then smoke test `https://erp.aroadritea.com/favicon.svg`, `/manifest.json`, `/sw.js`, `/icons/icon-192.png`, `/login`, `/docs`, `/settings/promotions`, and MCP `/healthz`.

## Test Status

- `pnpm -r typecheck` PASS: 10 workspace projects.
- `pnpm --filter @erp/services test` PASS: 24 files, 528 tests.
- `pnpm lint` PASS: 0 lint errors, 456 warnings remain in older files.
- `pnpm --filter @erp/site build` PASS: 31 static pages generated for ID/EN/ZH public routes.
- `pnpm --filter @erp/web build` PASS: Serwist service worker bundled, ERP route build completed.
- `pnpm --filter @erp/mcp build` PASS after aligning build to `tsc --noEmit`.
- `pnpm --filter @erp/worker build` PASS after aligning build to `tsc --noEmit`.
- MCP runtime health boot test PASS: `http://127.0.0.1:3912/healthz` returned 200 with `status=ok`, registry log reported 47 tools.
- Sidebar route audit PASS: 49 hrefs, 0 missing route files.
- i18n key parity PASS: `apps/web/messages` and `apps/site/messages` have 0 missing keys for ID/EN/ZH.
- Unfinished marker scan PASS: no TODO/FIXME/not-implemented/stub/placeholder-work markers in `apps` or `packages`.
