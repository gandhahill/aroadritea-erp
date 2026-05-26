# Checkpoint: T-0187 — Lengkapi panduan user ERP + refresh docs DB

- **Owner**: Codex
- **Started**: 2026-05-25 22:53 WIB
- **Last updated**: 2026-05-26 10:05 WIB
- **Status**: DONE

## Goal
Lengkapi panduan user ERP berdasarkan halaman aktual di `apps/web/app/(dash)` dan tambahkan cara aman untuk mengganti konten panduan yang sudah tersimpan di database untuk bahasa Indonesia, Inggris, dan Mandarin.

Spec terkait: SOURCE-OF-TRUTH §21.2b, SYSTEM-DESIGN §25.4, §37, §38.

## Plan
1. [x] Baca `TASK.md`, `SOURCE-OF-TRUTH.md`, `SYSTEM-DESIGN.md`, dan panduan docs saat ini.
2. [x] Jalankan subagent untuk memetakan halaman, tombol, fungsi, dan use case per modul.
3. [x] Perbarui default konten panduan di `apps/web/app/(dash)/docs/docs-content.ts`.
4. [x] Tambahkan mekanisme refresh/replace konten panduan DB per bahasa.
5. [x] Jalankan verifikasi relevan.
6. [x] Update checkpoint dan `TASK.md`.

## Done so far
- Ditemukan halaman panduan publik ERP internal:
  - `apps/web/app/(dash)/docs/page.tsx`
  - `apps/web/app/(dash)/docs/docs-content.ts`
  - `apps/web/app/(dash)/docs/editable-docs.ts`
- Ditemukan editor CMS docs:
  - `apps/web/app/(dash)/cms/docs/page.tsx`
  - `apps/web/app/(dash)/cms/docs/docs-editor-form.tsx`
  - `apps/web/app/(dash)/cms/docs/actions.ts`
- Konten docs disimpan di `cms_settings` dengan key `erp_docs_content`. Default di source hanya dipakai saat setting kosong.
- Subagent selesai memetakan modul dan halaman utama: route/sidebar, POS/inventory/purchasing/Naixer, accounting/reporting/tax/audit/evidence, HR/CRM/helpdesk/AI/CMS, serta strategi storage/refresh panduan.
- Ditambahkan `apps/web/app/(dash)/docs/docs-supplement.ts` sebagai suplemen trilingual ID/EN/ZH untuk halaman, tombol, fungsi, dan use case modul operasional.
- `editable-docs.ts` sekarang menggabungkan konten default lama dengan suplemen lengkap sebelum disimpan/ditampilkan sebagai default.
- Service CMS sekarang punya helper audit-aware untuk `getDocsContent`, `replaceDocsContent`, dan `replaceDocsLocale`; semua tetap melewati permission `docs.edit`.
- Editor CMS docs (`/cms/docs`) sekarang punya aksi refresh default per bahasa, sehingga admin bisa mengganti hanya ID/EN/ZH yang dipilih tanpa menghapus bahasa lain.
- MCP `docs.update` dipindahkan ke helper service yang sama, dan tool baru `docs.update_locale` ditambahkan untuk replace satu bahasa saja.
- CLI `pnpm docs:refresh` ditambahkan untuk dry-run/apply refresh konten `erp_docs_content` langsung ke DB dengan audit log.

## Decisions
- Task baru dibuat sebagai T-0187 agar tidak mengambil alih T-0186/T-0167 yang masih aktif.
- Konten user guide harus tetap trilingual dan tetap mendukung anotasi `{perm=...}` serta `{audience=...}`.
- Seed tetap tidak dibuat overwrite otomatis. Refresh isi panduan harus berupa aksi eksplisit via UI, MCP, atau CLI agar tidak menimpa perubahan manual admin tanpa audit trail.
- Mekanisme replace disimpan di service CMS agar UI, MCP, dan script memakai validasi konten yang sama.

## Open issues
- Belum menjalankan `pnpm docs:refresh -- --apply` karena itu akan mengubah database aktif. Ini sengaja dibuat aksi eksplisit per environment agar tidak menimpa edit manual admin tanpa audit trail.

## Next step
Opsional saat ingin memperbarui konten DB aktif: jalankan `pnpm docs:refresh -- --dry-run --locales id,en,zh --tenant default`, review ukuran konten, lalu jika benar jalankan `pnpm docs:refresh -- --apply --locales id,en,zh --tenant default --reason "Refresh ERP docs after guide update"` pada environment DB yang memang ingin diperbarui.

## Test status
- PASS: `pnpm --filter @erp/services typecheck`
- PASS: `pnpm --filter @erp/mcp typecheck`
- PASS: `pnpm --filter @erp/web typecheck`
- PASS: `pnpm exec biome check "apps/web/app/(dash)/docs/docs-content.ts" "apps/web/app/(dash)/docs/editable-docs.ts" "apps/web/app/(dash)/docs/docs-supplement.ts" "apps/web/app/(dash)/cms/docs/actions.ts" "apps/web/app/(dash)/cms/docs/docs-editor-form.tsx" "apps/mcp/src/tools/phase2.ts" "packages/services/src/cms/index.ts" "scripts/refresh-erp-docs-content.ts" "apps/web/messages/id.json" "apps/web/messages/en.json" "apps/web/messages/zh.json" "package.json"`
- PASS: `pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop scripts/refresh-erp-docs-content.ts`
- PASS: `pnpm -w typecheck`
- PASS: `pnpm -w lint`
- PASS: `pnpm -w test`
- PASS: `pnpm --filter @erp/web build`
