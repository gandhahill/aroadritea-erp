# T-0162 Public Site Polish + Production Hardening

## Status

DONE

## Scope

- Improve `apps/site` homepage/header/footer from the initial UI to brand-aligned public website.
- Replace hardcoded/demo public menu content with Aroadri Tea real menu, pricing, and product photos.
- Revise POS member lookup flow to cashier phone lookup + name confirmation.
- Audit and harden critical POS, accounting, reporting, and tax paths before production.
- Scan repository for unresolved unfinished-work markers and fix production-blocking, user-facing items.

## Context

- User reports `aroadritea.com` renders like plain HTML and asks whether the site actually has a good design.
- User provided real menu categories, prices, customizations, and product-photo folder: `D:\KERJA\Aroadri Tea\Daftar Menu di Online`.
- User revised member flow: cashier asks for phone number, finds member, confirms "atas nama XXX".
- User explicitly marked POS as most critical and later asked accounting + tax to have no bugs before production.
- Relevant requirements: SoT §6, §10-11, §16, §21.3b, §22, §23; SD §14, §19-21, §25.5b, §31, §36, §38.

## Completed in this checkpoint

- Public site now uses brand assets, real menu copy, real product-photo assets, and corrected ID/EN/ZH message parity.
- Real Aroadri Tea menu seed added with fresh milk tea, fresh tea, lemon fresh tea, snow cap milk tea, dessert, and toppings.
- POS member lookup revised to phone-number lookup and cashier confirmation; `pos.createSale` validates active member customer IDs.
- POS critical path hardened:
  - product/variant active validation;
  - submitted price mismatch rejection;
  - integer positive quantity;
  - discount cap;
  - shift/location permission scoping;
  - non-cash overpay rejection;
  - cash overpay retained as change/donation-safe payment amount;
  - stock movement reference ID fixed;
  - sales journal entries auto-posted instead of left draft;
  - PB1 journal line tagged with `taxCode`.
- Delivery-channel POS journal posting corrected:
  - sale-time journal records gross platform receivable/payment;
  - revenue remains PB1-exclusive;
  - platform commission remains for settlement accounting/reporting, not deducted at sale-time.
- Accounting hardening:
  - reverse journal uses `accounting.journal.reverse`;
  - COA/journal server actions derive tenant/user from session instead of caller payload;
  - journal/COA detail permission checks are scoped to location where applicable;
  - trial balance now marks `isPreliminary` when any period up to the report date is in `closing`.
- Tax/reporting hardening:
  - `tax.listRates` and `tax.resolve` require `tax.view`;
  - `tax.resolve` now filters tax rules by document kind, so `PPN_IN` cannot leak into sales;
  - daily omzet uses actual POS status `paid`, `placed_at` business date, tenant scoping, and `tax.export` for save/export;
  - omzet adjustment UI converts displayed IDR values back to cents before fiscal calculation/save;
  - Coretax MCP export now returns real posted tax-line rows and CSV;
  - MCP `reporting.cash_flow` implemented through a real `cashFlow` service.
- Removed production `console.error` from the POS sync API route.
- Worker scheduled jobs that were still not production-configured now fail closed instead of reporting artificial success.
- Default seed disables unconfigured backup, payroll batch, stock low alert, and ISR revalidation jobs.
- Production DB was updated via `pnpm jobs:disable-unconfigured` so those jobs are disabled on the VPS until explicitly configured.

## Verification

- `pnpm --filter @erp/services typecheck` passed.
- `pnpm --filter @erp/mcp typecheck` passed.
- `pnpm --filter @erp/services test` passed: 23 files, 523 tests.
- `pnpm lint` passed with 460 legacy warnings and no errors.
- `pnpm test` passed: 27 files, 581 tests.
- `pnpm build` passed for worker, MCP, site, and web. Local build warns `DATABASE_URL not set`; production/server env must provide it.
- Earlier in the same hardening pass, `@erp/web`, `@erp/offline`, and `@erp/site` typechecks also passed.
- i18n parity passed for web and site ID/EN/ZH.
- VPS deploy passed at commit `c829e30`: `pnpm install --frozen-lockfile`, `pnpm jobs:disable-unconfigured`, `pnpm build`, `pm2 reload`, and `pm2 save`.
- VPS health checks passed:
  - `site` health OK on `127.0.0.1:3000`;
  - `web` health OK on `127.0.0.1:3001`, including DB latency check;
  - `mcp` health OK on `127.0.0.1:3002`;
  - `https://aroadritea.com/id` returns HTTP 200 and references Next CSS;
  - `https://erp.aroadritea.com/login` returns HTTP 200 without redirecting to localhost.
- PM2 error logs for site/web/MCP/worker are empty after reload; all 4 processes are online.

## Remaining scan items

Production-critical POS/accounting/tax unfinished markers are resolved. Remaining non-critical or separately scoped scan hits:

- Backup is currently expected from the managed database/provider side; the worker backup job is disabled and fail-closed unless `BACKUP_PROVIDER_MANAGED=true` is intentionally set.
- `apps/web/app/(dash)/accounting/journals/[id]/attachments-list.tsx`: upload UI still says object storage endpoint must be configured; journal attachment list/delete exists.
- `apps/mcp/src/tools/phase2.ts`: historical Phase 2+ baseline file still contained informative unavailable responses; current registered tools were checked before production exposure.
- `packages/services/src/hr/attendance-service.ts`: GPS coordinate validation is waiting for real location coordinate schema.
- Many input-hint matches were normal HTML field hints and not unfinished code.
- Older checkpoint files still described historical interim states that have since been implemented.

## Next step

No continuation required for T-0162. For the next production hardening task, configure and verify provider-managed/off-site backup restore, then optionally add dedicated implementation tasks for attachment object storage and HR GPS location policy.
