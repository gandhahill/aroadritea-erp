# Checkpoint: T-0287 — Pass Perencana penuh: pecah semua kartu F2–F6

- **Owner**: Claude Fable 5
- **Started**: 2026-06-10 17:25 WIB
- **Last updated**: 2026-06-10 18:05 WIB
- **Status**: 🟩 DONE
- **Phase**: planning (lanjutan T-0286)
- **Branch**: master

## Goal

Atas permintaan user: karena sesi ini dipegang model terkuat, jalankan peran Perencana untuk SEMUA fase sekaligus (bukan menunda pemecahan kartu ke tiap gerbang), dibantu subagen Haiku untuk inventarisasi repo. Hasil: setiap fase F2–F6 punya kartu siap eksekusi yang berpijak pada file nyata, sehingga eksekutor selemah apa pun tinggal menyalin kartu.

**Kriteria selesai (Definition of Done):**
- [x] Inventaris repo oleh 5 subagen Explore (Haiku): permukaan keamanan, titik masuk service 12 skenario, sensus direct-DB apps/web, engine platform, schema+MCP
- [x] Klaim kunci di-spot-check langsung (log-scrub/hmac yatim, runApprovalGate caller, number-generator, nav-access)
- [x] `docs/plans/cards/F2-security-cards.md` (12 kartu)
- [x] `docs/plans/cards/F3-functional-cards.md` (F3.0 harness + F3.1 matriks + 12 skenario + F3.14 loop)
- [x] `docs/plans/cards/F4-platform-cards.md` (F4.1–F4.9, termasuk F4.3a–g dan F4.4a–k)
- [x] `docs/plans/cards/F5-s4-capability-cards.md` (F5.1–F5.10)
- [x] `docs/plans/cards/F6-closure-cards.md` (F6.1a–F6.4)
- [x] Master plan diperbarui: peran Perencana, tautan kartu per fase
- [x] TASK.md: entri T-0287 + pointer backlog diperbarui

## Done so far

Fakta inventaris yang dipakai sebagai dasar kartu (ringkas):
- **Keamanan**: rate limit hanya di login (better-auth window 60s + loginAttempts 5/15m); TIDAK ada di OTP member, /api/sync/pos, MCP, AI chat. `packages/shared/src/security/log-scrub.ts` dan `hmac.ts` tidak diimpor kode produksi (hanya test diri sendiri) — kontradiksi dengan klaim T-0176. 62 file memakai sql` mentah (terbanyak pos/create-sale.ts ×8). PII AES-256-GCM terpasang di hr employee + member. MCP token SHA-256 di apps/mcp/src/auth.ts. apps/mcp tanpa middleware CORS (ada host allowlist).
- **Fungsional**: test services mayoritas vi.mock('@erp/db') → perlu harness DB nyata (kartu F3.0). 12 titik masuk skenario terverifikasi (create-sale, refund-sale, api/sync/pos, pr/po/grn/invoice/return, transfer, opname, payroll, close-period, efaktur/spt-masa/bupot21, loyalty, manual-sales).
- **Platform**: custom field engine lengkap tetapi tidak dirender di form entitas mana pun; runApprovalGate hanya dipanggil post-journal; tidak ada halaman /approvals; numbering atomic via shared/number-generator.ts + tabel sequences (format hardcode); import Excel ada di inventory/import-service.ts; ekspor belum punya helper terpadu; worker handlerMap berisi 8 job.
- **Schema**: journal_lines tanpa dimensi CO (kolom terverifikasi); migrasi terakhir 0042. MCP 68 tool terdaftar di apps/mcp/src/tools/index.ts. Direct-DB apps/web 88 file (HR 18, Settings 14, Accounting 13, Inventory 10, Tax 6, dst.). NAV_ACCESS di apps/web/lib/nav-access.ts = sumber kebenaran route→permission (dipakai kartu F2.2a untuk generator test matriks otorisasi).

## Decisions

- Kartu file per fase di `docs/plans/cards/` (bukan menggelembungkan master plan); aturan preseden: file kartu menang atas ringkasan master plan.
- Keputusan teknis yang dititipkan ke kartu (tetap butuh ADR saat eksekusi): profit center = locationId (F5.1); merge produk di luar lingkup MDG (F5.4); dry-run via transaksi-rollback (F5.10); gapless numbering hanya dokumen fiskal (F4.6).
- Temuan keamanan kandidat TIDAK langsung dipatch di task planning ini (pemisahan temukan/perbaiki sesuai prosedur F2); semuanya tercatat di kartu terkait dengan label "temuan kandidat".

## Open issues / Questions

- Klaim subagen yang belum di-spot-check manual: detail loginAttempts (5/15m, 20/jam) dan beberapa path minor — eksekutor kartu terkait wajib verifikasi ulang sebelum memakai angka itu (sudah ditulis di kartu sebagai "fakta awal" yang harus dikonfirmasi).
- Lisensi gitleaks-action untuk repo org (kartu F0.6 punya fallback binary).

## Next step

Eksekutor berikutnya: kerjakan **Kartu F0.1** di `docs/plans/MASTER-PLAN-S4-CLASS.md` §4 (hidupkan CI di `master` + perbaiki path `scripts/check-i18n.mjs` + job paritas i18n). Mint T-0288 di TASK.md, buat checkpoint, lalu ikuti langkah kartu persis.

## Test status

- **Unit/Integration/E2E**: N/A (dokumen planning; tidak ada perubahan kode)

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/plans/cards/F2-security-cards.md` | add | 12 kartu sapu keamanan |
| `docs/plans/cards/F3-functional-cards.md` | add | harness + matriks + 12 skenario + loop |
| `docs/plans/cards/F4-platform-cards.md` | add | F4.1–F4.9 (a–g, a–k terinci) |
| `docs/plans/cards/F5-s4-capability-cards.md` | add | F5.1–F5.10 |
| `docs/plans/cards/F6-closure-cards.md` | add | F6.1a–F6.4 |
| `docs/plans/MASTER-PLAN-S4-CLASS.md` | edit | peran Perencana + tautan kartu per fase |
| `TASK.md` | edit | entri T-0287 + pointer backlog |
| `docs/checkpoints/T-0287-planner-pass-all-cards.checkpoint.md` | add | checkpoint ini |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| (lihat git log) | docs(T-0287): planner pass — executable cards for all phases F2–F6 | 2026-06-10 |

## Handoff Notes

- Inventaris dilakukan 2026-06-10; bila eksekusi kartu F4/F5 baru dimulai berbulan-bulan kemudian, Perencana gerbang wajib menyegarkan angka sensus (88 file direct-DB, 68 tool MCP, migrasi 0042) sebelum eksekusi.
- Dua file luar yang belum di-commit milik sesi lain tetap tidak disentuh: `docs/adr/README.md` (modified), `docs/adr/0015-native-packaging-silent-printing.md` (untracked).
