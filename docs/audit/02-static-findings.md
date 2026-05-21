# Phase 2 Static Findings

**Date:** 2026-05-22
**Task:** T-0168
**Scan target:** repository-wide
**Related artifacts:** `02-typecheck.txt`, `02-lint.txt`, `02-deps.txt`

## Command Results

| Command | Status | Notes |
|---|---|---|
| `pnpm -r typecheck` | PASS | All 10 workspace packages completed typecheck. |
| `pnpm lint` | FAIL baseline | Final rerun reported 332 errors and 488 warnings across 550 checked files. Dominant class is formatting/import/a11y legacy debt, not a newly introduced runtime error. |
| `pnpm audit --prod` | PASS | No known production dependency vulnerabilities reported. |
| Dangerous browser-native messages grep | PASS | `alert/confirm/prompt` matches are limited to replacement component comments and sanitizer test payloads. |

## Promoted Findings And Fixes

| ID | Severity | Area | Evidence | Disposition |
|---|---|---|---|---|
| SEC-001 | High | Public CMS rendering | `apps/site/app/[locale]/[slug]/page.tsx`, `apps/site/app/[locale]/blog/[slug]/page.tsx` used HTML rendering path | Fixed in `6694f87 fix(site): sanitize public CMS HTML [SEC-001]`; sanitizer tests added. |
| SEC-002 | High | Reporting access scope | Reporting server actions accepted client-provided tenant/location context and some report services did not pass location to permission check | Fixed in `8303341 fix(reporting): scope financial report access [SEC-002]`; reporting regression tests added. |
| INT-001 | Medium | Money precision | Shared money math could convert bigint cents through `Number` in sensitive arithmetic | Fixed in `c1e29e7 fix(shared): keep money math in bigint [INT-001]`; money regression tests added. |
| INT-002 | High | POS inventory integrity | `packages/services/src/pos/create-sale.ts` used `GREATEST(0, qty - required)` for tracked BOM stock and treated deduction failure as non-blocking | Fixed in `0ea52eb fix(pos): reject oversold tracked ingredients [INT-002]`; POS regression tests added. |

## Reviewed Static Patterns

| Pattern | Result | Notes |
|---|---|---|
| `dangerouslySetInnerHTML` | Reviewed | Public CMS is sanitized after SEC-001. Print routes inject generated CSS/QR SVG from server/client QR library and controlled templates. |
| `eval`, `new Function` | No production matches | No dynamic code execution pattern found in app/service code. |
| `execSync`/interpolated `exec` | No production matches | No command injection surface found in app/service code. |
| Drizzle `sql` interpolation | Reviewed | Matches are parameterized Drizzle fragments or SQL identifiers/aggregates. Dynamic user filters promoted for targeted review where reportable. |
| `@ts-ignore` / `@ts-expect-error` | No promoted finding | No security-relevant suppression found in scanned surfaces. |
| Browser-native `alert/confirm/prompt` | No production usage | Matches are comments/test payloads only. |
| `JSON.parse` | Low risk follow-up | Demo/print sessionStorage parsing can degrade UX if malformed, but it is client-local and not a privileged boundary. |
| `.toFixed` / `Number(...)` | Reviewed | Money path fixed in INT-001. Remaining matches are quantity display, percentages, geolocation display, or tests; quantity service paths remain tracked as follow-up for precision hardening. |

## Deferred / Recommendation Rows

| ID | Severity | Area | Reason |
|---|---|---|---|
| REC-001 | Medium | POS atomicity | The Neon HTTP Drizzle driver used by `packages/db/client.ts` does not support arbitrary multi-step transactions. POS now guards tracked stock and compensates deduction rollback on known failures, but a truly atomic sale+payment+journal+stock unit requires either Neon SQL transaction batching redesign or a PostgreSQL driver that supports transactions for service writes. |
| REC-002 | Low | Lint baseline | Biome lint remains red from legacy formatting/import/a11y debt. It should be cleaned in a dedicated formatting branch to avoid mixing mechanical churn with financial/security fixes. |
| REC-003 | Low | Quantity decimal precision | Quantity math still uses some `Number.parseFloat(...).toFixed(3)` patterns for inventory quantities. Current values are three-decimal operational quantities, but a future decimal utility should replace ad hoc formatting in service code. |
| REC-004 | Low | Demo print JSON parse | Demo receipt/label pages parse sessionStorage without a user-facing fallback. It does not cross trust boundaries, but a graceful empty-state would improve UX. |

## Conclusion

Static analysis did not find unresolved Critical findings. High-impact findings discovered during this phase were fixed or converted to explicit recommendations where the remaining work needs architecture/runtime change rather than a safe local patch.
