# Master plan: ERP kelas S/4HANA + pelunasan bug fungsional & keamanan

- **Dibuat**: 2026-06-10 (T-0286)
- **Pemilik**: Lintang Maulana Zulfan
- **Status**: AKTIF. Semua agen AI yang bekerja di repo ini wajib mengikuti dokumen ini sampai dicabut.
- **Kedudukan**: dokumen ini adalah rencana eksekusi. Bila bertentangan dengan `SOURCE-OF-TRUTH.md` (bisnis) atau `SYSTEM-DESIGN.md` (teknis), dua dokumen itu menang. `TASK.md` tetap satu-satunya register task; plan ini memasok isi backlog-nya.
- **Dasar**: audit kelengkapan fitur `docs/audit/erp-feature-completeness-2026-06-09.md` (T-0283), fondasi approval-gate (T-0284/T-0285), temuan pentest (T-0281), backlog audit 2026-05-29 (T-0211..T-0263, semua selesai).

---

## 1. Cara memakai dokumen ini (WAJIB dibaca setiap sesi)

### 1.1 Dua peran

| Peran | Siapa | Tugas |
|---|---|---|
| **Perencana** | Model terkuat yang tersedia, atau Lintang | Menutup gerbang fase dengan bukti, menyegarkan kartu fase berikutnya bila kondisi repo berubah, memecah kartu L yang belum terpecah. |
| **Eksekutor** | Agen AI mana pun | Mengerjakan **tepat satu kartu** per sesi, persis seperti tertulis. Tidak menambah scope, tidak mengurangi scope, tidak berimprovisasi. |

Agen yang tidak yakin dirinya Perencana adalah Eksekutor.

> **Pass Perencana penuh sudah dilakukan 2026-06-10 (T-0287, ditambah F7/F8 di T-0288)**: SEMUA fase sudah dipecah menjadi kartu siap eksekusi berdasarkan inventaris repo nyata (5 subagen + spot-check). Kartu F0–F1 ada di dokumen ini (§4–§5); kartu fase lain di `docs/plans/cards/`: `F2-security-cards.md`, `F3-functional-cards.md`, `F4-platform-cards.md`, `F5-s4-capability-cards.md`, `F6-closure-cards.md`, `F7-native-print-cards.md`, `F8-public-api-cards.md`. Bila ringkasan di dokumen ini berbeda dari file kartu, **file kartu menang** (lebih rinci, berbasis bukti). Eksekutor TIDAK perlu dan TIDAK boleh memecah kartu sendiri; cukup salin kartu ke checkpoint dan kerjakan. Urutan fase = §3.

### 1.2 Sepuluh aturan mutlak eksekutor

1. **Satu sesi = satu kartu.** Pilih kartu paling atas yang berstatus terbuka pada fase yang sedang berjalan. Jangan loncat fase.
2. **Sebelum menulis kode**: daftarkan T-NNNN baru di `TASK.md` (increment dari ID terakhir, jangan loncat), buat checkpoint dari `docs/checkpoints/TEMPLATE.checkpoint.md`, salin isi kartu ke checkpoint.
3. **Hanya sentuh file yang disebut kartu.** Bila kamu yakin perlu file lain, tulis alasannya di checkpoint bagian `Decisions` dulu, baru edit. File di luar modul yang disebut kartu = dilarang.
4. **Ragu = berhenti.** Tulis pertanyaan di checkpoint bagian `Open issues`, set status 🟥 BLOCKED di TASK.md, commit, push, selesai. Menebak itu pelanggaran; bertanya bukan.
5. **Jangan pernah** melemahkan, menghapus, atau men-skip: test, lint rule, CI step, pre-commit hook, baseline guardrail. Bila test gagal, perbaiki penyebabnya. `--no-verify` dilarang.
6. **Setiap UI string lewat i18n key** dan masuk ke `en.json`, `id.json`, `zh.json` sekaligus. Tanpa kecuali.
7. **Setiap mutasi data punya audit trail** (kolom audit + `audit_log` bila state-changing). Tanpa kecuali.
8. **Verifikasi sebelum mengaku selesai**: jalankan semua perintah di bagian `Bukti selesai` kartu, tempel output ringkasnya ke checkpoint. Klaim tanpa output tempelan dianggap belum selesai.
9. **Commit + push setiap berhenti**, termasuk kerja setengah jadi (`wip(T-NNNN): ...`). Pesan commit conventional commits, bahasa Inggris.
10. **Uang = `Money` (bigint)**, waktu DB = `now()` SQL, role check = lookup permission DB, warna = token `brand.*`. Pelanggaran pola ini ditangkap guardrail Fase 0; jangan coba mengakalinya.

### 1.3 Prosedur saat ragu atau gagal

```
Gagal test / typecheck setelah 3 percobaan perbaikan
  → tulis error lengkap di checkpoint → status BLOCKED → commit wip → push → berhenti.
Kartu menyuruh sesuatu yang bertentangan dengan SOURCE-OF-TRUTH/SYSTEM-DESIGN/CLAUDE.md
  → JANGAN kerjakan → tulis konflik di checkpoint → BLOCKED → berhenti.
Butuh keputusan bisnis (tarif, alur, nama akun COA, kebijakan)
  → JANGAN putuskan sendiri → tulis pertanyaan untuk Lintang → BLOCKED → berhenti.
Butuh secret / akses (CI secret, Cloudflare, VPS)
  → tulis kebutuhan persis di checkpoint → BLOCKED → berhenti.
```

### 1.4 Format kartu task

Perencana menulis kartu dengan format ini. Eksekutor menyalinnya ke checkpoint dan mencentang.

