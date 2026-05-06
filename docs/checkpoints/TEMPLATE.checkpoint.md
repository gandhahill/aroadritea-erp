# Checkpoint: T-XXXX — <Title singkat>

> **CARA PAKAI**: copy file ini menjadi `<TASK_ID>-<slug>.checkpoint.md` saat memulai task. Update setiap 100+ baris code atau setiap sub-step Plan diselesaikan.

- **Owner**: <ai-model-name, mis. claude-sonnet-4-5>
- **Started**: YYYY-MM-DD HH:MM (timezone WIB)
- **Last updated**: YYYY-MM-DD HH:MM
- **Status**: 🟦 PENDING / 🟨 IN_PROGRESS / 🟩 DONE / 🟥 BLOCKED
- **Phase**: 1 / 2 / 3 / 4 / 5 / 6
- **Branch**: feat/T-XXXX-<slug>

## Goal

Apa yang harus dicapai oleh task ini, satu paragraf ringkas. Sertakan link spec:
- Spec bisnis: SOURCE-OF-TRUTH §X.X
- Spec teknis: SYSTEM-DESIGN §X.X
- ADR terkait: ADR-NNNN (bila ada)

**Kriteria selesai (Definition of Done):**
- [ ] Kriteria 1 (mis. unit test untuk happy path lulus)
- [ ] Kriteria 2 (mis. lint + typecheck lulus)
- [ ] Kriteria 3 (mis. MCP tool tersedia)
- [ ] Kriteria 4 (mis. permissions di-seed)
- [ ] Kriteria 5 (mis. i18n key di id/en/zh)
- [ ] Kriteria 6 (mis. audit log dipanggil)
- [ ] Kriteria 7 (mis. dokumentasi di SOURCE-OF-TRUTH / SYSTEM-DESIGN diupdate jika ada keputusan baru)

## Plan

Daftar langkah konkret yang akan dijalankan. Tandai checklist saat selesai.

1. [ ] Langkah pertama (mis. tambah Zod schema input)
2. [ ] Langkah kedua (mis. implementasi function service)
3. [ ] Langkah ketiga (mis. test happy path)
4. [ ] Langkah keempat (mis. test edge case A)
5. [ ] Langkah kelima (mis. test edge case B)
6. [ ] Langkah keenam (mis. server action wrapper)
7. [ ] Langkah ketujuh (mis. UI form)
8. [ ] Langkah kedelapan (mis. MCP tool)
9. [ ] Langkah kesembilan (mis. i18n keys)
10. [ ] Langkah kesepuluh (mis. PR + verifikasi CI)

## Done so far

> Daftar konkret apa yang sudah ditulis. Sertakan path file + line number bila perlu.

- _(belum ada — task baru saja dimulai)_

## Decisions

> Keputusan teknis yang diambil dalam task ini. Bila signifikan dan mempengaruhi modul lain → tulis ADR.

- _(belum ada)_

## Open issues / Questions

> Pertanyaan yang muncul, bug yang ditemukan, TODO yang ditunda.

- _(belum ada)_

## Next step

> **WAJIB DIISI EKSPLISIT** sebelum AI berhenti. Hindari kalimat vague.
>
> ❌ "Lanjutkan implementasi"
> ❌ "Selesaikan test"
> ❌ "Tinjau ulang kode"
>
> ✅ "Edit `packages/services/accounting/journal.service.ts` baris 142, tambahkan check `if (period.status !== 'open') return err(new AppError('BUSINESS_RULE', 'errors.accounting.period_closed'))`. Lalu jalankan `pnpm test packages/services/accounting/journal.service.test.ts -t 'rejects closed period'`."

_(belum ada — isi sebelum exit sesi)_

## Test status

- **Unit**: 0/N lulus (belum dijalankan)
- **Integration**: belum
- **E2E**: belum / N/A

## Files Touched

> Daftar lengkap file yang ditambah/diubah dalam task ini. Update saat melakukan edit signifikan.

| Path | Action | Note |
|------|--------|------|
| _(belum ada)_ | | |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(belum ada)_ | | |

## Handoff Notes

> Jika task akan diserahkan ke AI lain, tulis catatan khusus (gotchas, area yang perlu hati-hati, asumsi yang sudah dibuat).

_(opsional)_

---

## Aturan File Ini

- **Update**: setiap 100+ baris code atau sub-step Plan diselesaikan.
- **Last updated**: WAJIB diperbarui setiap edit checkpoint.
- **Next step**: WAJIB konkret sebelum exit sesi.
- **Commits**: WAJIB tercatat (minimal SHA + tanggal) untuk bisa di-rebuild kontekstual.
- **Saat selesai**: ubah Status ke 🟩 DONE, lengkapi Commits, lalu update `TASK.md`.
- **Saat archive**: setelah 7 hari dari Done, pindahkan file ke `archive/`.
