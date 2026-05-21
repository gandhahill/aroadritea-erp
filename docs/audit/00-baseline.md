# Aroadritea ERP Audit Baseline

**Tanggal:** 2026-05-21 19:24-19:32 WIB  
**Auditor:** Codex  
**Task:** T-0168 Security audit and overnight operational fixes  
**Scope awal:** working tree setelah commit `42ed262` / `1419720` plus task/checkpoint T-0168.

## Status Perintah Baseline

| Perintah | Status | Ringkasan | Log |
|---|---:|---|---|
| `pnpm install --frozen-lockfile` | PASS | Lockfile up to date, workspace sudah terpasang. | `docs/audit/00-install.txt` |
| `pnpm typecheck` | PASS | 10 workspace project typecheck hijau. | `docs/audit/00-typecheck.txt` |
| `pnpm test` | PASS | 29 test files, 593 tests lulus: shared 58, services 535. | `docs/audit/00-test.txt` |
| `pnpm lint` | FAIL | Biome memeriksa 535 files dan menemukan 316 errors + 482 warnings. Mayoritas baseline berupa format/import order/legacy lint debt. | `docs/audit/00-lint.txt` |
| `pnpm audit --prod` | PASS | Tidak ada vulnerability produksi yang diketahui. | `docs/audit/00-deps.txt` |

## Scope File Per Workspace

| Workspace / Modul | Perkiraan file |
|---|---:|
| `apps/web` | 299 |
| `apps/site` | 65 |
| `apps/mcp` | 14 |
| `apps/worker` | 13 |
| `packages/db` | 70 |
| `packages/services` | 121 |
| `packages/shared` | 14 |
| `packages/offline` | 8 |
| `packages/ui` | 3 |
| `packages/ui-public` | 3 |

Total scope kasar: **610 files**. Biome baseline memeriksa 535 files karena mengikuti include/exclude konfigurasi tool.

## Modul Prioritas Audit

1. Member auth dan email: forgot password, OTP, complete signup, multilingual email.
2. Accounting/AP/AR: reminder due date, journal synchronization, account visibility, no UUID leak.
3. POS/manual sales: scrollability, receipt parity, old POS daily closing input.
4. Inventory: Excel Malioboro Mei seed alignment, stock opname bucket, outlet-only context.
5. Administration: correspondence/surat menyurat module, printer setup guide.
6. Security sweep: server actions, API routes, MCP tools, upload paths, financial/PII/offline paths.

## Estimasi Durasi

Estimasi realistis untuk seluruh prompt tanpa interupsi:

| Tahap | Estimasi |
|---|---:|
| Fix operasional prioritas user | 8-14 jam |
| Modul surat menyurat + tes + i18n | 4-7 jam |
| Excel seed reconciliation + reset/deploy verification | 2-4 jam |
| Security audit Fase 1-5 penuh | 1.5-3 hari kerja |

Total end-to-end dengan kualitas produksi: **2-4 hari kerja**. Pada sesi ini saya akan terus lanjut otomatis pada item yang bisa diselesaikan tanpa keputusan bisnis/destructive migration tambahan.

## Catatan Baseline

- `typecheck` dan `test` hijau sebelum perubahan T-0168.
- `lint` sudah merah sebelum perubahan fitur; perubahan baru tetap harus dijaga tidak menambah debt yang tidak perlu.
- Dependency production audit bersih.
