# Checkpoint: T-0176 — Auth hardening

- **Owner**: Claude Opus 4.7
- **Started**: 2026-05-25 11:45 WIB
- **Last updated**: 2026-05-25 12:00 WIB
- **Status**: 🟩 DONE
- **Phase**: Security (B24 + B-EXT + PII)

## Goal

Tutup tiga sisa item Phase B yang masih backlog:

1. **B24** — sesi multi-perangkat dengan revoke per-row + "logout
   everywhere", plus invalidasi otomatis setelah ganti password.
2. **PII log scrub** — helper umum agar service yang log error tidak
   tanpa sengaja meneruskan email/telepon/NIK/NPWP/password ke logger.
3. **Naixer HMAC inbound** — utility validasi tanda tangan + window
   replay untuk siapa pun yang nanti mengirim webhook ke ERP.

## Done

- **Sessions UI** (`apps/web/app/(dash)/account/`):
  - `sessions-section.tsx` — list semua sesi user dengan badge "Perangkat ini",
    revoke per-row, dan tombol "Keluar dari semua perangkat lain". Konfirmasi
    via modal (tidak ada `alert`/`confirm` native).
  - `actions.ts` — `listMySessions`, `revokeSessionAction`,
    `revokeAllOtherSessionsAction`, plus helper internal
    `revokeAllOtherSessionsForUser` yang juga dipanggil otomatis setelah
    `updatePasswordAction` sukses (best-practice: ganti password = invalidate
    sesi lain).
  - `page.tsx` — `<SessionsSection />` di-render di bawah account
    settings.
  - i18n: namespace `account.sessions.*` ditambah di id/en/zh paritas
    (title, description, ipLabel, createdLabel, expiresLabel, revoke,
    logoutEverywhere, confirm modals, errors).
- **PII log scrub** (`packages/shared/src/security/log-scrub.ts`):
  - `scrubPii(string)` — email, phone 10–13 digit (3+****+4),
    NIK 16 digit (3+\*9+4), NPWP 15 digit (2+\*9+4), secret JSON
    keys (password / token / secret / authorization / cookie).
  - `scrubPiiDeep(obj)` — walks nested objects + arrays, replace
    sensitive keys outright dengan `***` lalu scrub string values.
  - Tests `log-scrub.test.ts` — 7 cases (email, phone, NIK, JSON
    password, rupiah passthrough, nested objects).
  - Exported via `@erp/shared/log-scrub`.
- **HMAC helper** (`packages/shared/src/security/hmac.ts`):
  - `computeHmac(secret, body, encoding)` + `validateInboundHmac()`
    dengan pattern Stripe-like: `signedPayload = ${timestamp}.${body}`,
    timing-safe compare, hard window default 300 detik untuk defend
    replay attack. Dukung hex (default) & base64.
  - Tests `hmac.test.ts` — 5 cases (happy, tampered body, expired,
    invalid ts, base64).
  - Exported via `@erp/shared/hmac`.

## Notes

- Sessions table digunakan oleh better-auth langsung (kolom
  `sessions.token`). Kita baca via cookie raw (header) supaya tidak
  perlu memanggil better-auth internals.
- Naixer integration sendiri saat ini QR-only (ADR-0007); helper HMAC
  siap dipakai bila ada webhook callback di masa depan.
- Log scrubber dipakai opt-in di setiap site yang log error; tidak
  otomatis di intercept supaya rupiah amounts / journal numbers tidak
  ikut tersaring.

## Test status

- **Unit**: 85/85 shared (+11 dari T-0175 baseline 74), 585/585
  services tetap.
- **Typecheck**: PASS 10 workspaces.
