# Checkpoint: T-0168 — Security audit and overnight operational fixes

- **Owner**: Codex
- **Started**: 2026-05-21 19:24 WIB
- **Last updated**: 2026-05-21 19:34 WIB
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
2. [ ] Audit dan perbaiki flow member forgot password serta error `member.completeSignup.createFailed` bila masih terkait.
3. [ ] Sweep trigger email dan perbaiki gap trigger/template multilingual.
4. [ ] Perbaiki AP/AR reminder query dan tambahkan regresi.
5. [ ] Perbaiki scroll halaman manual sales.
6. [ ] Pastikan dropdown outlet mengecualikan kantor.
7. [ ] Baca ulang Excel Malioboro Mei dan selaraskan seed kode barang/produk/stok.
8. [ ] Tambah modul surat menyurat sesuai SoT/SD.
9. [ ] Tambah panduan setup printer di docs dan halaman panduan bila ada.
10. [ ] Jalankan audit keamanan Fase 1-5, commit atomik, dan verifikasi akhir.

## Done so far

- Task T-0168 didaftarkan di `TASK.md`.
- Checkpoint dibuat sebelum baseline dan sebelum edit kode fitur.
- Fase 0 baseline selesai dan dicatat di `docs/audit/00-baseline.md`.
- `pnpm typecheck` PASS, `pnpm test` PASS (593 tests), `pnpm lint` baseline FAIL (316 errors, 482 warnings), `pnpm audit --prod` PASS.

## Decisions

- Pekerjaan besar ini dipisahkan dari T-0167 supaya audit keamanan dan fix terbaru punya jejak baseline, checkpoint, dan commit sendiri.

## Open issues / Questions

- User mengizinkan reset database karena belum ada input data selain seed. Reset tetap akan dipakai hanya bila diperlukan untuk menerapkan seed/foto/kode yang sudah diperbaiki.

## Next step

Audit dan perbaiki flow member forgot password serta cek error `member.completeSignup.createFailed`: baca `packages/services/src/member`, `apps/site/actions/member.ts`, dan route member terkait, lalu tambahkan regresi sebelum patch.

## Test status

- **Unit**: baseline `pnpm test` PASS (593 tests)
- **Integration**: belum dijalankan untuk T-0168
- **E2E**: belum dijalankan untuk T-0168

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `TASK.md` | Updated | Add T-0168 active task |
| `docs/checkpoints/T-0168-security-audit-fix.checkpoint.md` | Added | New checkpoint |
| `docs/audit/00-baseline.md` | Added | Fase 0 baseline summary |
| `docs/audit/00-*.txt` | Added | Raw baseline command logs |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(belum ada)_ | | |

## Handoff Notes

- Mulai dari baseline Fase 0 sebelum edit fitur agar laporan audit punya pembanding yang sah.
