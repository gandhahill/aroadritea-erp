# Checkpoint: T-0288 — Tambah fase F7 (native POS + silent print) & F8 (API publik + Scalar)

- **Owner**: Claude Fable 5
- **Started**: 2026-06-10 18:10 WIB
- **Last updated**: 2026-06-10 18:35 WIB
- **Status**: 🟩 DONE
- **Phase**: planning (lanjutan T-0286/T-0287)
- **Branch**: master

## Goal

Permintaan user 2026-06-10: (1) ERP bisa di-install sebagai app native di Android dan Windows agar bisa print silently lewat USB maupun Bluetooth; (2) dokumentasi API "menggunakan Scala" untuk integrasi pihak ketiga. Keduanya dimasukkan ke master plan sebagai fase bergerbang dengan kartu siap eksekusi.

**Kriteria selesai (Definition of Done):**
- [x] `docs/plans/cards/F7-native-print-cards.md` (9 kartu, implementasi ADR-0015)
- [x] `docs/plans/cards/F8-public-api-cards.md` (6 kartu, REST v1 + Scalar)
- [x] Master plan §3: tabel fase dengan kolom Urutan eksplisit (F0→F1→F2→F3→F7→F4→F5→F8→F6)
- [x] Master plan §2.2 (larangan: JVM/Scala runtime, native seluruh ERP/iOS), §12.1 DoD, §13 risiko diperbarui
- [x] TASK.md entri T-0288 + pointer backlog diperbarui
- [x] ADR-0015 draft (sesi sebelumnya, belum ter-commit) diikutkan ke commit berstatus Proposed

## Done so far

- Membaca draft ADR-0015 yang sudah ada di working tree (dibuat sesi lain 2026-06-10, fleet kasir heterogen dikonfirmasi user): Tauri 2 untuk surface POS saja, builder ESC/POS unit-testable di packages, 4 adapter transport, `pos_printer_configs` di DB, fallback print browser, audit event cetak, Chrome `--kiosk-printing` sebagai jembatan. Kartu F7 dibangun mengikuti ADR ini, bukan menggantikannya.
- F7 ditempatkan setelah gerbang F3 (sapuan bug selesai) dan sebelum F4: nyeri operasional kasir harian, tidak bergantung fondasi platform.
- F8 ditempatkan setelah F5 dan sebelum F6: permukaan API publik harus masuk scope pentest penutupan (F6.4). API menumpang `apps/mcp` (tanpa proses runtime baru, RAM 2 GB), auth `api_tokens` existing, spec dari `@hono/zod-openapi`, docs `@scalar/hono-api-reference`, mutasi idempoten + sadar approval-gate.

## Decisions

- **Interpretasi "Scala" = Scalar** (tool dokumentasi API OpenAPI dengan integrasi resmi Hono). Alasan: konteks kalimat user adalah *dokumentasi API*; bahasa Scala berarti runtime JVM baru yang melanggar ADR-0001 dan batas server 2 GB. Asumsi ini ditulis di kartu F8.1 dengan instruksi BLOCKED + konfirmasi Lintang sebelum ADR-0016 di-Accept.
- Urutan fase = urutan baris tabel §3 (kode fase tidak di-renumber supaya referensi T-0286/T-0287 tetap sah).
- Scope native mengikuti ADR-0015: HANYA surface POS, bukan seluruh ERP; iOS tidak dibangun. Ditambahkan ke daftar larangan §2.2.
- ADR-0015 di-commit berstatus Proposed; perubahan status ke Accepted adalah langkah kartu F7.0 (keputusan Lintang).

## Open issues / Questions

- Konfirmasi Lintang dibutuhkan di dua titik (sudah tertulis sebagai BLOCKED di kartu): (1) ADR-0015 Proposed→Accepted sebelum F7.1; (2) interpretasi Scalar di F8.1.
- Keystore Android + (opsional) sertifikat code-signing Windows belum ada — kartu F7.6/F7.8 memuat instruksi.

## Next step

Tidak berubah dari T-0287: eksekutor berikutnya mengerjakan **Kartu F0.1** (master plan §4). F7 baru boleh dimulai setelah gerbang F3 tutup; F8 setelah gerbang F5.

## Test status

- **Unit/Integration/E2E**: N/A (dokumen planning)

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/plans/cards/F7-native-print-cards.md` | add | 9 kartu native + silent print |
| `docs/plans/cards/F8-public-api-cards.md` | add | 6 kartu API publik + Scalar |
| `docs/plans/MASTER-PLAN-S4-CLASS.md` | edit | tabel urutan fase, §2.2, §12.1, §13, catatan Perencana |
| `TASK.md` | edit | entri T-0288 + pointer backlog |
| `docs/adr/0015-native-packaging-silent-printing.md` | add (commit draft sesi lain) | status Proposed |
| `docs/adr/README.md` | edit (commit draft sesi lain) | baris indeks ADR-0015 |
| `docs/checkpoints/T-0288-add-f7-f8-phases.checkpoint.md` | add | checkpoint ini |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (lihat git log) | docs(T-0288): add F7 native+silent-print and F8 public-API+Scalar phases | 2026-06-10 |

## Handoff Notes

- Kartu F7 sengaja tidak memilih crate Rust spesifik untuk transport (winspool vs rusb, dsb.) — eksekutor memilih yang paling sederhana yang berfungsi dan MENCATAT pilihannya di checkpoint; bila pilihan berdampak lintas kartu, eskalasi ke Perencana.
- CI utama tidak boleh pernah butuh Rust; build native = workflow terpisah `native.yml` (kartu F7.8).
