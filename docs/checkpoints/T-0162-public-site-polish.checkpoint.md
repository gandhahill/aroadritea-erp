# T-0162 Public Site Polish + Production Hardening

## Status

IN_PROGRESS

## Scope

- Improve `apps/site` homepage/header/footer from placeholder UI to brand-aligned public website.
- Replace hardcoded/demo public menu content with Aroadri Tea real menu, pricing, and product photos.
- Revise POS member lookup flow to cashier phone lookup + name confirmation.
- Audit and harden critical POS, accounting, reporting, and tax paths before production.
- Scan repository for unresolved placeholder/TODO/deferred markers and fix production-blocking, user-facing items.

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

## Verification

- `pnpm --filter @erp/services typecheck` passed.
- `pnpm --filter @erp/mcp typecheck` passed.
- `pnpm --filter @erp/services test` passed: 23 files, 523 tests.
- `pnpm lint` passed with 460 legacy warnings and no errors.
- `pnpm test` passed: 27 files, 581 tests.
- `pnpm build` passed for worker, MCP, site, and web. Local build warns `DATABASE_URL not set`; production/server env must provide it.
- Earlier in the same hardening pass, `@erp/web`, `@erp/offline`, and `@erp/site` typechecks also passed.
- i18n parity passed for web and site ID/EN/ZH.

## Remaining scan items

Production-critical POS/accounting/tax placeholders are resolved. Remaining non-critical or separately scoped scan hits:

- `apps/worker/src/jobs/backup.ts`: backup handler still needs real storage/runtime configuration; do not rely on current worker backup as proof of off-site backup.
- `apps/worker/src/jobs/stock-low-alert.ts`, `payroll-batch.ts`, `isr-revalidate.ts`: scheduled worker jobs still need final implementation or explicit default disablement before relying on them operationally.
- `apps/web/app/(dash)/accounting/journals/[id]/attachments-list.tsx`: upload UI still says object storage endpoint must be configured; journal attachment list/delete exists.
- `apps/mcp/src/tools/phase2.ts`: historical Phase 2+ stub file still contains informative not-implemented responses; current registered tools should be checked before production exposure.
- `packages/services/src/hr/attendance-service.ts`: GPS coordinate validation is waiting for real location coordinate schema.
- Many `placeholder=` matches are normal HTML input placeholders and not unfinished code.
- Older checkpoint files still describe historical placeholders that have since been implemented.

## Next step

Decide whether T-0162 can close now or whether to add a separate task for worker backup/stock/payroll/ISR production completion. If closing, commit and push the current changes, then deploy/pull on the VPS and restart PM2.
