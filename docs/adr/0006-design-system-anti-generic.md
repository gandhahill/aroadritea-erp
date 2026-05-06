# ADR-0006: Design System Anti-Generic (UI Aroadri Tea)

- **Status**: Accepted
- **Tanggal**: 2026-05-05
- **Pengambil keputusan**: Lintang Maulana Zulfan
- **Konteks bisnis**: SOURCE-OF-TRUTH §23 (Brand & Visual Identity)
- **Konteks teknis**: SYSTEM-DESIGN §36 (Design System); brand-assets/BRAND.md

## Konteks

Aroadri Tea adalah merek **premium teh ala Tiongkok** yang diposisikan sejajar dengan Chagee dan Molly Tea. UI ERP dan website publik harus memperkuat positioning ini — **bukan tampak seperti dashboard generic SaaS**.

Masalah konkret:
- AI developer (Claude Code, Gemini CLI, Antigravity) cenderung memproduksi UI default shadcn/ui dengan palet zinc/slate, border zinc-200, card bg-white, spinner default, font Inter saja. Tampilan ini **langsung dikenali sebagai output AI**.
- Bila sistem ini dipakai sebagai pitch ke calon mitra/franchisee, tampilan generic akan **menurunkan persepsi premium**.
- User secara eksplisit meminta: "tampilannya tidak generik khas AI dan sesuai dengan color brand".

## Keputusan

Membangun **design system kustom Aroadri Tea** yang dilapisi di atas Tailwind + shadcn/ui, dengan:

### 1. Brand Token Tailwind
Semua warna dipanggil via token `brand.*`:
- `brand.red` `#D6262E` (cinnabar) — primary
- `brand.red-dark` `#A41B22` — hover/pressed
- `brand.cream` `#FBF6EE` — surface warm
- `brand.cream-2` `#F4ECDF` — surface darker
- `brand.ink` `#1A1A1A` — text
- `brand.ink-2` `#3A3A3A` — text secondary
- `brand.gold` `#C8A557` — accent premium
- `brand.jade` `#5C8D7E` — success
- `brand.clay` `#B85C38` — warning

CSS vars shadcn (`--background`, `--foreground`, `--primary`, dll.) **dipetakan ke token brand** di `globals.css`. Tidak ada hex hardcoded di komponen.

### 2. Komponen `packages/ui/` — Override shadcn/ui
Setiap komponen primitif shadcn dibungkus di `packages/ui/<component>.tsx` dengan styling brand. **Komponen dari `apps/*` HANYA boleh import dari `packages/ui/`**, bukan dari shadcn raw.

### 3. Motif Dekoratif Subtle
- Empty state: SVG ilustrasi gunung + awan minimalis monokrom `brand.red`.
- Header publik: garis tipis motif gelombang opacity 8-12%.
- Login page: latar warm cream + radial spotlight halus.
- Customer-facing display: latar `brand.ink` + angka pickup besar `brand.gold` (premium feel).

### 4. Typography
- Body Latin: **Inter** (variable font, 1 file ~100 KB).
- Headline marketing: **Manrope** (display).
- Body Mandarin: **Noto Sans SC**.
- Headline Mandarin: **Noto Serif SC** (memberi rasa traditional).
- Stroke icon: 1.5px (lebih halus dari default Lucide 2px).