```markdown
### Kartu <kode-plan> — <judul>
- **Fase**: Fn · **Effort**: S/M/L · **Dependensi**: <kode kartu lain / tidak ada>
- **Tujuan**: 1–2 kalimat hasil akhir yang bisa diperiksa.
- **Baca dulu**: file/dokumen spesifik (path + bagian).
- **File yang boleh disentuh**: daftar path eksplisit. Path lain dilarang.
- **Langkah**: daftar bernomor, tiap langkah satu aksi konkret.
- **Larangan khusus kartu ini**: hal yang eksekutor lemah cenderung langgar di task ini.
- **Bukti selesai**: perintah persis + output yang diharapkan. Minimal selalu:
  `pnpm verify` (setelah Fase 0 ada; sebelumnya: `pnpm -w typecheck && pnpm -w test && pnpm -w lint`).
- **DoD**: checklist i18n, audit trail, test baru, permission seed, MCP parity, update SD/SoT bila perlu.
```

### 1.5 Perintah verifikasi standar

Sampai kartu F0.5 selesai, "verifikasi penuh" berarti menjalankan semuanya dari root repo:

```bash
pnpm -w typecheck        # termasuk lint:permissions
pnpm -w test
pnpm -w lint             # Biome; warning baseline boleh, error tidak
cd scripts; node check-i18n.mjs; cd ..   # paritas i18n (path script masih relatif, lihat F0.1)
pnpm --filter @erp/web build             # hanya bila kartu menyentuh apps/web
```

Setelah F0.5, satu perintah saja: `pnpm verify`.

---

## 2. Sasaran: arti "kelas S/4HANA" untuk repo ini

SAP S/4HANA adalah produk puluhan tahun dengan ribuan modul. Menjiplaknya mentah-mentah di VPS 1 vCPU / 2 GB untuk satu PT dengan beberapa outlet itu mustahil sekaligus tidak berguna. Yang kita kejar adalah **kapabilitas kelasnya**, bukan luas permukaannya: konsep inti yang membuat S/4HANA lengkap dan lentur, diterapkan pada skala FnB Indonesia. Arah produk tetap yang ditetapkan T-0283: platform selentur Odoo dengan paket domain FnB, kini ditarget naik ke standar kontrol dan fleksibilitas S/4.

### 2.1 Sepuluh pilar kapabilitas

| # | Konsep S/4HANA | Wujud di ERP ini | Status 2026-06-10 | Fase |
|---|---|---|---|---|
| 1 | Universal Journal (ACDOCA): satu sumber kebenaran finansial berdimensi | `journal_lines` + dimensi location, ditambah cost center & profit center, semua laporan turun dari ledger yang sama | Ledger tunggal ada; dimensi CO belum | F5 |
| 2 | Prinsip dokumen (Beleg): dokumen posted immutable, koreksi lewat reversal | Sudah berlaku di jurnal; perlu ditegakkan di semua dokumen transaksional | Sebagian | F3, F4 |
| 3 | Controlling (CO): cost center, profit center, budget, commitment check | Tabel cost center, budget per periode, cek anggaran saat approve PO | Belum ada | F5 |
| 4 | Material Ledger: valuasi rata-rata per lokasi, jejak biaya bisa diaudit | Weighted average ada; jejak movement→valuasi→JE perlu UI audit | Sebagian | F5 |
| 5 | Key-user extensibility: field, workflow, numbering tanpa ubah kode | Custom field engine + workflow engine ada tetapi belum universal; numbering engine belum | Sebagian | F4 |
| 6 | SAP Business Workflow: semua transisi sensitif lewat approval terkonfigurasi | `runApprovalGate()` ada (T-0284), baru dipakai jurnal manual (T-0285) | Mulai | F4 |
| 7 | Fiori: workspace per peran, inbox approval terpusat, exception center | Belum ada; sidebar generik | Belum | F5 |
| 8 | GRC: segregation of duties, period lock, audit lengkap, akses minimum | Permission DB-driven ada; SoD matrix dan enforcement belum sistematis | Sebagian | F2, F4 |
| 9 | Master Data Governance: deteksi duplikat, merge, riwayat perubahan master | Belum ada | Belum | F5 |
| 10 | BAPI/OData parity: semua aksi UI tersedia sebagai API/MCP dengan permission sama | MCP luas tetapi belum paritas penuh | Sebagian | F6 |

### 2.2 Di luar lingkup (DILARANG dibangun, siapa pun yang menyuruh)

Eksekutor yang menemukan task menjurus ke daftar ini wajib BLOCKED dan bertanya:

- Multi-GAAP / ledger paralel, konsolidasi multi-entitas, intercompany. Entitas hukum cuma satu (SAK EP).
- Mesin MRP penuh, production scheduling pabrik. Dapur bukan pabrik; cukup BOM + reorder rules yang sudah ada.
- In-memory column store, OLAP terpisah, data warehouse. RAM 2 GB.
- Platform scripting tertanam (ala ABAP) yang mengeksekusi kode user. Fleksibilitas lewat konfigurasi DB, bukan kode dinamis.
- Library bundel besar (>5 MB) atau service runtime baru (Redis, Elasticsearch, dsb.) tanpa ADR + persetujuan Lintang.
- Mengganti stack (ADR-0001 final: Next.js 15 + Drizzle + Postgres + Hono).
- Bahasa/runtime server baru (JVM/Scala, Python, dsb.) — termasuk untuk dokumentasi API: dokumentasi memakai **Scalar** (OpenAPI di Hono), lihat F8 dan catatan interpretasi di `cards/F8-public-api-cards.md`.
- App native untuk seluruh ERP atau untuk iOS. Native = shell Tauri 2 untuk **surface POS saja**, Android + Windows (ADR-0015). Toolchain Rust diizinkan KHUSUS `apps/pos-shell` (sisi klien) dan tidak boleh menjadi prasyarat CI utama maupun runtime server.

---

## 3. Struktur fase dan gerbang

Fase berjalan berurutan. **Gerbang** = checklist keluar yang harus dibuktikan Perencana sebelum fase berikutnya dibuka. Logika urutannya: pagar mesin dulu (karena eksekutor tidak bisa diandalkan menaati prosa), lalu lunasi hutang berjalan, lalu basmi bug (keamanan dulu, baru fungsional), lalu fitur operasional yang paling menyakitkan kasir (cetak silent), baru fondasi platform dan kapabilitas besar, dan API publik menjelang penutupan supaya ikut ter-pentest.

