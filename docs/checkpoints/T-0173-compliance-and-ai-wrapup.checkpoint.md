# Checkpoint: T-0173 — Compliance + AI wrap-up

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 07:50 WIB
- **Last updated**: 2026-05-25 08:05 WIB
- **Status**: 🟩 DONE
- **Phase**: cross-cutting (E + B + AI continuation)
- **Branch**: master

## Goal

Empat item kohesif:

1. **E23 Member account deletion** (UU PDP / privasi) — tombol "Hapus
   Akun" di `/[locale]/member/akun` yang men-anonimisasi PII +
   soft-delete + audit. **Bukan delete fisik** — riwayat poin
   loyalty dan complaint tetap punya foreign key, tetapi seluruh
   PII (nama, telepon, alamat, email) di-overwrite dengan placeholder
   tetap. Member yang sudah dihapus tidak bisa login.
2. **`log_complaint_draft` tool + commit dispatcher** — pola
   draft→confirm→commit yang sama dengan `manual_sale`, supaya
   kasir bisa minta AI "catat komplain pelanggan X tentang …" →
   konfirmasi → `logComplaint` dipanggil.
3. **Admin AI log viewer** (`/settings/ai-assistant/log`) — list
   sesi + tool call + draft lintas user untuk role
   `ai.assistant.admin`. Filter by user, kind, tanggal, status.
4. **Sweeper draft kedaluwarsa** — scheduled job harian:
   `ai-action-drafts-sweeper` yang menandai draft `pending` lewat
   `expires_at` sebagai `expired`. Diaktifkan default lewat
   `scheduled_jobs` seed.

**DoD:**
- [ ] Service `deleteMyMember(memberId, reason)` + Server Action +
      UI dengan double-confirm.
- [ ] `log_complaint_draft` register di tools/registry, kind
      `complaint` sudah ada di `COMMIT_PERMISSION_BY_KIND`.
- [ ] Page `/settings/ai-assistant/log` + permission gate.
- [ ] Job `ai-action-drafts-sweeper` di `scheduled_jobs` seed +
      handler di worker.
- [ ] Tests baru + typecheck + suite PASS.

## Plan

1. [ ] Service `deleteMyMember` di `packages/services/src/member`
       — anonimisasi `partners.name/email/phone/address`, set
       `isActive=false`+`isMember=false`, revoke semua sesi,
       hapus `member_credentials`, soft-delete row di `partners`,
       audit `delete` entity `member` (tanpa PII).
2. [ ] Server Action `deleteMyAccountAction` di
       `apps/site/actions/member.ts` (resolve session → call service
       → destroy cookie → return).
3. [ ] UI: card baru "Hapus akun saya" di
       `apps/site/app/[locale]/member/akun/page.tsx` dengan
       konfirmasi 2 langkah + alasan opsional.
4. [ ] i18n keys id/en/zh.
5. [ ] Tool `log_complaint_draft` (`packages/services/src/ai/tools/`).
6. [ ] Registrasi di `tools/registry.ts` + permission `crm.logComplaint`.
7. [ ] Page admin AI log + actions + permission gate.
8. [ ] Sweeper: tambah `aiActionDraftsSweeper` di
       `apps/worker/src/jobs/` + entri seed `scheduled_jobs`.
9. [ ] Tests untuk delete-member + complaint draft + sweeper.

## Done so far

- _(belum)_

## Decisions

- **Anonimisasi vs hard delete**: pilih anonimisasi. Hard delete
  membuat foreign key ke `member_points_transactions`,
  `member_vouchers`, `complaints`, `loyalty` rusak. Anonimisasi
  pertahankan integritas akuntansi (UU PDP §15 ayat 4: pengendali
  data wajib memutuskan penghancuran/penghapusan; di sini kami
  pilih penghapusan dengan tetap menjaga integritas referensial,
  konsisten dengan "right to be forgotten" yang umum di e-commerce).
- **Audit anonim**: row `delete` ditulis dengan `userId=memberId`
  yang akan dihapus, tetapi `before` snapshot TIDAK mencakup
  raw PII; hanya konfirmasi field telah di-anonimkan.
- **Sweeper jadwal harian** sudah cukup — draft TTL 30 menit jadi
  worst-case window 1 hari sebelum status berubah jadi `expired`.

## Next step

Mulai dari service. Edit
`packages/services/src/member/index.ts`, tambah
`deleteMyMember({ memberId, reason }, ctx)` di bawah
`completeMemberPasswordReset`.

## Test status

- _(belum, baseline T-0172 hijau 647/647)_

## Files Touched

| Path | Action | Note |
|------|--------|------|
| `docs/checkpoints/T-0173-compliance-and-ai-wrapup.checkpoint.md` | Added | This file. |

## Commits So Far

| SHA | Message | Date |
|-----|---------|------|
| _(akan)_ | | |
