# Checkpoint: T-0163 - Public site CSS/location fix + production audit

- **Owner**: Codex
- **Started**: 2026-05-14 23:39 WIB
- **Last updated**: 2026-05-15 01:27 WIB
- **Status**: DONE
- **Phase**: 5 + cross-module production hardening
- **Branch**: current branch

## Goal

Fix the live public website rendering as unstyled HTML, update current public store footprint to Yogyakarta-only (Malioboro Mall and Plaza Malioboro), verify `TASK.md` state, and audit unfinished-work markers plus high-risk production bugs across POS, accounting, tax, and related modules.

References:
- Business: `SOURCE-OF-TRUTH.md` public website, locations, POS, accounting, tax sections.
- Technical: `SYSTEM-DESIGN.md` apps/site, Tailwind/PostCSS, POS offline, accounting/tax, production runtime sections.
- ADR: 0003 public website CMS, 0006 brand UI, 0010 PPN, 0012 PM2 runtime.

Definition of Done:
- [x] Live `aroadritea.com` no longer renders as plain HTML after deploy.
- [x] Site content shows only Yogyakarta stores and correct social handles.
- [x] Address sources are checked from the web and reflected in public copy.
- [x] `TASK.md` has no active/pending production tasks after completion.
- [x] Unfinished-work markers in production code are resolved or reclassified as non-production historical notes.
- [x] POS, accounting, tax focused test suite passes.
- [x] Typecheck/build passes for the affected workspace.
- [x] Deployment to VPS via PM2 is verified with health checks and browser smoke screenshot.

## Plan

1. [x] Confirm live plain-HTML issue and identify CSS pipeline root cause.
2. [x] Search web sources for Malioboro Mall and Plaza Malioboro addresses.
3. [x] Add site PostCSS/Tailwind build config and dependencies.
4. [x] Update public site copy/data to Yogyakarta-only stores and social handles.
5. [x] Audit and resolve unfinished-work markers in production code.
6. [x] Clean `TASK.md` task state and update checkpoint.
7. [x] Run focused POS/accounting/tax tests plus typecheck/build.
8. [x] Commit, push, deploy to VPS, restart PM2, verify live site.

## Done so far

- Added Tailwind v4 PostCSS config and site package dependencies so `apps/site` CSS compiles instead of shipping raw `@theme` rules.
- Updated public site footer, location page, and ID/EN/ZH messages to show only Yogyakarta stores and `@aroadri.tea` social handles.
- Seed now uses active store locations only for Malioboro Mall and Plaza Malioboro; old generic YOG/JKT seed rows are marked inactive.
- Added GPS custom field seed values for attendance validation per active store.
- Replaced hardcoded report/opname location choices with active location options loaded from DB.
- Added server-side journal attachment upload/download/delete storage through local VPS filesystem.
- Hardened journal attachment permissions so create/list/delete use the actual journal location and tenant scope.
- Fixed POS offline banner critical state, HR attendance GPS validation, HR employee attendance summary, seed role/permission idempotency, and Naixer PLZ label config.
- Cleaned stale task/checkpoint wording that described older interim work.
- Verified `pnpm lint:fix`, `pnpm typecheck`, `pnpm --filter @erp/services exec vitest run`, and `pnpm build` locally.
- Pushed commit `aeeb295` to GitHub, pulled it on VPS, built on server, seeded production DB from `.env`, reloaded PM2, and verified site/web/MCP health endpoints.
- Live smoke: `https://aroadritea.com` returned 200, served compiled Next CSS without raw `@theme`, and rendered the designed homepage screenshot at `C:\tmp\aroadritea-home-after.png`.
- Live location smoke: `https://aroadritea.com/id/lokasi` returned 200, contains Malioboro Mall and Plaza Malioboro, and has no Jakarta location copy.

## Decisions

- Public website presents only current customer-facing stores in Yogyakarta: Malioboro Mall and Plaza Malioboro. Jakarta office/store wording is removed from public copy.
- UI input hints are not unfinished work by themselves; the audit targets explicit unfinished markers and user-visible temporary copy.
- Journal attachments use local server storage by default (`JOURNAL_UPLOAD_DIR` or `storage/journal-attachments`) because current HestiaCP/PM2 deployment does not depend on S3/R2.

## Open issues / Questions

- None at this checkpoint.

## Next step

None. Monitor live PM2 logs and user traffic after production use.

## Test status

- **Unit**: `pnpm --filter @erp/services exec vitest run` — 24 files, 527 tests passed
- **Typecheck**: `pnpm typecheck` — passed
- **Build**: `pnpm build` — passed for worker, MCP, site, web
- **Server deploy**: `git pull --ff-only`, `pnpm install --frozen-lockfile`, `pnpm build`, sourced `.env`, `pnpm db:seed`, `pnpm jobs:disable-unconfigured`, `pm2 reload`, `pm2 save` — passed
- **Health**: local VPS `site`, `web`, and `mcp` endpoints returned `status: ok`
- **E2E/browser**: post-deploy screenshot captured at `C:\tmp\aroadritea-home-after.png`

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | modified | Added T-0163 active task |
| `apps/site/package.json` | modified | Added Tailwind/PostCSS deps |
| `apps/site/postcss.config.mjs` | added | Tailwind v4 PostCSS plugin |
| `apps/site/messages/*.json` | modified | Yogyakarta-only copy and social labels |
| `apps/site/app/[locale]/lokasi/page.tsx` | modified | Active store data + fallback full addresses |
| `packages/db/seed/*` | modified | Yogyakarta-only active store seeds, GPS settings, Naixer PLZ config |
| `apps/web/app/(dash)/pos/*` | modified | Offline banner failed retry state |
| `apps/web/app/(dash)/reporting/*` | modified | Active location dropdowns |
| `apps/web/app/(dash)/inventory/opname/new/*` | modified | Active location dropdowns |
| `apps/web/app/(dash)/accounting/journals/*` | modified | Server attachment storage/upload/download |
| `packages/services/src/hr/attendance-service.ts` | modified | Real GPS validation |
| `packages/services/tests/journal-attachments.test.ts` | added | Cross-location permission tests |
| `docs/checkpoints/T-0163-public-site-css-location-production-audit.checkpoint.md` | added | New checkpoint |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| aeeb295 | fix: harden public site and production readiness | 2026-05-15 |
