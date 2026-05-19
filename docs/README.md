# /docs — Index

This folder is the operational + architectural source-of-truth for the
Aroadri Tea ERP. The two top-level specs sit at the repo root:

- **`../SOURCE-OF-TRUTH.md`** — business requirements (what & why).
- **`../SYSTEM-DESIGN.md`** — technical design (how).
- **`../CLAUDE.md`** — guide for AI assistants (conventions, rules).
- **`../TASK.md`** — live task register.

What lives in `docs/`:

## Architecture Decision Records — `adr/`

Numbered ADRs document major decisions and their tradeoffs. See
[`adr/README.md`](./adr/README.md) for the full index.

- **[0001](./adr/0001-stack-choice.md)** — Stack: Next.js 15 + Drizzle + Postgres. _(Caddy mention superseded by ADR-0012)_
- **[0002](./adr/0002-monorepo-and-app-split.md)** — Monorepo `site`/`web`/`mcp`/`worker`. _(Reverse-proxy refs superseded by ADR-0012)_
- **[0003](./adr/0003-public-website-cms-architecture.md)** — Public site + internal CMS. _(1 GB RAM ref obsolete: now 2 GB)_
- **[0004](./adr/0004-member-registration-and-auth.md)** — Member auth via email OTP + Turnstile.
- **[0005](./adr/0005-build-vs-modify-existing-erp.md)** — Custom build vs Odoo/ERPNext.
- **[0006](./adr/0006-design-system-anti-generic.md)** — Anti-generic UI; brand tokens + lint guards.
- **[0007](./adr/0007-naixer-qr-integration.md)** — Naixer KDS via QR only.
- **[0008](./adr/0008-pos-demo-mode-client-side.md)** — POS demo mode in IndexedDB only.
- **[0009](./adr/0009-resilience-and-auto-recovery.md)** — RTO 2 min / RPO 0 POS. _(Deployment portion superseded by ADR-0012)_
- **[0010](./adr/0010-ppn-engine-opt-in.md)** — PPN opt-in for retail F&B.
- **[0011](./adr/0011-hestiacp-smtp-transactional-email.md)** — Transactional email via HestiaCP SMTP.
- **[0012](./adr/0012-pm2-hestiacp-production-runtime.md)** — PM2 + HestiaCP/Nginx (replaces ADR-0001/0002/0009 runtime portions).

## Operational guides

- **[PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md)** — PM2 + HestiaCP go-live checklist.
- **[CONFIGURATION.md](./CONFIGURATION.md)** — env vars + DB settings reference.
- **[TRACEABILITY-AUDIT.md](./TRACEABILITY-AUDIT.md)** — SoT / SD coverage matrix.

## Runbooks — `runbook/`

Step-by-step recovery / operational procedures.

- **[db-reset.md](./runbook/db-reset.md)** — Reset development database safely.
- **[server-outage.md](./runbook/server-outage.md)** — VPS outage triage (RTO 2 min). _(NEW 2026-05-19)_
- **[restore-from-backup.md](./runbook/restore-from-backup.md)** — Restore Postgres + uploaded assets from backup. _(NEW 2026-05-19)_
- **[pos-demo-mode.md](./runbook/pos-demo-mode.md)** — Train new cashiers on the POS demo sandbox. _(NEW 2026-05-19)_
- **[pos-offline-recovery.md](./runbook/pos-offline-recovery.md)** — Resync POS PWA after extended offline. _(NEW 2026-05-19)_
- **[i18n.md](./runbook/i18n.md)** — Add a translation key + locale consistency. _(NEW 2026-05-19)_
- **[printer-setup.md](./runbook/printer-setup.md)** — Kiosk printing + per-outlet printer profiles. _(NEW 2026-05-19)_

## Checkpoints — `checkpoints/`

Per-task progress notes — see [`checkpoints/README.md`](./checkpoints/README.md). Older than 7 days move
to `checkpoints/archive/`.

## Reference docs

- **[custom-field-engine.md](./custom-field-engine.md)** — What the custom-field engine is for, and when to use it vs adding a real column. _(NEW 2026-05-19)_

---

**Last reviewed:** 2026-05-19 — overnight audit added README + missing runbooks per the docs-audit report.
