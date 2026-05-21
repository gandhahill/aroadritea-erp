# Security Scan Runtime Inventory

**Date:** 2026-05-21
**Task:** T-0168

This file supports the repository-wide security scan workflow. It records the concrete runtime surfaces so later findings can be checked for source-to-sink coverage rather than isolated pattern matches.

## Applications

| App | Runtime | Primary purpose | Public exposure |
|---|---|---|---|
| `apps/web` | Next.js App Router | ERP staff UI, POS, accounting, inventory, HR, purchasing, reporting, uploads, POS sync | Authenticated ERP domain plus selected APIs. |
| `apps/site` | Next.js App Router | Public website and member portal | Public domain, member auth/actions, careers API. |
| `apps/mcp` | Hono/MCP HTTP server | AI tool interface over ERP data | Token-authenticated machine API. |
| `apps/worker` | Node/pg-boss worker | Cron/jobs/notifications/backup/revalidation | Not public; talks to DB and external services. |

## External Services

| Service | Caller | Secret/env boundary | Risk controls to verify |
|---|---|---|---|
| Managed PostgreSQL | All apps | `DATABASE_URL` | SSL in production, no secrets in logs, transactional writes for critical flows. |
| SMTP/HestiaCP mailbox | member service, notifications, outage job | `SMTP_*` | Multilingual templates, logo branding, graceful failure. |
| BinderByte shipment tracking | purchasing service/UI | `BINDERBYTE_API_KEY` | Cache every request, monthly quota guard, manual sync only. |
| ISR revalidation URL | worker | `SITE_REVALIDATE_URL`, `SITE_REVALIDATE_SECRET` | Signed endpoint, fail-closed when unset. |
| Healthcheck targets | worker outage monitor | config/env | No SSRF pivot to internal network. |

## High-Value Data Stores

| Data | Tables/modules | Security concern |
|---|---|---|
| Staff identity/RBAC | `users`, `roles`, `permissions`, `user_roles`, auth route | Broken access control, stale sessions, permission bypass. |
| Member PII | `members`, `member_otp_codes`, `member_sessions`, member credentials | Encryption at rest, OTP replay, password reset misuse. |
| Journals/ledger | `journal_entries`, `journal_lines`, `accounts`, `accounting_periods` | Integrity, balance, period close, AP/AR due-date notification. |
| POS sales | `sales_orders`, `sales_order_lines`, `payments`, `refunds`, `idempotency_records` | Duplicate offline sync, refund abuse, stock and journal atomicity. |
| Inventory | products, variants, BOM, stock levels/movements/opname | Negative stock, wrong codes, stock loss during transfer. |
| Uploads | `storage/uploads`, journal attachment storage | Cross-tenant private read, path traversal, unsafe content. |

## Entry Point Counts

| Kind | Count |
|---|---:|
| ERP web server-action files | 50 |
| ERP web API route files | 7 |
| Public/member site API/action files | 4 |
| MCP tool files | 7 |
| Worker job files | 7 |
| Service source files | 94 |

Counts are based on `rg --files` inventory on 2026-05-21 after commit `8a103f7`.