> **Urutan eksekusi = urutan BARIS tabel ini**, bukan urutan kode fase. Kode fase tidak diurutkan ulang supaya referensi lama (checkpoint, TASK.md) tetap sah. F7 dan F8 ditambahkan 2026-06-10 atas permintaan user (T-0288).

| Urutan | Fase | Nama | Isi | Kartu | Gerbang keluar |
|---|---|---|---|---|---|
| 1 | F0 | Pagar mesin | CI hidup di `master`, guardrail otomatis, `pnpm verify` (kartu: §4 dokumen ini) | 6 | CI hijau di push `master`; semua script guardrail jalan di CI; `pnpm verify` lulus |
| 2 | F1 | Tutup hutang aktif | Selesaikan T-0279, T-0264, T-0281 (kartu: §5 dokumen ini) | 3 | Tidak ada task 🟨 IN_PROGRESS di TASK.md selain pekerjaan plan ini |
| 3 | F2 | Sapu keamanan | 11 permukaan serang, loop temukan→perbaiki→verifikasi (kartu: `cards/F2-security-cards.md`) | 12 | Nol temuan Critical/High terbuka; `pnpm audit` & Dependabot bersih; sapuan ulang penuh tanpa temuan Critical/High baru |
| 4 | F3 | Sapu fungsional | Harness DB nyata + matriks lifecycle + 12 skenario E2E + loop perbaikan (kartu: `cards/F3-functional-cards.md`) | 15+ | Semua skenario E2E hijau di CI; matriks tanpa sel P0/P1 kosong; sapuan ulang tanpa P0/P1 baru |
| 5 | F7 | App native POS + silent printing | Implementasi ADR-0015: shell Tauri 2 Android+Windows, builder ESC/POS, adapter USB/Bluetooth, config printer di DB, fallback browser (kartu: `cards/F7-native-print-cards.md`) | 9 | Silent print terverifikasi di fleet nyata (min. Android+BT, Windows+USB); fallback tanpa regresi; CI utama tetap tanpa Rust |
| 6 | F4 | Fondasi platform | Extensibility universal, approval-gate universal, layering, numbering, import, timeline (kartu: `cards/F4-platform-cards.md`) | ±22 | Checklist "ERP lentur" §12.2 poin 1–5 terbukti dengan demo terdokumentasi |
| 7 | F5 | Kapabilitas kelas-S/4 | CO/budget, MDG, workspace peran, drilldown, config versioning, simulasi (kartu: `cards/F5-s4-capability-cards.md`) | ±12 | Checklist §12.2 poin 6–10 terbukti |
| 8 | F8 | API publik + dokumentasi Scalar | REST `/api/v1` di `apps/mcp` (Hono + zod-openapi), auth `api_tokens` + permission engine, idempoten, rate limit, Scalar docs `/docs`, onboarding pihak ketiga (kartu: `cards/F8-public-api-cards.md`) | 6 | Onboarding pihak ketiga sukses hanya bermodal docs; sapuan keamanan API bersih; spec valid |
| 9 | F6 | Paritas MCP + penutupan | MCP parity ledger, dokumen, ADR, regresi akhir, pentest ulang — scope pentest mencakup API publik (F8) dan shell native (F7) (kartu: `cards/F6-closure-cards.md`) | 5 | DoD program §12.1 terpenuhi seluruhnya |

Estimasi total ±84 kartu. Effort: S ≤ 1 sesi, M = 1–2 sesi, L = 3–5 sesi. Kartu L wajib dipecah Perencana sebelum dieksekusi.

---

## 4. Fase 0 — pagar mesin (kartu lengkap, siap eksekusi)

Prinsip fase ini: aturan yang hanya hidup di prosa akan dilanggar; aturan yang hidup di CI tidak bisa dilanggar. Maka sebelum apa pun, pindahkan larangan CLAUDE.md §5.7 dari teks ke mesin.

### Kartu F0.1 — Hidupkan CI di `master` + job paritas i18n
- **Fase**: F0 · **Effort**: S · **Dependensi**: tidak ada
- **Tujuan**: CI berjalan di setiap push/PR ke `master` (saat ini `ci.yml` hanya memantau `main`/`develop`, jadi CI mati total), dan paritas i18n jadi job CI.
- **Baca dulu**: `.github/workflows/ci.yml`, `scripts/check-i18n.mjs`.
- **File yang boleh disentuh**: `.github/workflows/ci.yml`, `scripts/check-i18n.mjs`.
- **Langkah**:
  1. Ubah `on.push.branches` dan `on.pull_request.branches` menjadi `[master]` (pertahankan `main`, `develop` bila mau, tambahkan `master`).
  2. Perbaiki `scripts/check-i18n.mjs` agar bebas cwd: ganti `path.resolve('../apps/web')` dengan resolusi dari `import.meta.url` (`fileURLToPath` → naik satu folder → `apps/web`). Pastikan exit code 1 bila ada key hilang.
  3. Tambah step CI di job `check` setelah `Test`: `node scripts/check-i18n.mjs`.
  4. Push, lalu pantau `gh run list --limit 1` dan `gh run watch`.
- **Larangan khusus**: jangan hapus job `build` Docker; jangan ubah step Test; bila secret `DATABASE_URL_TEST` ternyata kosong sehingga job Test gagal, itu BLOCKED (minta Lintang mengisi secret), bukan alasan menonaktifkan step.
- **Bukti selesai**: tempel output `gh run list` yang menunjukkan run terbaru di `master` status `completed success`; output `node scripts/check-i18n.mjs` lokal exit 0.
- **DoD**: tidak ada string UI baru, tidak ada mutasi data; checkpoint + TASK.md terisi.

