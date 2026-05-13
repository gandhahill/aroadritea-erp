# ADR-0004: Registrasi & Otentikasi Member Online

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §13 (CRM & Loyalty), §22.4 (Pendaftaran Membership Online)
- **Konteks teknis**: SYSTEM-DESIGN §31.5–§31.7

## Konteks

User ingin pelanggan dapat mendaftar **member** secara online di `aroadritea.com/member/daftar`, mendapat **kartu digital QR**, dan dapat login ke portal akun untuk melihat saldo poin, riwayat transaksi, dan voucher.

Kebutuhan tambahan:
- **UU PDP**: data pribadi terenkripsi, ada kebijakan privasi, ada hak hapus akun.
- **Anti-abuse**: rate-limit signup, captcha.
- **Konsistensi**: data member adalah subset dari `partners` (kind=customer + is_member=true) di ERP — sehingga modul CRM, POS attach customer, loyalty engine, dll. semua melihat record yang sama.
- **Domain berbeda dari ERP**: cookie sesi member harus terpisah dari cookie staff ERP.
- **Verifikasi**: pastikan email/HP valid sebelum akun aktif.

## Keputusan

### 1. Sumber Data Single
- Member tersimpan di `partners` (tabel sudah ada untuk customer/supplier/employee), dengan flag `is_member=true` dan FK ke tabel `members` yang menyimpan **kredensial member-spesifik** (`password_hash`, `email_verified_at`, `phone_verified_at`, `consent_pdp_at`, `member_qr_token`, `tier_id`).
- **Tidak** membuat tabel "users" baru untuk member — `partners` adalah sumber kebenaran.

### 2. Otentikasi Terpisah dari Staff ERP
- Tabel sesi terpisah: `member_sessions` (vs `sessions` untuk staff).
- Cookie: `__Host-member-session` di `aroadritea.com`. Berbeda nama dengan cookie staff (`__Host-session` di `erp.aroadritea.com`).
- Library auth: better-auth dapat dikonfigurasi untuk **dua adapter session** dalam satu codebase, **atau** kita gunakan dua instance (satu di `apps/site`, satu di `apps/web`) yang share schema partners.

### 3. Verifikasi via OTP
- **Phase 1**: OTP via **email** memakai SMTP mailbox HestiaCP (lihat ADR-0011).
- **Phase 2**: OTP via **WhatsApp** (jika integrasi WhatsApp Business API tersedia).
- Format OTP: 6 digit numeric, expiry 10 menit, max 5 percobaan.
- Tabel `member_otp_codes` menyimpan hash code (bukan plain text), `expires_at`, `attempts`, `consumed_at`.

### 4. Anti-Abuse
- **Captcha**: Cloudflare Turnstile pada `POST /api/member/signup` (gratis, friendly, GDPR-compliant).
- **Rate limit per IP**: 3 signup attempts / jam.
- **Rate limit per email**: 1 signup OTP / 5 menit.
- Audit di `member_signup_attempts` (untuk forensik abuse pattern).

### 5. UU PDP Compliance
- Halaman **Kebijakan Privasi** wajib live sebelum form signup aktif.
- Checkbox consent eksplisit dengan `required`: "Saya menyetujui [Kebijakan Privasi]".
- Field `consent_pdp_at` di `members` mencatat waktu persetujuan.
- Menu "Hapus akun saya" di `/member/akun/hapus` — soft delete + scheduling worker untuk anonimisasi setelah 30 hari (memberi window untuk membatalkan permintaan).
- Data sensitif (`phone`, `email`, `birthdate`) terenkripsi at-rest dengan pgcrypto + key di env `DATA_ENCRYPTION_KEY`.

### 6. Kartu Member QR
- Format payload QR: `MEM:<partner_ulid>` (prefix `MEM:` untuk membedakan dengan QR pesanan POS yang `T<location>-...`).
- Token tidak menyertakan PII; lookup di server.
- Digenerate dari server (bukan client) untuk konsistensi.
- Dapat di-render sebagai PNG/SVG dan disimpan offline di device member (Phase 2: dapat di-export ke Apple/Google Wallet).

### 7. Login Member
- Email + password (argon2id hash).
- Setelah 5 percobaan gagal dalam 15 menit → lock 1 jam.
- Opsi "lupa password" via OTP email.
- Cookie member session: `Max-Age=30 hari` (member experience), berbeda dengan staff session yang lebih ketat (8 jam dengan extend).
- 2FA tidak wajib (Phase 2 opsional via TOTP).

## Alternatif yang Dipertimbangkan

### A. OAuth Sosial (Google/Apple/Facebook)
- Pros: Friction signup rendah; tidak perlu password/OTP.
- Cons:
  - Aroadri brand pelanggan kemungkinan campur (tidak semua punya Google account); apel/google config berbayar dan rumit untuk badan usaha kecil.
  - User Indonesia banyak yang mendaftar pakai email Yahoo/iCloud/lokal — dukungan luas tetap perlu email+OTP.
  - Privasi: meneruskan data ke pihak ketiga.
- **Ditolak Phase 1**, dipertimbangkan Phase 2 sebagai opsi tambahan.

### B. Email + Password Tanpa OTP (Verifikasi via Link)
- Pros: Lebih sederhana implementasi (tidak perlu generate code).
- Cons:
  - Verifikasi link rentan abuse (link tertinggal di email, bisa di-bookmark).
  - User Indonesia banyak yang tidak buka email tepat waktu.
