# Checkpoint: T-0175 — Shift change notification

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 11:33 WIB
- **Last updated**: 2026-05-25 11:45 WIB
- **Status**: 🟩 DONE
- **Phase**: HR / Notifications
- **Branch**: master

## Goal

User request 2026-05-25: setiap penambahan / perubahan / penghapusan
shift untuk seorang karyawan harus memicu notifikasi **in-app** dan
**email** ke karyawan terkait.

## Done

- **Email transport** (`packages/services/src/notification/email-transport.ts`):
  ekstrak SMTP helper yang sebelumnya inline di `member/index.ts`
  supaya bisa dipakai siapa saja. Same defaults (TLS, 10s/15s timeouts),
  dev mode skip send tanpa SMTP, production raise error.
- **notify-user.ts** (`notifyUser`, `notifyUserByEmail`):
  - `notifyUser({ tenantId, userId, kind, title, body, link, email })`
    → insert 1 row `user_notifications` + opsional kirim email.
  - `notifyUserByEmail` resolve user by email lalu fan-out; jika user
    belum punya akun ERP tapi `email_template` ada, kirim email
    langsung tanpa in-app row.
  - Best-effort: email failure tidak undo in-app notification.
  - Re-exported dari `@erp/services/notification`.
- **Hook ke shift schedule actions** (`apps/web/app/(dash)/hr/schedule/actions.ts`):
  - `upsertAssignmentAction` create / update branches → panggil
    `notifyShiftChange(action)` dengan label shift + lokasi yang
    sudah di-resolve.
  - `deleteAssignmentAction` → snapshot row sebelum delete (kalau
    tidak, employeeId & workDate hilang), lalu fan-out.
  - `notifyShiftChange` helper internal: cari employee, susun
    title + body bahasa Indonesia, escape HTML untuk versi email,
    panggil `notifyUserByEmail`. Semua best-effort.
  - i18n catatan: subject email selalu BAHASA INDONESIA (operator
    cashier outlet pakai Bahasa Indonesia by default); UI bell-icon
    sudah multilingual via `userNotifications.kind`.
- **Tests** (`packages/services/tests/notify-user.test.ts`):
  - notifyUser tanpa email_template (no send).
  - notifyUser dengan email_template + user aktif → send.
  - notifyUser dengan user terminated → no send.
  - notifyUserByEmail resolve user + send.
  - notifyUserByEmail fallback langsung kirim email tanpa user row.
- **Verifikasi**: typecheck PASS; full test suite tetap hijau.

## Decisions

- **Locale email = id**: outlet menggunakan Bahasa Indonesia. Field
  locale per-employee belum dieksploitasi; bisa ditambah kemudian
  dengan mempersonalisasi `email_template`. Untuk sekarang body cukup
  ringkas + label statis.
- **Best-effort**: notification tidak masuk transaksi shift insert.
  Kalau gagal kirim, shift tetap ter-update — admin bisa cek bell icon
  / audit_log untuk verifikasi.
- **Email subject prefix `[Aroadri Tea]`**: gampang difilter inbox
  staff.

## Next step (untuk T-0176)

- Reporting UX polish: interaktif drill-down chart, komparasi periode,
  XLSX coverage sweep, web-search opt-in AI (toggle UI).