### Kartu F0.2 — Script pola terlarang (ratchet)
- **Fase**: F0 · **Effort**: M · **Dependensi**: F0.1
- **Tujuan**: script `scripts/check-forbidden-patterns.ts` menangkap pelanggaran CLAUDE.md §5.7 yang bisa di-grep, dengan baseline supaya pelanggaran lama tidak memblokir tetapi pelanggaran **baru** menggagalkan CI.
- **Baca dulu**: CLAUDE.md §5.7, `scripts/check-permissions.ts` (contoh gaya script), ADR-0006.
- **File yang boleh disentuh**: `scripts/check-forbidden-patterns.ts` (baru), `scripts/forbidden-patterns-baseline.json` (baru), `package.json` (tambah script `lint:forbidden`), `.github/workflows/ci.yml` (tambah step).
- **Langkah**:
  1. Tulis script yang memindai `apps/**` dan `packages/**` (kecuali test, node_modules, .next) untuk pola: `user.role ===` / `role === '` (hardcoded role check); `bg-white|text-zinc-|border-slate-` di `apps/*`; `console.log` di path produksi; `: number` pada identifier berakhiran `Amount|Price|Total|Cost` (heuristik uang-number); `Date.now()` di `packages/services`.
  2. Mode `--update-baseline` menulis daftar pelanggaran lama ke baseline JSON (path + pola, tanpa nomor baris supaya tidak rapuh).
  3. Tanpa flag: temuan yang tidak ada di baseline → exit 1 dengan pesan jelas file+pola.
  4. Generate baseline awal, commit. Tambah `"lint:forbidden": "tsx scripts/check-forbidden-patterns.ts"` ke package.json dan step CI.
- **Larangan khusus**: dilarang memasukkan pelanggaran BARU ke baseline; baseline hanya berisi temuan yang sudah ada saat kartu ini dikerjakan. Dilarang melonggarkan regex supaya lulus.
- **Bukti selesai**: `pnpm lint:forbidden` exit 0; uji negatif: tambahkan sementara `user.role === 'admin'` di satu file, script exit 1, lalu hapus lagi (tunjukkan kedua output); CI hijau.
- **DoD**: baseline ter-commit; jumlah entri baseline dicatat di checkpoint (jadi target penyusutan F4).

### Kartu F0.3 — Script larangan import `@erp/db` langsung di `apps/web` (ratchet)
- **Fase**: F0 · **Effort**: S · **Dependensi**: F0.2
- **Tujuan**: temuan #3 audit T-0283 (UI banyak query DB langsung) berhenti memburuk: import `@erp/db` baru di `apps/web` menggagalkan CI; daftar lama masuk baseline yang hanya boleh menyusut.
- **Baca dulu**: `docs/audit/erp-feature-completeness-2026-06-09.md` §Gap-3.
- **File yang boleh disentuh**: `scripts/check-db-imports.ts` (baru), `scripts/db-imports-baseline.json` (baru), `package.json`, `.github/workflows/ci.yml`.
- **Langkah**: pola sama dengan F0.2: pindai `apps/web/**/*.{ts,tsx}` untuk `from '@erp/db'` / `from "@erp/db"`; baseline; mode update; step CI; script `lint:layering`.
- **Larangan khusus**: sama dengan F0.2. Refactor halaman lama BUKAN bagian kartu ini (itu F4.3).
- **Bukti selesai**: `pnpm lint:layering` exit 0; uji negatif seperti F0.2; jumlah file baseline tercatat di checkpoint.

### Kartu F0.4 — Audit & perkuat pre-commit hook
- **Fase**: F0 · **Effort**: S · **Dependensi**: F0.2, F0.3
- **Tujuan**: pre-commit menjalankan Biome + `lint:forbidden` + `lint:layering` pada file ter-stage, sehingga pelanggaran tertangkap sebelum commit, bukan hanya di CI.
- **Baca dulu**: periksa dulu mekanisme hook yang ada: `ls .husky` ; `git config core.hooksPath` ; `.git/hooks/`. Catat temuan di checkpoint sebelum mengubah apa pun.
- **File yang boleh disentuh**: konfigurasi hook yang ditemukan (atau `.husky/pre-commit` baru), `package.json`.
- **Langkah**: 1) inventaris hook sekarang; 2) tambahkan langkah cek tanpa menghapus langkah lama; 3) uji dengan commit dummy berisi pelanggaran, pastikan tertolak, batalkan commit dummy.
- **Larangan khusus**: jangan membuat hook yang lebih lambat dari ±30 detik (developer solo akan tergoda `--no-verify`); cek hanya file ter-stage.
- **Bukti selesai**: transkrip commit dummy yang tertolak + commit normal yang lolos.

### Kartu F0.5 — Perintah payung `pnpm verify`
- **Fase**: F0 · **Effort**: S · **Dependensi**: F0.1–F0.4
- **Tujuan**: satu perintah yang menjalankan seluruh gate lokal, supaya kartu-kartu selanjutnya cukup menulis "jalankan `pnpm verify`" dan eksekutor lemah tidak bisa salah pilih perintah.
- **File yang boleh disentuh**: `package.json`, `scripts/check-i18n.mjs` (bila perlu wrapper).
- **Langkah**: tambah `"verify": "pnpm typecheck && pnpm test && pnpm lint && pnpm lint:forbidden && pnpm lint:layering && node scripts/check-i18n.mjs"`. Pastikan urutan dari yang tercepat gagal.
- **Bukti selesai**: `pnpm verify` exit 0; tempel ringkasan output.

### Kartu F0.6 — Gitleaks di CI + proteksi branch `master`
- **Fase**: F0 · **Effort**: S · **Dependensi**: F0.1
- **Tujuan**: scan rahasia otomatis di CI; `master` menolak push yang CI-nya merah.
- **File yang boleh disentuh**: `.github/workflows/ci.yml`; sisanya aksi `gh api`.
- **Langkah**: 1) tambah job `gitleaks/gitleaks-action@v2` (gratis untuk repo non-org atau pakai mode lisensi yang sesuai; bila butuh lisensi berbayar → BLOCKED, tanya Lintang, fallback: `gitleaks detect` via binary download di step run); 2) aktifkan branch protection via `gh api repos/{owner}/{repo}/branches/master/protection` dengan required status check job `check`; bila token tidak punya izin admin → BLOCKED, tulis instruksi klik-demi-klik untuk Lintang di checkpoint.
- **Bukti selesai**: run CI dengan job gitleaks hijau; output `gh api .../protection` menunjukkan required check aktif (atau instruksi manual terdokumentasi + konfirmasi Lintang).