- **Ditolak**, OTP memberi pengalaman lebih cepat dan auditable.

### C. Magic Link (Tanpa Password)
- Pros: Tidak perlu mengingat password.
- Cons:
  - Setiap login butuh email — friction tinggi untuk repeat user.
  - Tidak cocok untuk member yang sering login lewat HP saat antri di toko.
- **Ditolak**, pakai password + OTP signup.

### D. Pakai SMS Gateway untuk OTP
- Pros: HP terverifikasi; banyak user lebih buka SMS daripada email.
- Cons:
  - **Biaya per SMS** (~Rp 300–500/SMS) bertambah cepat dengan adopsi.
  - Belum ada budget di Phase 1.
- **Ditolak Phase 1**; Phase 2 setelah ada metrik adopsi.

### E. Cookie Sesi Bersama (Single Sign-On Member ↔ Staff)
- Pros: User yang juga staff hanya login sekali.
- Cons:
  - Domain berbeda (`aroadritea.com` vs `erp.aroadritea.com`) → SSO butuh OIDC server, overkill.
  - Permission model berbeda.
- **Ditolak**, sesi terpisah lebih aman.

## Konsekuensi

### Positif
- **Audit & compliance UU PDP**: jejak consent jelas, data terenkripsi, hak hapus terimplementasi.
- **Single source data member**: `partners` tetap satu — modul POS/CRM/loyalty langsung lihat data member.
- **Friction rendah**: email + OTP cukup cepat (rerata 30 detik).
- **Anti-abuse layered**: rate limit + captcha + audit trail.
- **Domain aman**: cookie member tidak terlihat dari ERP, dan sebaliknya.

### Negatif / Trade-off
- **Email deliverability**: gmail/Yahoo terkadang masuk spam. Mitigasi: SPF, DKIM, DMARC dikonfigurasi sejak awal di HestiaCP/DNS; jika reputasi domain buruk, pertimbangkan ADR baru untuk provider khusus.
- **OTP via email** bukan pengalaman terbaik (vs SMS/WA). Mitigasi: Phase 2 tambah WA OTP.
- **Tidak ada SSO sosial**: sebagian user akan friction. Mitigasi: pertimbangkan tambah Google login Phase 2 jika ada permintaan.
- **Two auth stacks** (staff vs member): kompleksitas kode bertambah. Mitigasi: keduanya panggil `packages/services/auth` dengan adapter berbeda.

### Neutral
- **Kartu QR**: pelanggan yang pertama kali mungkin bingung "bagaimana cara pakai" — solusi: tampilkan tutorial saat pertama kali login.

## Skema Migrasi (Awal Phase 5)

```sql
-- members (member-specific data, references partners)
CREATE TABLE members (
  partner_id text PRIMARY KEY REFERENCES partners(id),
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  consent_pdp_at timestamptz NOT NULL,
  member_qr_token text UNIQUE NOT NULL,
  tier_id text REFERENCES loyalty_tiers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE member_otp_codes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'login', 'reset')),
  channel text NOT NULL CHECK (channel IN ('email', 'wa', 'sms')),
  recipient text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON member_otp_codes (recipient, purpose, created_at DESC);

CREATE TABLE member_signup_attempts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  email text,
  phone text,
  ip inet NOT NULL,
  user_agent text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL CHECK (outcome IN ('otp_sent', 'otp_verified', 'failed_captcha', 'rate_limited', 'failed_validation')),
  partner_id text
);

CREATE TABLE member_sessions (
  id text PRIMARY KEY,
  partner_id text NOT NULL REFERENCES partners(id),
  expires_at timestamptz NOT NULL,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON member_sessions (partner_id);
```

## Referensi

- UU No. 27 Tahun 2022 (UU Perlindungan Data Pribadi Indonesia) — basis kewajiban consent + hak penghapusan.
- Yanto et al. (2016), "The Behavior of Indonesian SMEs in Accepting Financial Accounting Standards without Public Accountability" — wawasan adopsi pengguna SME Indonesia (relevan untuk friction tolerance signup).
- Nadiri & Günay (2012), "An Empirical Study to Diagnose the Outcomes of Customers' Experiences in Trendy Coffee Shops", *JBEM*, 14(1), 22–53 — wawasan customer experience kafe (member onboarding harus cepat dan menyenangkan).
- Ge et al. (2021), "Service Quality, Perceived Value, and Customer Satisfaction in Starbucks Reserve Coffee Shops Shanghai", *Sustainability*, 13(15), 8633 — relevansi loyalty program untuk Chinese-style premium tea.
- Cloudflare Turnstile docs — captcha pilihan.
- SOURCE-OF-TRUTH.md §13, §22.4
- SYSTEM-DESIGN.md §31.5–§31.7

## Tindak Lanjut
- [x] Pilih provider email transactional: SMTP mailbox bawaan HestiaCP (ADR-0011).
- [ ] Buat halaman "Kebijakan Privasi" dengan kuasa hukum (atau template UU PDP yang dapat dikonfirmasi).
- [ ] Worker job untuk anonimisasi akun yang request hapus (eksekusi setelah 30 hari).
- [ ] Tambahkan ADR baru bila Phase 2 menambah WA OTP / Google login.
