# Checkpoint: T-0286 — Master plan ERP kelas S/4HANA + pelunasan bug

- **Owner**: Claude Fable 5
- **Started**: 2026-06-10 16:45 WIB
- **Last updated**: 2026-06-10 17:20 WIB
- **Status**: 🟩 DONE
- **Phase**: planning (lintas fase)
- **Branch**: master

## Goal

Menyusun rencana eksekusi tunggal untuk dua permintaan user: (1) menaikkan ERP ke tingkat kelengkapan dan fleksibilitas kelas SAP S/4HANA, (2) melunasi seluruh bug fungsional dan keamanan. Rencana harus bisa dijalankan oleh agen AI paling lemah sekalipun: kartu task atomik, larangan eksplisit, bukti selesai berbasis perintah, dan guardrail yang ditegakkan mesin (CI/hook), bukan prosa.

- Spec bisnis: SOURCE-OF-TRUTH.md (keseluruhan)
- Spec teknis: SYSTEM-DESIGN.md §37 (workflow task)
- Dasar: `docs/audit/erp-feature-completeness-2026-06-09.md` (T-0283), T-0284/T-0285 (approval gate), T-0281 (pentest)

**Kriteria selesai (Definition of Done):**
- [x] Dokumen plan tertulis di `docs/plans/MASTER-PLAN-S4-CLASS.md`
- [x] Struktur fase bergerbang F0–F6 dengan entry/exit criteria terukur
- [x] Kartu lengkap siap eksekusi untuk F0 (6 kartu) dan F1 (3 kartu)
- [x] Kontrak eksekutor (10 aturan + prosedur BLOCKED) untuk agen lemah
- [x] Batas lingkup eksplisit (apa yang TIDAK dibangun dari S/4HANA)
- [x] TASK.md: entri T-0286 + pointer backlog ke plan
- [x] Checkpoint ini terisi

## Done so far

- Survei kondisi repo: 4 apps, 27 service modules, backlog audit 2026-05-29 (T-0211..T-0263) semua DONE, 3 task 🟨 tersisa (T-0279, T-0264, T-0281).
- Temuan penting: `.github/workflows/ci.yml` hanya memantau branch `main`/`develop` padahal branch utama `master`, jadi CI tidak pernah jalan. Diangkat jadi kartu F0.1 (prioritas pertama).
- Temuan kedua: `scripts/check-i18n.mjs` memakai path relatif cwd (`path.resolve('../apps/web')`), hanya benar bila dijalankan dari `scripts/`. Diperbaiki di F0.1.
- Dokumen plan ditulis: `docs/plans/MASTER-PLAN-S4-CLASS.md` (10 pilar kapabilitas S/4 → pemetaan repo, 7 fase, ±69 kartu, prosedur sapu keamanan 11 permukaan, 12 skenario E2E fungsional, DoD program).
- TASK.md diperbarui: entri T-0286 di Active (DONE) + section backlog baru yang menunjuk plan.

## Decisions

- "Kelas S/4HANA" didefinisikan sebagai 10 pilar kapabilitas (universal journal berdimensi, prinsip dokumen, CO, material ledger ringan, extensibility, workflow universal, workspace peran, GRC, MDG ringan, paritas MCP), bukan jiplakan modul SAP. Daftar yang dilarang dibangun ditulis eksplisit (multi-GAAP, MRP, OLAP, scripting tertanam) karena melanggar constraint VPS 2 GB dan SAK ETAP single-entity.
- Untuk agen yang suka melanggar prompt: pertahanan utama bukan prosa melainkan Fase 0 (guardrail mesin: CI di master, script pola terlarang ber-baseline ratchet, larangan direct-DB import, pre-commit, gitleaks, `pnpm verify`). Aturan prosa hanya lapisan kedua.
- Dua peran dipisah: Perencana (memecah kartu per gerbang fase) dan Eksekutor (satu kartu per sesi, dilarang improvisasi). Kartu F2 ke atas sengaja belum dipecah penuh; dipecah saat gerbang fase sebelumnya tutup supaya tidak basi.
- Nomor T-NNNN tidak dipesan di muka oleh plan (hanya kode `Fn.m`) supaya tidak bentrok dengan hotfix yang menyela.

## Open issues / Questions

- Branch protection `master` + secret CI `DATABASE_URL_TEST` mungkin butuh akses admin GitHub milik Lintang (kartu F0.1/F0.6 akan BLOCKED bila token tidak cukup).
- Sisa T-0281 (SPF/DMARC, TLS mcp subdomain) adalah aksi dashboard Cloudflare; kartu F1.3 menyiapkan instruksi manual bila perlu.

## Next step

Eksekutor berikutnya: buka `docs/plans/MASTER-PLAN-S4-CLASS.md` §1 (kontrak) lalu kerjakan **Kartu F0.1** (hidupkan CI di `master` + job paritas i18n): daftarkan T-0287 di TASK.md, edit `.github/workflows/ci.yml` baris 7–9 (`branches: [main, develop]` → tambah `master`), perbaiki resolusi path `scripts/check-i18n.mjs` memakai `fileURLToPath(import.meta.url)`, tambah step CI `node scripts/check-i18n.mjs`, push, verifikasi `gh run list --limit 1` hijau.

## Test status

- **Unit**: N/A (dokumen saja, tidak ada perubahan kode)
- **Integration**: N/A
- **E2E**: N/A

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/plans/MASTER-PLAN-S4-CLASS.md` | add | dokumen plan utama |
| `docs/checkpoints/T-0286-master-plan-s4-class.checkpoint.md` | add | checkpoint ini |
| `TASK.md` | edit | entri T-0286 + section backlog plan |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (lihat git log) | docs(T-0286): master plan S/4-class upgrade + bug eradication program | 2026-06-10 |

## Handoff Notes

- Plan ini menggantikan kebutuhan menyusun backlog ad-hoc: agen sesi berikutnya TIDAK membuat rencana baru, langsung eksekusi kartu sesuai fase. Urutan mutlak: F0 → F1 → F2 → ... Jangan loncat ke fitur (F4/F5) sebelum sapuan bug (F2/F3) tutup gerbang.
- Ada perubahan luar yang belum di-commit milik sesi lain: `docs/adr/README.md` (modified) dan `docs/adr/0015-native-packaging-silent-printing.md` (untracked). Jangan ikut commit ke task ini.
