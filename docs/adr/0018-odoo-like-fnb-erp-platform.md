# ADR-0018: Odoo-Like FnB ERP Platform

- **Status**: Accepted
- **Tanggal**: 2026-06-10
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: `SOURCE-OF-TRUTH.md` §18.6-§18.7, §20-§21
- **Konteks teknis**: `SYSTEM-DESIGN.md` §2, §17-§18, §38; `docs/audit/erp-feature-completeness-2026-06-09.md`; `docs/plans/MASTER-PLAN-S4-CLASS.md`

## Konteks

ERP Aroadri Tea awalnya dirancang sebagai custom ERP ringan untuk FnB retail dengan constraint server 1 vCPU / 2 GB RAM. ADR-0005 menolak memodifikasi Odoo/ERPNext karena footprint runtime tidak cocok dengan constraint tersebut.

Setelah modul inti mulai luas, kebutuhan bisnis diperjelas: ERP ini harus memiliki kelengkapan fitur dan fleksibilitas konfigurasi setara Odoo, tetapi tetap spesifik untuk proses FnB Aroadri. Sistem harus mampu menampung use case baru, perubahan proses, dan kebijakan operasional yang belum bisa diprediksi sejak awal.

Risikonya ada dua arah: terlalu sempit sehingga setiap variasi proses butuh edit source code, atau terlalu generik/berat sehingga berubah menjadi clone Odoo yang tidak cocok untuk ukuran perusahaan, domain FnB, dan VPS kecil.

## Keputusan

Aroadri Tea ERP akan dibangun sebagai **Odoo-like configurable ERP platform with a FnB-first domain pack**.

Artinya:

- Target kelengkapan dan fleksibilitas mengikuti standar ERP modular seperti Odoo: modul lengkap, configurable, extensible, dan bisa diotomasi.
- Implementasi tetap custom, ringan, dan domain-specific: outlet, POS offline, menu/modifier, recipe/BOM, kitchen/KDS, stok bahan, delivery settlement, PB1/PBJT, shift attendance, payroll, dan store operations.
- Fleksibilitas dicapai lewat platform services database-driven, bukan runtime plugin berat atau user-supplied scripting:
  - entity registry
  - custom fields
  - workflow/approval gate
  - document numbering
  - templates
  - comments, attachments, document timeline
  - import/export mapping
  - saved views and scheduled reports
  - automation and notification rules
  - RBAC, location scope, MCP/API parity
- Untuk perubahan yang menyentuh uang, pajak, stok, permission, relasi formal, atau immutable document lifecycle, custom field saja tidak cukup; perubahan harus menjadi schema/service resmi dengan migration, tests, permission, audit, dan MCP/API parity.

## Alternatif yang Dipertimbangkan

1. **Mengadopsi Odoo/ERPNext langsung**
   - Ditolak oleh ADR-0005 karena footprint runtime tidak cocok dengan VPS 2 GB, dan domain FnB Aroadri membutuhkan integrasi khusus seperti POS offline, Naixer QR, PB1/PBJT, dan proses toko lokal.

2. **Custom ERP sempit sesuai kebutuhan sekarang saja**
   - Ditolak karena proses bisnis akan berubah, dan user secara eksplisit meminta ERP yang bisa mengakomodasi use case baru serta perubahan yang tidak dapat diprediksi jauh di masa depan.

3. **Plugin/runtime scripting penuh seperti ABAP atau marketplace module**
   - Ditolak karena terlalu berat, sulit diaudit, meningkatkan risiko keamanan, dan tidak cocok dengan operasi single-company FnB. Konfigurasi DB yang typed, tested, dan permission-aware lebih sesuai.

## Konsekuensi

- Positif: ERP bisa tumbuh mengikuti proses Aroadri tanpa terlalu sering edit source code untuk variasi sederhana.
- Positif: fitur baru punya standar kelengkapan yang jelas: lifecycle, audit, workflow, import/export, reports, permissions, MCP/API.
- Positif: domain FnB tetap tajam; fitur platform dipakai untuk mempercepat proses toko, bukan melebar menjadi ERP generik tanpa fokus.
- Negatif / trade-off: setiap modul baru butuh disiplin lebih tinggi karena harus memikirkan extensibility, audit, permission, workflow, dan MCP/API parity sejak awal.
- Negatif / trade-off: beberapa fitur platform seperti entity registry, import wizard, document timeline, config versioning, dan saved views harus dibangun sebelum ERP benar-benar terasa Odoo-like.
- Netral: batasan server tetap berlaku; keputusan ini tidak mengubah stack, deployment, atau keputusan build-custom dari ADR-0001/ADR-0005.

## Referensi

- `SOURCE-OF-TRUTH.md` §18.7
- `SYSTEM-DESIGN.md` §2, §38
- `docs/audit/erp-feature-completeness-2026-06-09.md`
- `docs/plans/MASTER-PLAN-S4-CLASS.md`
- ADR-0001, ADR-0005, ADR-0017
