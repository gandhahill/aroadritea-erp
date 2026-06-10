# Kartu Fase 6 — paritas MCP + penutupan program (siap eksekusi)

> Bagian dari `docs/plans/MASTER-PLAN-S4-CLASS.md` §10. Baca §1 (kontrak) dulu. Dipecah Perencana 2026-06-10 (T-0287).
> Fakta dasar: 68 tool MCP terdaftar di `apps/mcp/src/tools/index.ts` (accounting 16, reporting 8, inventory 9, tax 7, hr 5, iam 4, crm 4, operations 4, pos 3, payroll 3, purchasing 3, member 3, docs 3, cms 3, promotion 2, audit 1). UI punya ±152 route dashboard.

---

### Kartu F6.1a — MCP parity ledger
- **Effort**: M · **Dependensi**: gerbang F5
- **Tujuan**: `docs/audit/mcp-parity-ledger.md`: tabel per modul, baris = aksi UI (dari `apps/web/lib/nav-access.ts` + server actions per modul), kolom = MCP tool padanan / "tidak ada" / "sengaja tidak diekspos (alasan)". Aksi tanpa padanan dan tanpa alasan = gap.
- **Larangan khusus**: kartu ini HANYA mengaudit dan menulis ledger; implementasi tool di F6.1b.
- **Bukti selesai**: ledger lengkap semua modul; daftar gap ber-prioritas (mutasi inti dulu).

### Kartu F6.1b — Implementasi tool MCP yang hilang
- **Effort**: L (pecah per kelompok modul oleh Perencana berdasar ledger) · **Dependensi**: F6.1a
- **Gap yang sudah diketahui dari inventaris** (validasi ulang lewat ledger): custom fields (definisi + nilai), workflow approvals (list pending / approve / reject / history — penting supaya AI bisa jadi "approver berizin"), stock opname lifecycle penuh, purchase return, purchase invoice + 3-way match, logistics shipments, HR leave/overtime/kasbon, CRM member points adjust, ekspor laporan (XLSX bytes/base64), import wizard dry-run.
- **Pola wajib**: tool baru memanggil service yang SAMA dengan UI; `checkPermission` dengan permission yang sama; mutasi menulis audit_log; input Zod; error terstruktur tanpa bocoran internal (selaras temuan F2.11).
- **Larangan khusus**: dilarang membuat tool yang mem-bypass approval gate (tool mutasi harus menerima hasil `pending_approval` sebagai respons sah, bukan memaksa lolos).
- **Bukti selesai**: ledger diperbarui tanpa gap mutasi inti; test per tool baru; `pnpm verify`.

### Kartu F6.2 — Sinkronisasi dokumentasi + ADR
- **Effort**: M · **Dependensi**: F6.1b
- **Tujuan**: SYSTEM-DESIGN.md memuat arsitektur baru (numbering engine, controlling/CO, budget, MDG, workspace, exception center, config versioning, import wizard, simulasi); SOURCE-OF-TRUTH.md memuat proses bisnis baru (approval berjenjang, budget, merge master); CLAUDE.md §3.1 tabel ADR mutakhir; ADR yang tertunda dari F4/F5 ditulis bila ada keputusan yang belum ter-ADR-kan; `docs/checkpoints/` lama (>7 hari DONE) diarsipkan.
- **Larangan khusus**: dokumen diubah agar MENCERMINKAN kode yang sudah jadi; bila menemukan kode menyimpang dari dokumen, itu temuan (kembali ke loop F3.14), bukan alasan menulis dokumen mengikuti penyimpangan tanpa keputusan.
- **Bukti selesai**: diff dokumen di-review Lintang (BLOCKED menunggu review itu sah); `pnpm verify`.

### Kartu F6.3 — Regresi akhir + drill pemulihan
- **Effort**: M · **Dependensi**: F6.2
- **Tujuan**: (a) `pnpm verify` penuh + 12 skenario + matriks otorisasi F2.2a hijau; (b) smoke produksi sesuai `docs/runbook/` (health 3000/3001/3002, login, satu sale demo, satu laporan); (c) drill backup-restore: restore backup harian terbaru ke DB kosong lokal, jalankan healthcheck terhadapnya, catat durasi (target RTO ≤ 2 menit sesuai ADR-0009); (d) ukur `pm2 status` RAM ketiga app.
- **Larangan khusus**: drill restore TIDAK boleh menyentuh DB produksi; gunakan salinan.
- **Bukti selesai**: laporan `docs/audit/FINAL-REGRESSION-2026-Qx.md` berisi seluruh output.

### Kartu F6.4 — Pentest eksternal ulang + sign-off
- **Effort**: M · **Dependensi**: F6.3
- **Tujuan**: jadwalkan pentest seperti siklus 2026-05-26 / 2026-06-07 (Lintang yang menjalankan/memesan; agen menyiapkan ruang lingkup: domain, permukaan baru sejak pentest terakhir — MCP tools baru, import wizard, approvals); semua temuan masuk prosedur F2 (file sweep + patch + regresi); setelah bersih, minta Lintang menulis sign-off di TASK.md sesuai DoD master plan §12.1.
- **Bukti selesai**: laporan pentest + status semua temuan CLOSED + baris sign-off di TASK.md.

---

## Penutupan program
Perencana memverifikasi DoD §12.1 master plan butir per butir dengan link bukti, lalu menandai plan `SELESAI` di header `docs/plans/MASTER-PLAN-S4-CLASS.md` dan menutup entri backlog plan di TASK.md.
