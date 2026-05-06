# Checkpoint: T-0001 — Scaffold pnpm workspace + apps/web stub + packages skeleton

- **Owner**: Claude Opus 4.6
- **Started**: 2026-05-06 10:00 WIB
- **Last updated**: 2026-05-06 10:30
- **Status**: 🟩 DONE
- **Phase**: 1
- **Branch**: feat/T-0001-scaffold

## Goal

Membuat fondasi monorepo pnpm workspace sesuai SYSTEM-DESIGN §6, lengkap dengan stub untuk keempat app dan semua package. Semua app dan package harus bisa di-typecheck tanpa error.

- Spec teknis: SYSTEM-DESIGN §6 (Repository Layout), §5 (Stack)
- ADR terkait: ADR-0001 (Stack Choice), ADR-0002 (Monorepo + App Split)

**Kriteria selesai (Definition of Done):**
- [x] `pnpm-workspace.yaml` + root `package.json` terkonfigurasi
- [x] `tsconfig.base.json` shared config
- [x] `biome.json` linter config
- [x] `.env.example` dengan variabel yang dibutuhkan
- [x] `apps/web` — Next.js 15 stub (App Router) dengan layout minimal
- [x] `apps/site` — Next.js 15 stub (App Router) dengan layout minimal
- [x] `apps/mcp` — Hono stub dengan entry point
- [x] `apps/worker` — Node stub dengan entry point
- [x] `packages/db` — skeleton (index.ts, client.ts placeholder)
- [x] `packages/shared` — skeleton (result, errors, money, id, date, types, ports)
- [x] `packages/services` — skeleton subdirs per modul
- [x] `packages/ui` + `packages/ui-public` — skeleton
- [x] `pnpm install` sukses
- [x] `pnpm typecheck` (tsc --noEmit) sukses di semua workspace

## Plan

1. [x] Init git repo + .gitignore
2. [x] Root config: package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, .env.example
3. [x] apps/web — Next.js 15 stub
4. [x] apps/site — Next.js 15 stub
5. [x] apps/mcp — Hono stub
6. [x] apps/worker — Node stub
7. [x] packages/db — skeleton
8. [x] packages/shared — skeleton (result, errors, money, id, date, types, ports)
9. [x] packages/services — skeleton
10. [x] packages/ui + packages/ui-public — skeleton
11. [x] pnpm install
12. [x] pnpm typecheck — verify all pass

## Done so far

- Root: package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, .env.example, .gitignore
- apps/web: Next.js 15 stub with layout, page, (auth)/login, (dash)/layout
- apps/site: Next.js 15 stub with layout, page, (public), (member), api dirs
- apps/mcp: Hono server with /healthz endpoint + auth stub
- apps/worker: Node entry with SIGTERM handler
- packages/db: Drizzle client (Neon), schema stubs (auth, accounting, inventory, audit), seed stub
- packages/shared: result (Result<T,E>), errors (AppError), money (bigint Money type), id (UUID), date, types (Locale, Paginated), ports (InventoryPort), i18n-keys
- packages/services: 18 module stubs (accounting, inventory, pos, etc.)
- packages/ui + packages/ui-public: skeleton with React deps
- scripts/seed.ts, scripts/reset-dev-db.ts
- docker/, .github/workflows/ directories

## Decisions

_(belum ada)_

## Open issues / Questions

_(belum ada)_

## Next step

Task selesai. Lanjutkan ke T-0002 (Setup Drizzle ORM + connection ke Neon) atau T-0003 (Tailwind config + token brand) atau T-0004 (packages/shared full implementation).

## Test status

- **Unit**: N/A (scaffold only)
- **Integration**: N/A
- **E2E**: N/A

## Files Touched

| Path | Action | Note |
|------|--------|------|
| _(updating as work progresses)_ | | |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(belum ada)_ | | |

## Handoff Notes

_(opsional)_
