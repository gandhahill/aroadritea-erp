# Checkpoint: T-0168 — Security audit and overnight operational fixes

- **Owner**: Codex
- **Started**: 2026-05-21 19:24 WIB
- **Last updated**: 2026-05-22 01:08 WIB
- **Status**: DONE
- **Phase**: Cross-cutting production readiness and security audit
- **Branch**: master

## Goal

Menuntaskan perbaikan operasional terbaru untuk Aroadri Tea ERP, lalu menjalankan audit keamanan, bug fungsional, dan integritas data secara bertahap sesuai prompt user. Rujukan utama: `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, ADR-0001, ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0011, dan ADR lain yang relevan saat modul disentuh.

**Kriteria selesai (Definition of Done):**
- [x] Fase 0 baseline tercatat di `docs/audit/00-baseline.md`.
- [x] Fitur lupa password member tersedia, single-use/expired, email multilingual, dan dites.
- [x] Trigger email kritis dicek, gap diperbaiki atau didokumentasikan.
- [x] AP/AR reminder query tidak gagal dan punya regresi.
- [x] Halaman input penjualan manual bisa discroll.
- [x] Dropdown outlet tidak menampilkan kantor.
- [x] Seed inventory Malioboro Mei selaras dengan Excel manajer inventory.
- [x] Modul surat menyurat tersedia dengan CRUD, i18n, permission, audit trail.
- [x] Panduan setup printer mencakup kiosk/direct print.
- [x] Audit Fase 1-5 menghasilkan dokumen sesuai prompt dan temuan kritis/high diperbaiki atau punya REC.
- [x] `pnpm typecheck`, `pnpm test`, `pnpm lint`, dan `pnpm build` diverifikasi sesuai status akhir.

## Plan

1. [x] Jalankan Fase 0 baseline dan dokumentasikan status awal.
2. [x] Audit dan perbaiki flow member forgot password serta error `member.completeSignup.createFailed` bila masih terkait.
3. [x] Sweep trigger email dan perbaiki gap trigger/template multilingual.
4. [x] Perbaiki AP/AR reminder query dan tambahkan regresi.
5. [x] Perbaiki scroll halaman manual sales.
6. [x] Pastikan dropdown outlet mengecualikan kantor.
7. [x] Baca ulang Excel Malioboro Mei dan selaraskan seed kode barang/produk/stok.
8. [x] Tambah modul surat menyurat sesuai SoT/SD.
9. [x] Tambah panduan setup printer di docs dan halaman panduan bila ada.
10. [x] Jalankan audit keamanan Fase 1-5, commit atomik, dan verifikasi akhir.

## Done so far

- Task T-0168 didaftarkan di `TASK.md`.
- Checkpoint dibuat sebelum baseline dan sebelum edit kode fitur.
- Fase 0 baseline selesai dan dicatat di `docs/audit/00-baseline.md`.
- `pnpm typecheck` PASS, `pnpm test` PASS (593 tests), `pnpm lint` baseline FAIL (316 errors, 482 warnings), `pnpm audit --prod` PASS.
- Member forgot-password flow ditambahkan: request reset, complete reset, single-use token, session revocation, multilingual email, site pages, login link, dan 3 regresi service.
- AP/AR reminder worker diperbaiki: predicate tanggal diganti ke date arithmetic PostgreSQL yang aman, timezone Asia/Jakarta, join akun/partner tenant-safe, dan channel email `party_ledger` bisa dikonfigurasi.
- Scroll dashboard/manual sales diperbaiki dengan `h-dvh`, `min-h-0`, dan padding bawah halaman supaya form + histori tetap bisa diakses.
- Dropdown outlet operasional untuk POS manual, stock opname, quick adjustment, purchase order, POS settings, dan Naixer sudah dibatasi ke lokasi aktif bertipe `store`; lokasi kantor tetap tersedia untuk modul yang memang memerlukan lokasi administrasi seperti accounting asset/journal/HR.
- Excel `D:\KERJA\Aroadri Tea\2026\05\Malioboro Mall Mei.xlsx` dibaca ulang. Seed minggu 1 Egg Tart dikoreksi dari 45 ke 60, semua 52 kode menu manager dimasukkan ke atribut variant `managerInventoryCode`, dan import movement sekarang menerima kode manager Excel maupun SKU internal serta menolak variant code yang tidak ditemukan.
- Modul surat menyurat ditambahkan: SoT/SD, migration/schema `correspondence_records`, permission seed, service CRUD soft-delete dengan audit trail, UI register/detail, sidebar, dan i18n ID/EN/ZH.
- Panduan printer di halaman Docs diperluas untuk printer detection, Print Bridge, dan `--kiosk-printing`; runbook printer sudah menjadi referensi teknis lengkap.
- Fase 1 audit dibuat: `docs/audit/01-attack-surface.md`, `docs/audit/security-runtime-inventory.md`, dan `docs/audit/repository-coverage-ledger.md`.
- Fase 2 static findings dibuat: `docs/audit/02-static-findings.md` plus raw logs.
- High-impact findings fixed: CMS sanitizer `6694f87`, reporting scope `8303341`, POS tracked stock guard `0ea52eb`.
- POS manual discount governance ditambahkan `074f2d6` dan panduan/runbook diperluas `1741a4d`.
- Accounting transaction evidence surfaced via correspondence finance filter `b70f810`.
- Old POS photos reviewed and shortcut parity added `0b9e4ea`; remaining hardware/business gaps documented in `docs/runbook/pos-legacy-parity.md`.
- Final report dibuat: `docs/audit/AUDIT-REPORT.md`.
- Production deploy verification selesai: remote head `2f00ce4`, migration/seed/build/PM2 reload/health checks PASS. Evidence: `docs/audit/03-deployment-verification.md`.
- Security note: `pm2 jlist` exposes runtime environment secrets; values are not documented, but credential rotation is recommended after this audit window.

## Decisions

- Pekerjaan besar ini dipisahkan dari T-0167 supaya audit keamanan dan fix terbaru punya jejak baseline, checkpoint, dan commit sendiri.

## Open issues / Questions

- User mengizinkan reset database karena belum ada input data selain seed. Reset tetap akan dipakai hanya bila diperlukan untuk menerapkan seed/foto/kode yang sudah diperbaiki.

## Next step

T-0168 selesai. Follow-up yang masih perlu keputusan/manual verification ada di `docs/audit/AUDIT-REPORT.md` bagian Rekomendasi Follow-up: terutama POS atomic write path, lint cleanup branch, decimal quantity utility, smoke test printer/cash-drawer di perangkat outlet, dan rotasi credential produksi.

## Test status

- **Unit**: baseline `pnpm test` PASS (593 tests)
- **Focused**: `pnpm --filter @erp/services test -- member-password-reset` PASS (3 tests)
- **Focused**: `pnpm --filter @erp/services test -- notification-channel` PASS (1 test)
- **Focused typecheck**: `pnpm --filter @erp/services typecheck` PASS; `pnpm --filter @erp/site typecheck` PASS
- **Focused typecheck**: `pnpm --filter @erp/worker typecheck` PASS; `pnpm --filter @erp/web typecheck` PASS
- **Focused typecheck**: `pnpm --filter @erp/web typecheck` PASS; `pnpm --filter @erp/services typecheck` PASS after manual-sales/outlet-scope patch
- **Focused typecheck**: `pnpm --filter @erp/db typecheck` PASS; `pnpm --filter @erp/services typecheck` PASS after Malioboro seed/import patch
- **Focused**: `pnpm --filter @erp/services test -- inventory-import-code` PASS (2 tests)
- **Focused typecheck**: `pnpm --filter @erp/db typecheck` PASS; `pnpm --filter @erp/services typecheck` PASS; `pnpm --filter @erp/web typecheck` PASS after correspondence/docs patch
- **Focused**: `pnpm --filter @erp/services test -- correspondence` PASS (2 tests)
- **Full typecheck**: `pnpm -r typecheck` PASS (10 workspace packages)
- **Full test**: `pnpm -r test` PASS (614 tests: 65 shared + 549 services)
- **Build**: `pnpm build` PASS (worker, MCP, site, web)
- **Deploy**: VPS pull/install/migrate/seed/build/PM2 reload/save PASS; site/web/MCP health endpoints PASS
- **Lint**: `pnpm lint` FAIL baseline (332 errors, 488 warnings)
- **Integration**: build and focused service regressions passed; hardware/printer smoke remains manual
- **E2E**: belum dijalankan untuk T-0168

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Updated | Add T-0168 active task |
| `docs/checkpoints/T-0168-security-audit-fix.checkpoint.md` | Added | New checkpoint |
| `docs/audit/00-baseline.md` | Added | Fase 0 baseline summary |
| `docs/audit/00-*.txt` | Added | Raw baseline command logs |
| `packages/services/src/member/index.ts` | Updated | Password reset service + welcome email trigger |
| `packages/services/tests/member-password-reset.test.ts` | Added | Reset token/service regression |
| `apps/site/actions/member.ts` | Updated | Password reset actions |
| `apps/site/components/password-reset-*.tsx` | Added | Reset request/complete forms |
| `apps/site/app/[locale]/member/lupa-password/page.tsx` | Added | Forgot password route |
| `apps/site/app/[locale]/member/reset-password/page.tsx` | Added | Reset password route |
| `apps/site/app/[locale]/member/masuk/page.tsx` | Updated | Forgot password link |
| `apps/site/messages/*.json` | Updated | ID/EN/ZH reset-password i18n |
| `apps/worker/src/jobs/party-ledger-reminders.ts` | Updated | Fix due-date predicate, tenant-safe joins, email channel trigger |
| `packages/services/src/notification/index.ts` | Updated | Add `party_ledger` notification purpose |
| `apps/web/app/(dash)/settings/notifications/*` | Updated | Expose party ledger email purpose |
| `packages/services/tests/notification-channel.test.ts` | Added | Regression for party ledger channel purpose |
| `apps/web/app/(dash)/layout.tsx` | Updated | Dashboard scroll container uses viewport-safe height/min-height |
| `apps/web/app/(dash)/pos/manual-sales/manual-sales-client.tsx` | Updated | Manual sales page has bottom scroll breathing room |
| `packages/services/src/pos/manual-sales.ts` | Updated | Manual sales location list is outlet/store-only |
| `apps/web/app/(dash)/inventory/opname/new/page.tsx` | Updated | Opname outlet dropdown excludes office locations |
| `apps/web/app/(dash)/inventory/adjust/actions.ts` | Updated | Quick adjustment outlet dropdown excludes office locations |
| `apps/web/app/(dash)/purchasing/actions.ts` | Updated | PO destination dropdown excludes office locations |
| `apps/web/app/(dash)/settings/integrations/naixer/actions.ts` | Updated | Naixer format config limited to outlet/store locations |
| `packages/db/seed/malioboro-may-inventory.ts` | Updated | Correct Egg Tart week 1 usage from manager Excel |
| `packages/db/seed/menu.ts` | Updated | Store manager Excel menu codes on product variants |
| `packages/db/schema/stock-opname.ts` | Updated | Stock opname kind comments include daily/weekly/monthly |
| `packages/services/src/inventory/import-service.ts` | Updated | Import variant matching accepts manager codes and rejects unknown variants |
| `packages/services/tests/inventory-import-code.test.ts` | Added | Regression for manager-code variant matching |
| `SOURCE-OF-TRUTH.md` | Updated | Add surat menyurat business requirement |
| `SYSTEM-DESIGN.md` | Updated | Add correspondence technical module spec |
| `packages/db/schema/correspondence.ts` | Added | Correspondence register schema |
| `packages/db/migrations/0022_correspondence_records.sql` | Added | Correspondence table migration |
| `packages/services/src/correspondence/index.ts` | Added | Correspondence CRUD service with audit trail |
| `packages/services/tests/correspondence.test.ts` | Added | Correspondence schema regression |
| `apps/web/app/(dash)/correspondence/*` | Added | Correspondence list/detail UI and server actions |
| `apps/web/messages/*.json` | Updated | Correspondence i18n ID/EN/ZH |
| `apps/web/app/(dash)/docs/docs-content.ts` | Updated | Printer setup steps in in-app guide |
| `docs/audit/01-attack-surface.md` | Added | Fase 1 trust boundary and data flow map |
| `docs/audit/security-runtime-inventory.md` | Added | Repository-wide runtime inventory for security scan |
| `docs/audit/repository-coverage-ledger.md` | Added | Coverage ledger for repository-wide scan |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| `5970cfc` | `docs(audit): record T-0168 baseline [INT-000]` | 2026-05-21 |
| `e52d7e7` | `fix(member): add password reset flow [BUG-001]` | 2026-05-21 |
| `e603514` | `fix(worker): repair party ledger reminders [BUG-002]` | 2026-05-21 |
| `f2547f5` | `fix(web): keep outlet selectors store-only [BUG-003]` | 2026-05-21 |
| `ffa0b8d` | `fix(inventory): align Malioboro manager codes [BUG-004]` | 2026-05-21 |
| `8a103f7` | `feat(admin): add correspondence register [BUG-005]` | 2026-05-21 |
| `0b1f0ca` | `docs(audit): map attack surface [SEC-000]` | 2026-05-21 |
| `6694f87` | `fix(site): sanitize public CMS HTML [SEC-001]` | 2026-05-21 |
| `c1e29e7` | `fix(shared): keep money math in bigint [INT-001]` | 2026-05-21 |
| `8303341` | `fix(reporting): scope financial report access [SEC-002]` | 2026-05-21 |
| `074f2d6` | `feat(pos): add governed manual discounts [BUG-006]` | 2026-05-22 |
| `b70f810` | `feat(accounting): surface transaction evidence inbox [BUG-007]` | 2026-05-22 |
| `0b9e4ea` | `feat(pos): add legacy operation shortcuts [BUG-008]` | 2026-05-22 |
| `1741a4d` | `docs(guides): cover POS discounts and evidence flows [BUG-009]` | 2026-05-22 |
| `0ea52eb` | `fix(pos): reject oversold tracked ingredients [INT-002]` | 2026-05-22 |
| `c8c5d68` | `docs(audit): record static findings [SEC-000]` | 2026-05-22 |
| `2f00ce4` | `docs(audit): publish T-0168 final report [SEC-000]` | 2026-05-22 |
| `7e19c36` | `docs(audit): record production deploy verification [SEC-000]` | 2026-05-22 |

## Handoff Notes

- Mulai dari baseline Fase 0 sebelum edit fitur agar laporan audit punya pembanding yang sah.