---

## 5. Fase 1 — tutup hutang aktif (kartu lengkap)

Tiga task 🟨 di TASK.md harus tutup sebelum sapuan dimulai, supaya tidak ada dua sumber kebenaran tentang "apa yang sedang setengah jadi".

### Kartu F1.1 — Selesaikan T-0279 (pagination service-level)
- **Effort**: M · **Dependensi**: F0.5
- **Tujuan**: pagination server-side untuk reimbursement, petty cash, bank recon, general ledger; client-side untuk COGS/waste/aging, sesuai scope asli T-0279.
- **Baca dulu**: `docs/checkpoints/T-0279-service-level-pagination.checkpoint.md` SELURUHNYA; kerjakan persis dari bagian `Next step`-nya. Bila `Next step` kosong/kabur: BLOCKED, tanya Lintang.
- **Larangan khusus**: jangan mengubah scope; jangan menulis ulang yang sudah jadi. Owner lama idle > 1 jam, boleh diambil alih (update Owner).
- **Bukti selesai**: `pnpm verify`; bukti manual satu halaman per daftar (screenshot/snapshot) menunjukkan kontrol halaman bekerja.

### Kartu F1.2 — Selesaikan T-0264 (sisa: Coretax XML #9 + cleanup mcp-token-service lama)
- **Effort**: M · **Dependensi**: F0.5
- **Baca dulu**: `docs/checkpoints/remediation-2026-05-30.checkpoint.md`; sisa kerja tertulis: ekspor Coretax XML (#9) dan menghapus service token MCP lama.
- **Larangan khusus**: format Coretax mengikuti SOURCE-OF-TRUTH/SD bagian pajak; bila spesifikasi XML versi terbaru tidak ada di repo, BLOCKED dan minta Lintang memberi contoh file resmi. Jangan mengarang skema XML.
- **Bukti selesai**: `pnpm verify`; file XML contoh hasil ekspor tervalidasi terhadap skema/contoh resmi; grep membuktikan service lama tidak direferensikan lagi.

### Kartu F1.3 — Tutup T-0281 (pentest 2026-06-07) 
- **Effort**: S · **Dependensi**: tidak ada
- **Tujuan**: sisa item Cloudflare-side (SPF/DMARC DNS, TLS publik `mcp.erp.aroadritea.com`) diverifikasi atau diserahkan eksplisit ke Lintang sebagai aksi manual, lalu task ditutup.
- **Baca dulu**: `docs/checkpoints/T-0281-pentest-2026-06-07-remediation.checkpoint.md`.
- **Langkah**: verifikasi dari luar (`nslookup -type=TXT`, `curl -sI https://mcp.erp.aroadritea.com`), catat hasil; item yang butuh dashboard Cloudflare → tulis instruksi langkah-demi-langkah untuk Lintang; status DONE bila semua item punya bukti atau pemilik manual yang jelas.
- **Bukti selesai**: tempel output perintah verifikasi; TASK.md T-0281 DONE dengan catatan item manual.

---

## 6. Fase 2 — program sapu keamanan

> **Kartu siap eksekusi**: `docs/plans/cards/F2-security-cards.md` (dipecah T-0287, berbasis inventaris file nyata + temuan kandidat). Bagian ini tinggal prosedur dan ringkasan.

### 6.1 Prosedur baku tiap sapuan (berlaku untuk semua kartu F2.x)

1. Eksekutor membuka kartu, membaca referensi: `docs/audit/01-attack-surface.md`, `docs/audit/02-static-findings.md`, `docs/audit/security-runtime-inventory.md`, dan checkpoint pentest terakhir.
2. Periksa **hanya** permukaan yang disebut kartu, dengan checklist di kartu. Dilarang memperbaiki sambil memeriksa (pisahkan fase temukan dan fase perbaiki supaya temuan tidak hilang).
3. Tulis semua temuan ke `docs/audit/sweep-security-<area>-YYYY-MM-DD.md`: deskripsi, bukti (file:baris / request-response), klasifikasi Critical/High/Medium/Low, usulan perbaikan.
4. Perbaiki Critical dan High **di kartu yang sama** (atau pecah ke kartu lanjutan bila > 1 sesi; Perencana memutuskan). Medium/Low masuk backlog TASK.md dengan prioritas P1/P2.
5. Setiap perbaikan wajib disertai test regresi yang gagal sebelum patch dan lulus sesudahnya.
6. `pnpm verify` + bukti per temuan di checkpoint.

Klasifikasi: Critical = bisa baca/ubah data tanpa hak dari luar; High = sama tetapi butuh akun; Medium = memperlemah pertahanan; Low = kebersihan.

### 6.2 Daftar kartu sapuan

| Kode | Permukaan | Checklist inti | Effort |
|---|---|---|---|
| F2.1 | Autentikasi & sesi | better-auth config, cookie `Secure/HttpOnly/SameSite`, lockout `loginAttempts`, kebijakan password, reset flow, OTP member (rate, expiry, reuse), sesi multi-device revoke | M |
| F2.2 | Otorisasi & IDOR | Buat test matriks otomatis: tiap route `(dash)` × tiap role → assert 403/200 sesuai seed permission; cek kebocoran lintas `location_id`; cek server actions tanpa `can()` | L (pecah) |
| F2.3 | Injeksi | Audit semua `sql\`` mentah di `packages/db` + services (ingat memori: JS Date di raw sql tag); XSS pada render konten CMS/komentar; CSV/XLSX formula injection di semua ekspor | M |
| F2.4 | Upload & storage | Validasi MIME vs ekstensi, path traversal pada nama file, batas ukuran, direktori `UPLOAD_STORAGE_DIR` di luar webroot, akses file tanpa permission check | M |
| F2.5 | SSRF & integrasi keluar | BinderByte, Exa, DeepSeek, SMTP, ISR webhook: validasi URL, timeout, tidak meneruskan secret, respons error tidak bocor | S |
| F2.6 | Rahasia & konfigurasi | `.env.example` lengkap tanpa nilai asli, grep riwayat git untuk secret (gitleaks F0.6), token MCP di-hash (SHA-256 sudah ada, verifikasi), tidak ada secret di log | S |
| F2.7 | Header, CSP, CORS | CSP per app (web/site/mcp), frame-ancestors (ingat kasus SOP PDF T-0276), CORS MCP, HSTS, `X-Content-Type-Options` | S |
| F2.8 | Rate limiting | Login staf, OTP member, endpoint sync POS, MCP, AI assistant; uji dengan burst nyata | M |
| F2.9 | PII & kripto (UU PDP) | Verifikasi kolom KTP/NPWP/telepon/rekening terenkripsi at rest; log scrubbing (`@erp/shared/log-scrub`) terpasang di semua transport; ekspor/backup tidak bocor PII polos | M |
| F2.10 | Dependensi | `pnpm audit` bersih atau override terdokumentasi; Dependabot 0 open; pin overrides di package.json masih relevan | S |
| F2.11 | MCP & API token | Scope token ditegakkan per tool (bukan super-user), audit parity UI vs MCP, replay protection HMAC Naixer, brute-force token | M |

### 6.3 Gerbang keluar F2

- Nol Critical/High terbuka di seluruh file `sweep-security-*`.
- `pnpm audit --prod` tanpa temuan high/critical; Dependabot 0 open alert (cek via `gh api`).
- Perencana menjalankan **sapuan ulang penuh** (semua 11 area, boleh 1 sesi cepat per area) tanpa temuan Critical/High baru. Bila ada temuan baru: perbaiki, ulangi gerbang.
- Ringkasan ditulis ke `docs/audit/SECURITY-SWEEP-REPORT-2026-Qx.md`.

---

## 7. Fase 3 — program sapu fungsional

> **Kartu siap eksekusi**: `docs/plans/cards/F3-functional-cards.md` (termasuk kartu tambahan F3.0: harness test integrasi DB nyata, karena test yang ada mayoritas mock DB). Bagian ini tinggal ringkasan.

### 7.1 Kartu F3.1 — Matriks lifecycle entitas

Buat `docs/audit/lifecycle-matrix.md`: baris = entitas transaksional (journal, invoice, PO, GRN, purchase return, stock adjustment, transfer, opname, sales order, refund, manual sales closing, payroll run, leave, overtime, kasbon, complaint, shipment, helpdesk ticket); kolom = draft, submit, approve, post, cancel/reverse, attachment, audit, print/export, riwayat status, pencarian, paginasi, i18n 3 bahasa, permission, MCP. Isi tiap sel: ✅ / ❌ / ⚠️ dengan bukti file:baris. Sel ❌ pada kolom kritis (approve, post, cancel, audit, permission) = bug P0/P1, daftarkan sebagai kartu perbaikan.

### 7.2 Kartu F3.2–F3.13 — 12 skenario E2E (test integrasi, DB nyata, tanpa mock)

Tiap skenario = satu kartu = satu file test integrasi di `packages/services` (pakai pola test DB yang sudah ada; CI memakai `DATABASE_URL_TEST`). Skenario dinyatakan lulus bila assert angka akuntansi persis (debit=kredit, saldo akun, level stok) bukan sekadar "tidak error".

| Kode | Skenario | Assert inti |
|---|---|---|
| F3.2 | Penjualan POS tunai end-to-end | JE penjualan + PB1 inklusif benar; HPP terposting; stok bahan terdeplesi sesuai BOM (konversi UoM benar, lihat fix `16689a7`/`6193dd3`) |
| F3.3 | Refund & void | Guard status; JE balik; stok balik; tidak bisa void `paid` |
| F3.4 | Offline sync idempoten | Replay outbox 2× → 1 transaksi; konflik ditolak dengan jelas |
| F3.5 | Procure-to-pay penuh | PR→PO→approval threshold→GRN→invoice 3-way match→pembayaran parsial; JE tiap langkah; GRNI nol setelah lunas |
| F3.6 | Retur pembelian | Stok keluar, JE balik (DR GRNI / CR Inventory), pajak retur benar |
| F3.7 | Transfer antar lokasi 2 langkah | In-transit benar; valuasi rata-rata ikut pindah |
| F3.8 | Stock opname | Generate→hitung→variance→approve→JE penyesuaian; selisih = fisik − sistem |
| F3.9 | Payroll | Attendance→run (PPh21 TER PMK 168/2023, BPJS, lembur /173)→approve→paid→JE; periode akuntansi tertutup menolak |
| F3.10 | Tutup buku bulanan | closePeriod menolak posting baru; trial balance seimbang; laporan konsisten antar halaman |
| F3.11 | Pajak | Rekap PB1 bulanan = penjualan POS per outlet; ekspor Coretax valid |
| F3.12 | Loyalty | Earn saat sale → redeem voucher → saldo & lifetime points konsisten; redeem tidak menurunkan lifetime |
| F3.13 | Manual sales closing harian | Multi-payment; consumed ingredients → deplesi + JE; idempoten |

### 7.3 Kartu F3.14+ — loop perbaikan

Temuan dari matriks + skenario yang merah menjadi kartu perbaikan (Perencana memecah, prioritas P0 → P1 → P2). Aturan tiap perbaikan: tulis test yang mereproduksi bug DULU, lihat merah, baru patch, lihat hijau. Patch tanpa test reproduksi = ditolak di gerbang.

### 7.4 Gerbang keluar F3

- 12 skenario hijau di CI dan masuk `pnpm verify` (lewat `pnpm test`).
- Matriks lifecycle tanpa ❌ di kolom kritis untuk semua entitas.
- Sapuan ulang (jalankan ulang matriks secara sampling + 12 skenario) tanpa P0/P1 baru.

---

## 8. Fase 4 — fondasi platform (extensibility universal)

Menjalankan backlog P0/P1 audit T-0283. **Kartu siap eksekusi: `docs/plans/cards/F4-platform-cards.md`** (sudah dipecah T-0287, termasuk pembagian F4.3a–g per modul dan F4.4a–k per transisi). Tabel di bawah tinggal ringkasan.

| Kode | Task | Scope & acceptance | Effort |
|---|---|---|---|
| F4.1 | Entity-extension registry | Registry entitas extensible (product, partner, employee, member, supplier, PO, GRN, journal, invoice, adjustment, sales order, payroll run, complaint); tiap entri mendeklarasikan placement custom field, searchable, exportable, MCP exposure. Acceptance: menambah field baru pada produk via UI Settings muncul otomatis di form create/edit, detail, ekspor, filter, MCP, tanpa edit kode. | L |
| F4.2 | Renderer custom field reusable | Komponen form + validator dipakai minimal di 5 master data inti. Acceptance: satu komponen, lima form, nol duplikasi logika. | M |
| F4.3 | Layering: hapus direct-DB `apps/web` | Pindahkan query halaman ke services per modul, urutan: accounting, POS, inventory, purchasing, HR/payroll, tax, sisanya. Baseline F0.3 menyusut bertahap sampai 0; tiap kartu = satu modul. | L×7 |
| F4.4 | Approval-gate universal | Daftar transisi sensitif yang wajib lewat `runApprovalGate()`: close period, refund di atas ambang, void, approve adjustment/opname variance besar, approve PO (matriks nilai), purchase return, payroll approve, perubahan harga jual, diskon di atas ambang, perubahan supplier, perubahan role user. Satu kartu per transisi, pola tiru T-0285. | S×11 |
| F4.5 | Inbox approval terpusat | Halaman `/approvals`: semua workflow instance pending milik user, approve/reject/comment, riwayat; notifikasi. | M |
| F4.6 | Numbering engine | Tabel `document_sequences` (per doc type, per lokasi, per tahun fiskal, reset rule, format template); dipakai invoice/PO/GRN/retur/opname; gapless untuk dokumen fiskal. ADR baru wajib. | M |
| F4.7 | Import wizard generik | Mapping kolom, dry-run validasi, deteksi duplikat, ekspor baris error, audit; dipakai minimal: produk, partner, stok awal, fixed asset (kebutuhan §10 CLAUDE.md). ADR baru wajib. | L |
| F4.8 | Timeline dokumen universal | Komponen riwayat status + komentar + lampiran + referensi audit; dipasang di detail semua entitas transaksional. | M |
| F4.9 | Saved views + laporan terjadwal | Simpan filter per user; kirim laporan via email/cron lewat worker. | M |

Gerbang F4 = demo terdokumentasi (langkah + tangkapan layar di `docs/audit/`) untuk: tambah field tanpa kode; tambah aturan approval tanpa kode; ganti format nomor dokumen tanpa kode; impor master tanpa parser baru; baseline layering = 0.

---

## 9. Fase 5 — kapabilitas kelas-S/4

> **Kartu siap eksekusi**: `docs/plans/cards/F5-s4-capability-cards.md` (dipecah T-0287; memuat fakta skema `journal_lines` saat ini dan keputusan profit center = location).

| Kode | Task | Scope & acceptance | Effort |
|---|---|---|---|
| F5.1 | Dimensi CO di ledger | Tabel `cost_centers`; kolom `cost_center_id` (nullable) + `profit_center` (= location, eksplisit) di `journal_lines`; backfill; semua posting baru mengisi dimensi; laporan P&L per cost/profit center. ADR wajib (sentuh >1 modul + skema). | L |
| F5.2 | Budget + commitment check | Tabel `budgets` + `budget_lines` (akun × cost center × periode); approve PO mengecek sisa anggaran (committed = PO approved belum di-GRN); pelanggaran → butuh approval level lebih tinggi via F4.4. | L |
| F5.3 | Jurnal berulang + template akrual | Definisi recurring (interval, template lines), digenerate worker, masuk approval gate. | M |
| F5.4 | MDG ringan | Deteksi duplikat (nama/telepon/NPWP fuzzy) saat create partner/product/member; workflow merge dengan audit; riwayat perubahan master. | M |
| F5.5 | Workspace per peran | Launchpad per role (kasir, manajer toko, akuntan, HR, purchasing, direktur): tile angka hidup + antrian kerja + shortcut. Konfigurasi tile di DB, bukan hardcode role. | L |
| F5.6 | Exception center | Satu halaman: sync gagal, bank line tak cocok, stok negatif, BOM hilang, approval menumpuk, payroll blocker, tax export blocker. Tiap item punya link aksi. | M |
| F5.7 | Drilldown laporan | Setiap angka di laporan finansial bisa diklik sampai dokumen sumber (laporan → GL → JE → dokumen asal). | M |
| F5.8 | Config versioning + rollback | Versi untuk workflow definitions, tax rules, settings; diff antar versi; rollback dengan audit. | M |
| F5.9 | Jejak costing | UI trace: movement → perubahan rata-rata → JE HPP; laporan margin per produk memakai biaya riil. | M |
| F5.10 | Simulasi / dry-run | Mode simulasi untuk payroll run, tutup buku, ekspor pajak: tampilkan hasil tanpa menulis; pakai transaksi DB rollback. | M |

Gerbang F5 = checklist §12.2 poin 6–10 terbukti; tidak ada regresi (`pnpm verify` + 12 skenario E2E hijau).

---

## 10. Fase 6 — paritas MCP + penutupan

> **Kartu siap eksekusi**: `docs/plans/cards/F6-closure-cards.md` (dipecah T-0287; baseline 68 tool MCP per modul sudah diinventarisasi).

| Kode | Task | Scope | Effort |
|---|---|---|---|
| F6.1 | MCP parity ledger | Tabel UI-action × MCP-tool di `docs/audit/mcp-parity-ledger.md`; implement tool yang hilang (custom fields, workflow approve/reject, opname, retur, shipment, leave/overtime/kasbon, member adjust, ekspor laporan); semua lewat service + permission + audit yang sama dengan UI | L |
| F6.2 | Dokumentasi | Update SYSTEM-DESIGN.md (arsitektur baru: numbering, CO, budget, MDG, workspace) + SOURCE-OF-TRUTH.md (proses bisnis baru) + ADR untuk tiap keputusan besar fase 4–5 yang belum ter-ADR-kan | M |
| F6.3 | Regresi akhir | `pnpm verify` penuh; 12 skenario; smoke test produksi sesuai runbook; backup/restore drill | M |
| F6.4 | Pentest eksternal ulang + sign-off | Jadwalkan pentest seperti 2026-05-26/2026-06-07; semua temuan masuk loop F2; sign-off DoD §12.1 oleh Lintang | M |

---

## 11. Penjadwalan dan administrasi

- **Penomoran**: kartu di plan ini memakai kode `Fn.m`. Saat eksekutor mengangkat kartu, ia mencetak `T-NNNN` baru di TASK.md (increment global, tanpa loncat) dan menulis `(plan F n.m)` di kolom Note. Plan ini TIDAK memesan nomor T di muka supaya tidak bentrok dengan task darurat (hotfix produksi tetap boleh menyela; setelah hotfix, kembali ke fase berjalan).
- **Checkpoint**: satu kartu = satu checkpoint, format template. Bagian `Next step` wajib konkret sebelum sesi berakhir.
- **Commit**: conventional commits + push langsung. Kerja setengah = `wip(T-NNNN):`.
- **Deploy**: hanya pada penutupan gerbang fase (atau hotfix), mengikuti `docs/runbook/`. Dilarang deploy tengah fase tanpa instruksi Lintang.
- **Migrasi DB**: hanya via `pnpm db:generate` (drizzle-kit) + file migrasi ter-commit. Dilarang `drizzle-kit push` ke produksi, dilarang SQL manual tanpa file migrasi. Backup sebelum migrasi produksi (runbook backup).
- **Kapasitas**: server 1 vCPU / 2 GB. Fitur baru tidak boleh menambah proses runtime baru. Ukur memori PM2 setelah deploy gerbang (`pm2 status`), catat di checkpoint gerbang.

## 12. Definisi selesai program

### 12.1 DoD keseluruhan

1. Gerbang semua fase (F0–F8, urutan §3) tertutup dengan bukti di checkpoint gerbang masing-masing.
2. Nol temuan keamanan Critical/High terbuka; pentest ulang (F6.4, mencakup API publik dan shell native) bersih.
3. Matriks lifecycle penuh tanpa ❌ kolom kritis; 12 skenario E2E hijau permanen di CI.
4. Baseline ratchet (F0.2, F0.3) = 0 entri.
5. Silent print berjalan di fleet kasir nyata (min. Android+Bluetooth dan Windows+USB) dengan audit cetak; fallback browser tanpa regresi (gerbang F7).
6. API publik v1 + dokumentasi Scalar live; simulasi onboarding pihak ketiga sukses hanya bermodal docs (gerbang F8).
7. SYSTEM-DESIGN.md, SOURCE-OF-TRUTH.md, ADR (termasuk 0015 dan 0016), dan CLAUDE.md §3.1 mutakhir.
8. Lintang menyatakan sign-off tertulis di TASK.md.

### 12.2 Checklist "ERP lentur kelas S/4" (uji konfigurasi-tanpa-kode)

1. Tambah field di entitas mana pun → muncul di form, detail, ekspor, filter, MCP.
2. Tambah/ubah aturan approval → semua transisi terkait menaatinya.
3. Ubah skema penomoran dokumen per lokasi/tahun → berlaku tanpa kode.
4. Impor master data baru lewat wizard tanpa parser khusus.
5. Ubah kebijakan pajak/tarif per tanggal efektif lewat `tax_rules` tanpa kode.
6. Setiap angka laporan bisa di-drilldown sampai dokumen sumber.
7. P&L bisa dilihat per outlet (profit center) dan per cost center.
8. PO yang melampaui sisa anggaran tertahan oleh commitment check.
9. Role baru + workspace-nya bisa dibentuk dari konfigurasi DB tanpa hardcode.
10. Semua aksi UI inti punya padanan MCP dengan permission dan audit yang sama.

## 13. Risiko utama

| Risiko | Mitigasi |
|---|---|
| Eksekutor melanggar aturan prosa | Fase 0 memindahkan aturan ke CI/hook; gerbang fase memeriksa ulang; bukti-tempel wajib |
| Scope membengkak ke arah "SAP beneran" | §2.2 daftar larangan eksplisit; eksekutor wajib BLOCKED bila task menjurus ke sana |
| RAM 2 GB jebol oleh fitur baru | Larangan proses runtime baru (§11); ukur memori tiap gerbang |
| Sapuan tidak pernah selesai ("semua bug") | Kriteria berhenti eksplisit: dua sapuan beruntun bersih (F2/F3) |
| Konflik dengan hotfix produksi | Hotfix boleh menyela; wajib kembali ke fase berjalan; gerbang tidak bisa ditutup saat ada 🟨 lain |
| Secret/akses CI tidak tersedia | Aturan BLOCKED §1.3; jangan menonaktifkan step |
| Tauri-Android belum sematang Capacitor | Adapter transport diisolasi di balik `PrinterPort` (ADR-0015): bila bermasalah, hanya adapter Android yang dipindah ke Capacitor, builder ESC/POS + UI tidak berubah |
| Signing key (keystore Android, sertifikat Windows) & perangkat uji belum ada | Kartu F7.6/F7.8 BLOCKED dengan instruksi pembuatan untuk Lintang; verifikasi lapangan dijadwalkan di toko |
| API publik disalahgunakan (scraping, brute force, abuse mutasi) | Rate limit per token, idempotency wajib, scope = permission engine, audit penanda `public_api`, sapuan keamanan khusus (F8.6) + masuk scope pentest F6.4 |

---

*Dokumen ini dirawat Perencana. Setiap penutupan gerbang: perbarui tabel §3 (tanggal tutup + link bukti), pecah kartu fase berikutnya, umumkan di TASK.md.*
