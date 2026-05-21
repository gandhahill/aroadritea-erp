# Checkpoint: T-0168 — Security audit and overnight operational fixes

- **Owner**: Codex
- **Started**: 2026-05-21 19:24 WIB
- **Last updated**: 2026-05-21 20:43 WIB
- **Status**: IN_PROGRESS
- **Phase**: Cross-cutting production readiness and security audit
- **Branch**: master

## Goal

Menuntaskan perbaikan operasional terbaru untuk Aroadri Tea ERP, lalu menjalankan audit keamanan, bug fungsional, dan integritas data secara bertahap sesuai prompt user. Rujukan utama: `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, ADR-0001, ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0011, dan ADR lain yang relevan saat modul disentuh.

**Kriteria selesai (Definition of Done):**
- [ ] Fase 0 baseline tercatat di `docs/audit/00-baseline.md`.
- [ ] Fitur lupa password member tersedia, single-use/expired, email multilingual, dan dites.
- [ ] Trigger email kritis dicek, gap diperbaiki atau didokumentasikan.
- [ ] AP/AR reminder query tidak gagal dan punya regresi.
- [ ] Halaman input penjualan manual bisa discroll.
- [ ] Dropdown outlet tidak menampilkan kantor.
- [ ] Seed inventory Malioboro Mei selaras dengan Excel manajer inventory.
- [ ] Modul surat menyurat tersedia dengan CRUD, i18n, permission, audit trail.
- [ ] Panduan setup printer mencakup kiosk/direct print.
- [ ] Audit Fase 1-5 menghasilkan dokumen sesuai prompt dan temuan kritis/high diperbaiki atau punya REC.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, dan `pnpm build` diverifikasi sesuai status akhir.

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
10. [ ] Jalankan audit keamanan Fase 1-5, commit atomik, dan verifikasi akhir.

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

## Decisions

- Pekerjaan besar ini dipisahkan dari T-0167 supaya audit keamanan dan fix terbaru punya jejak baseline, checkpoint, dan commit sendiri.

## Open issues / Questions

- User mengizinkan reset database karena belum ada input data selain seed. Reset tetap akan dipakai hanya bila diperlukan untuk menerapkan seed/foto/kode yang sudah diperbaiki.

## Next step

Lanjut Fase 2 audit keamanan: jalankan static sweep sesuai prompt (`typecheck`, `lint`, `audit`, dan `rg` pola berbahaya), tulis `docs/audit/02-static-findings.md`, lalu perbaiki temuan high-impact satu per satu dengan tes regresi.

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
- **Integration**: belum dijalankan untuk T-0168
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

## Handoff Notes

- Mulai dari baseline Fase 0 sebelum edit fitur agar laporan audit punya pembanding yang sah.
