# Aroadri Tea — Brand Identity Reference

> Catatan brand untuk pengembangan ERP & website. Aset visual otoritatif harus diletakkan di folder ini.

## Logo Utama

- **File**: `logo-primary.png` (yang dikirim user 2026-05-05 — perlu disimpan ulang sebagai file binary di sini)
- **Komposisi**:
  - Lingkaran solid berwarna **merah** (warna keberuntungan dalam tradisi Tionghoa)
  - Huruf **"A"** stilisasi membentuk **siluet gunung / puncak** berwarna putih di tengah
  - Motif **awan keberuntungan (祥云 / xiángyún)** di kiri-kanan huruf A
  - Motif **gelombang air** di bagian bawah lingkaran
  - Awan tradisional (cloud / 云) di bawah membentuk dasar
  - Lambang **™** (Trademark) di kanan atas

## Filosofi Visual

- **Gunung + awan + air**: ikon klasik lukisan lanskap Tionghoa (山水 / shānshuǐ) → menyiratkan **alam, kemurnian, dan ketenangan** — relevan untuk merek teh premium.
- **Nama Aroadri**: berasal dari perpaduan **Aroma** dan **Adri**; dalam bahasa Sanskerta, **Adri** berarti **gunung**.
- **Tagline resmi**: **Nature Aroma in Every Sip**. Tagline diperlakukan sebagai teks brand dan tidak diterjemahkan.
- **Tanda outlet**: gunakan teks **中国茶** sebagai aksen visual brand di website publik pada semua bahasa/locale.
- **Merah + putih**: kontras tinggi, kuat di papan reklame mall / signage toko (sudah dipakai 6 unit signage menurut SoT §10.4).
- **Gaya Chinese-traditional dengan twist modern**: target pasar kelas menengah Indonesia yang menginginkan teh ala Tiongkok premium (kompetitor: Chagee, Molly Tea — SoT §2).

## Palet Warna (Referensi Awal)

> Belum ada brand book resmi. Nilai berikut **draft**, perlu konfirmasi dengan grafis brand resmi.

| Token | Hex (estimasi) | Pemakaian |
|-------|----------------|-----------|
| `--brand-red` | `#D6262E` (merah cinnabar) | logo, header, tombol primer |
| `--brand-red-dark` | `#A41B22` | hover, tekanan |
| `--brand-cream` | `#FBF6EE` | latar terang, kertas struk |
| `--brand-ink` | `#1A1A1A` | teks utama |
| `--brand-gold` | `#C8A557` | aksen premium (opsional) |

> Gunakan token ini di Tailwind config sebagai `colors.brand.*`. Jangan hardcode hex di komponen.

## Tipografi (Brand Guideline)

Aturan wajib:

- **Wordmark "Aroadri Tea" (logo + setiap penyebutan di header/sidebar/login):
  Montserrat ExtraBold (800), uppercase, letter-spacing 0**. Dimuat via
  `next/font/google` sebagai CSS variable `--font-brand-wordmark` dan
  diterapkan lewat utility class `.brand-wordmark` di kedua app
  (`apps/site`, `apps/web`).
- **Latin (ID/EN) untuk body & UI**: **Inter** di ERP, **Manrope** di
  site publik. Keduanya open-source.
- **Mandarin (ZH-CN)**: **Noto Sans SC** untuk body, **Noto Serif SC**
  untuk heading display.
- **Heading marketing display**: bila ingin nuansa Chinese-modern,
  gunakan **Noto Serif SC** atau **ZCOOL XiaoWei**.

Pengecualian: file branding fisik (PNG logo, favicon SVG) sudah memuat
wordmark tergambar sebagai vektor — jangan menimpa dengan teks.

## Suara Merek (Voice & Tone)

> Belum ditetapkan. Saran awal:

- **Kalem, hangat, bersahaja** untuk konten marketing.
- **Faktual, presisi** untuk komunikasi ERP internal (laporan, struk, slip gaji).
- Hindari emoji di komunikasi formal (surat peringatan, slip gaji, PO, faktur).

## Aplikasi pada Sistem ERP

- Login screen ERP & site: logo besar di tengah + tagline opsional, latar `brand.cream` dengan radial spotlight halus.
- Header dashboard ERP: logo kecil + nama "Aroadri Tea — ERP".
- Header website publik: logo + menu marketing dengan motif gelombang tipis di bawah hero (opacity 8-12%).
- Favicon: versi sederhana logo (huruf A merah di transparan / square 32×32, 192×192, 512×512).
- Cetak struk POS: logo monokrom (hitam) di header struk; warna merah dicetak abu-abu pada printer thermal.
- Slip gaji: logo monokrom + nama legal "PT. Gandha Hill Catering Management Indonesia".
- Customer-facing display di toko: latar gelap `brand.ink` dengan angka pickup besar `brand.gold`.