### 5. Microinteraction
- `transition-timing` `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out spring).
- Durasi 200–280ms — terasa responsif, bukan "snappy AI default".
- Hover button: scale 1.02 + shadow ramp.
- Focus ring ganda (inner cream, outer red), bukan default biru OS.

### 6. Shadow Hangat
Bukan biru-abu khas Material:
- `shadow-soft`: warm sepia-tone untuk card resting.
- `shadow-pop`: lebih kuat untuk modal/dialog.

### 7. Spinner Kustom
3 titik pulsing horizontal `brand.red` (mengingatkan butir teh / bubble) — bukan border-circle berputar generic.

### 8. Lint Rule + Visual Check
- Biome custom rule (atau ESLint plugin) yang reject `bg-white`, `text-zinc-*`, `border-slate-*` di `apps/*` source code.
- PR checklist: **screenshot 5 halaman utama** (login, dashboard, POS, journal entry, list produk) wajib dilampirkan untuk review.

## Alternatif yang Dipertimbangkan

### A. Pakai shadcn/ui default dengan minor color tweaking
- Pros: Cepat, banyak training data AI.
- Cons: Tetap akan tampak generic karena spacing/radius/shadow/spinner masih default. Brand consistency lemah.
- **Ditolak**.

### B. Pakai library UI premium berbayar (Tremor Pro, NextUI Pro, MUI Premium)
- Pros: Tampilan polished out of the box.
- Cons:
  - Berbayar.
  - Tetap distinctive dari "shadcn AI default", tetapi tidak distinctive dari produk lain yang juga pakai library yang sama.
  - Bundle size lebih besar.
- **Ditolak** alasan biaya & kurang brand-distinct.

### C. Bangun UI kit dari nol (tanpa shadcn)
- Pros: Full kontrol.
- Cons:
  - Effort sangat besar untuk dev solo.
  - Kehilangan benefit shadcn (accessible primitives gratis dari Radix).
  - Risiko bug accessibility.
- **Ditolak**.

### D. Tema dark default (mengikuti tren modern)
- Pros: Modern look.
- Cons:
  - Brand identity Aroadri merah cinnabar + cream warm — fit untuk light mode hangat.
  - F&B premium umumnya tidak pakai dark tema (Apple Pay receipt, Hakkasan menu — light & warm).
- **Ditolak Phase 1**, dark mode opsional Phase 2 dengan basis `brand.ink` + accent `brand.gold`.

### E. Glassmorphism / Neumorphism trendy
- **Ditolak**: tren cepat usang, accessibility lemah.

## Konsekuensi

### Positif
- **Brand-consistent**: setiap halaman ERP & website mencerminkan positioning premium Aroadri.
- **Distinct dari kompetitor**: bukan tampak seperti "another AI-generated SaaS".
- **Re-usable**: `packages/ui/` dipakai oleh `apps/web` dan `apps/site` — single source untuk visual.
- **Accessibility tetap terjaga** (Radix/shadcn primitives di belakang).
- **Type-safe** styling via Tailwind + token.

### Negatif / Trade-off
- **Effort awal lebih besar** untuk override 30+ komponen shadcn. Mitigasi: bertahap, prioritaskan komponen yang sering muncul (Button, Card, Input, Tabs, Toast, Modal, Empty State).
- **AI kurang familiar dengan token brand** dibanding default shadcn → perlu prompt eksplisit. Mitigasi: SYSTEM-DESIGN §36 + lint rule.
- **Brand book belum final** (palet & font masih awal). Mitigasi: token dapat di-update di satu tempat (tailwind.config) tanpa rewrite besar.

### Neutral
- **Phase 1 fokus pada admin ERP** (warna lebih konservatif tetap pakai brand). Phase 5 saat website publik launch, eksplor visual yang lebih ekspresif.

## Implementasi Checklist
- [ ] `tailwind.config.ts` di `apps/web` & `apps/site` import token brand dari `packages/shared/brand-tokens.ts`.
- [ ] `globals.css` map shadcn CSS vars ke token brand.
- [ ] `packages/ui/button.tsx`, `card.tsx`, `input.tsx`, `tabs.tsx`, `toast.tsx`, `modal.tsx`, `empty-state.tsx`, `spinner.tsx` — semua override.
- [ ] `packages/ui/icons/brand/*.svg` — ikon kustom (gunung, awan, daun teh, gelas).
- [ ] Lint rule menolak `bg-white`, `text-zinc-*`, `border-slate-*` di `apps/`.
- [ ] PR template menambah field "screenshot 5 halaman utama".

## Referensi
- González-Viralta et al. (2023), "Positive effects of green practices on consumers' satisfaction, loyalty…", *Heliyon*, 9(10) — wawasan brand consistency mempengaruhi loyalty.
- Ge et al. (2021), "Service Quality, Perceived Value, and Customer Satisfaction in Starbucks Reserve Coffee Shops Shanghai" — referensi premium positioning untuk Chinese-style cafe.
- Refleksi style: Linear, Stripe, Apple Pay, Hakkasan — modern minimal dengan sentuhan premium.
- SOURCE-OF-TRUTH.md §23
- SYSTEM-DESIGN.md §36
- brand-assets/BRAND.md
