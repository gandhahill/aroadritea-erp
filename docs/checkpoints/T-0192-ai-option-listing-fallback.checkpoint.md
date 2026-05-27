# Checkpoint: T-0192 - Add AI product/location option listing fallback

- **Owner**: Codex
- **Started**: 2026-05-27 09:22 WIB
- **Last updated**: 2026-05-27 09:27 WIB
- **Status**: DONE

## Goal

Pastikan AI lookup generic untuk semua produk/lokasi:
- Fuzzy lookup tetap bukan hardcoded contoh Plaza/Osmanthus.
- Saat lookup gagal atau ambigu, AI punya tool eksplisit untuk mengambil daftar kandidat produk/lokasi.
- System prompt mengarahkan AI untuk menjawab "mungkin maksud Anda..." berdasarkan kandidat tool, bukan menebak.

## Plan

1. [x] Cek implementasi lookup saat ini.
2. [x] Tambah tool list untuk lokasi dan produk dengan filter opsional + limit.
3. [x] Update registry dan system prompt.
4. [x] Tambah test untuk list fallback.
5. [x] Jalankan targeted test/typecheck.
6. [ ] Commit/push dan deploy jika perlu.

## Done so far

- Dikonfirmasi patch T-0191 sudah generic token matching, bukan khusus Plaza/Osmanthus.
- Gap ditemukan: belum ada tool eksplisit untuk list opsi jika lookup gagal total.
- Ditambah `packages/services/src/ai/tools/list-options.ts`.
- Registry sekarang expose `list_products` dan `list_locations`.
- System prompt menginstruksikan AI untuk memakai list tool ketika lookup gagal/ambigu dan bertanya "Mungkin maksud Anda..." dengan opsi nyata dari DB.
- Test menutup contoh list lokasi dan list produk lengkap (SKU, kind, UOM, harga).

## Next step

No next coding step. Deploy commit T-0192 agar AI runtime production mendapat tool baru.

## Test status

- PASS: `pnpm --filter @erp/services test -- ai-lookup-tools.test.ts` (4 tests).
- PASS: `pnpm --filter @erp/services typecheck`.
- PASS: scoped `pnpm exec biome check` untuk file T-0192.
- PASS: `pnpm --filter @erp/web build`.