## Panduan UI untuk AI Developer (Anti-Generic)

> **WAJIB DIBACA** sebelum menulis komponen UI. Detail teknis di SYSTEM-DESIGN §36 dan ADR-0006.

### Aturan Mutlak
1. **Token only**: warna dipanggil via token `brand.*` di Tailwind. **Dilarang** hardcoded hex / `bg-white` / `text-zinc-*` / `border-slate-*` di `apps/*`. Lint rule akan menolak ini.
2. **Wrap shadcn**: gunakan `packages/ui/<component>` yang sudah di-override brand. **Jangan** import shadcn raw langsung dari `apps/*`.
3. **Spinner kustom**: 3 titik pulsing horizontal `brand.red` (mengingatkan butir teh / bubble). Bukan border-circle berputar generic.
4. **Shadow hangat**: `shadow-soft` / `shadow-pop` (sepia-tone), bukan biru-abu khas Material.
5. **Stroke ikon 1.5px**, bukan default Lucide 2px.
6. **Transition** `cubic-bezier(0.16, 1, 0.3, 1)` durasi 200-280ms — smooth ease-out spring.
7. **Focus ring ganda** (inner cream + outer red), bukan default biru OS.
8. **Empty state**: SVG ilustrasi kustom (gunung + awan minimalis monokrom), bukan text-only.

### Anti-Pattern (Yang Wajib Dihindari)
| ❌ Hindari | ✅ Pakai |
|---|---|
| `bg-white border-zinc-200 shadow-sm` | `bg-card border-brand-cream-2 shadow-soft` |
| `text-slate-600` | `text-brand-ink-2` |
| `bg-blue-500 hover:bg-blue-600` | `bg-brand-red hover:bg-brand-red-dark` |
| Border circle spinner | 3 titik pulsing brand-red |
| Default 2px Lucide stroke | 1.5px stroke |
| Generic empty illustration | SVG gunung/awan kustom |
| Gradient blob hero | Solid brand color + radial spotlight |
| Material box-shadow biru-abu | Warm sepia shadow-soft |
| Default `rounded-md` | Brand `rounded-md` (10px) — sedikit lebih lembut |

### Inspirasi Style
- **Linear** — modern minimal dengan motion halus
- **Stripe** — premium, kalem, tipografi rapi
- **Apple Pay receipt** — warm, premium, fokus angka
- **Hakkasan menu** — Chinese-traditional dengan twist modern
- **Aman Resorts** — premium dengan rasa "kerajinan tangan"

### PR Checklist UI
Setiap PR yang menambah/mengubah UI **wajib** lampirkan screenshot 5 halaman utama:
1. Login
2. Dashboard utama
3. POS order entry
4. Journal entry editor
5. List produk

Bila tampak generic AI dashboard → refactor sebelum merge.

### Visual Anti-Generic Test
Tanya pada diri (atau user): "kalau halaman ini ditampilkan tanpa logo Aroadri, apakah orang bisa langsung tahu ini bukan template SaaS umum?" Jika tidak, refactor.

## Larangan Visual

- ❌ Jangan rotasi / distorsi logo.
- ❌ Jangan ganti warna logo selain merah resmi atau monokrom hitam.
- ❌ Jangan tambah bayangan / gradasi pada logo asli.
- ❌ Jangan letakkan logo di latar yang membuat kontras < 4.5:1.

## File yang Harus Disimpan di Folder Ini

```
brand-assets/
├── BRAND.md                  ← file ini
├── logo-primary.png          ← logo utama (yang user kirim)
├── logo-monochrome.png       ← versi hitam-putih untuk printer thermal
├── logo-favicon.svg          ← favicon
├── (kelak) brand-book.pdf    ← brand book resmi setelah dibuat
└── (kelak) photography/      ← foto produk untuk website
```

## Tindak Lanjut

- [ ] User upload file PNG resmi `logo-primary.png` (transparan) ke folder ini
- [ ] Buat `logo-monochrome.png` untuk struk thermal
- [ ] Buat `logo-favicon.svg` (32×32 dan 192×192)
- [ ] Konfirmasi palet warna resmi dengan brand designer
- [ ] Konfirmasi tipografi resmi
