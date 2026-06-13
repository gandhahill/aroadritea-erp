# ADR-0019: `groupRole` Column on `product_modifier_groups`

- **Status**: Accepted
- **Tanggal**: 2026-06-13
- **Pengambil keputusan**: Claude Sonnet 4.6 (per otorisasi Lintang untuk audit T-0299, item G1)
- **Konteks bisnis**: SOURCE-OF-TRUTH §3 (POS/Restaurant Operations) — setiap produk minuman punya pilihan level gula, level es, dan topping.
- **Konteks teknis**: SYSTEM-DESIGN §21.4 (POS), §33 (Naixer KDS QR integration); `docs/benchmark/fnb-erp-gap-analysis.md` Finding 1 (G1).

## Konteks

Audit T-0299 (Finding 1) menemukan bahwa modifier sugar/ice/topping di Aroadri Tea **tidak pernah benar-benar dipakai oleh kasir**:

- Schema generik (`packages/db/schema/inventory.ts:196-259`) sudah lengkap dan baik: `product_modifier_groups` (nama terlokalisasi, `selectionType: 'single'|'multiple'`, `isRequired`, `maxSelections`), `product_modifier_options` (nama, `extraPrice`, `linkedProductId` untuk BOM), `product_modifier_links` (many-to-many produk↔grup). Seed (`packages/db/seed/menu.ts:324-365`) sudah membuat 3 grup nyata: "Level Gula" (`modgrp-sugar-level`, single), "Level Es" (`modgrp-ice-level`, single), "Topping" (`modgrp-topping`, multiple, maxSelections 4) — semuanya terhubung ke setiap produk teh.
- TAPI `pos/product-search.tsx`'s `handleAddProduct()` tidak pernah membaca grup-grup ini dan tidak pernah set `modifierJson` pada `CartLine` — tidak ada picker UI sama sekali.
- `fetchMasterDataRaw()` (`pos/actions.ts:519-621`) hanya mengambil `product_modifier_options` secara flat (`category: m.groupId`) — tanpa grup, tanpa link produk — payload offline-sync pun tidak cukup untuk menggerakkan picker.
- `salesOrderLines.modifierJson` (`packages/db/schema/pos.ts:325-329`) bertipe `$type<{ sugar?: string; ice?: string; toppings?: Array<{name,price}> }>()` — sebuah **objek hardcoded** dengan key Bahasa Inggris `sugar`/`ice`/`toppings`.
- `kds-service.ts`'s `buildProductSummary()` (baris 407-429) membaca `line.modifierJson.sugar/.ice/.toppings` sesuai shape objek di atas — cocok untuk tampilan KDS staff board, tapi tidak generik.
- **Inkonsistensi laten kedua**: `create-sale.ts`'s `normalizeNaixerModifiers()` (baris 403-412) justru mengharapkan `modifierJson` berbentuk **ARRAY** `Array<{ kind: string; optionId: string }>` untuk dipetakan ke `naixer_modifier_codes` (QR Naixer). Shape objek (`{sugar,ice,toppings}`) dan shape array (`{kind,optionId}[]`) **tidak kompatibel** — karena `modifierJson` belum pernah ditulis oleh UI manapun, inkonsistensi ini belum pernah memicu bug, tapi picker apa pun yang naif akan memilih salah satu shape dan diam-diam merusak konsumen yang lain.
- `naixer_modifier_codes.modifierKind` (`packages/db/schema/kitchen.ts:92`) sudah punya vocabulary per-OPSI: `'size' | 'ice' | 'sugar' | 'topping' | 'cup' | 'other'`, dipakai untuk lookup kode QR Naixer per `modifierOptionId`.

**Masalah inti**: tidak ada cara generik untuk picker UI, KDS, label printing, dan Naixer QR semuanya membaca *peran* sebuah grup modifier ("ini grup level gula", "ini grup topping") tanpa menebak dari `name.en` (string-matching yang rapuh, rusak begitu Lintang mengganti nama grup).

## Keputusan

Tambahkan kolom `groupRole` pada `product_modifier_groups`:

```ts
groupRole: text('group_role').notNull().default('custom'),
// 'sugar' | 'ice' | 'topping' | 'size' | 'cup' | 'other' | 'custom'
```

Vocabulary disamakan dengan `naixer_modifier_codes.modifierKind` (`size|ice|sugar|topping|cup|other`) plus `'custom'` untuk grup yang tidak masuk kategori standar mana pun (mis. grup modifier khusus dessert di masa depan).

Seed (`packages/db/seed/menu.ts`) di-update: `modgrp-sugar-level` → `groupRole: 'sugar'`, `modgrp-ice-level` → `groupRole: 'ice'`, `modgrp-topping` → `groupRole: 'topping'`.

**Kanonikalisasi `modifierJson`** (akan dipakai oleh picker UI yang dibangun setelah ADR ini, lihat checkpoint T-0299 "Next step" untuk G1): `salesOrderLines.modifierJson` menjadi sebuah **array** entri:

```ts
type ModifierSelection = {
  groupId: string;
  groupRole: 'sugar' | 'ice' | 'topping' | 'size' | 'cup' | 'other' | 'custom';
  groupName: string; // localized display name, snapshot di waktu order
  optionId: string;
  optionName: string; // localized display name, snapshot di waktu order
  extraPrice: string; // bigint string, snapshot di waktu order
};
type ModifierJson = ModifierSelection[];
```

Shape array ini menggantikan KEDUA shape lama (`{sugar,ice,toppings}` objek DAN `{kind,optionId}[]` di `normalizeNaixerModifiers`) dengan satu shape kanonik yang membawa semua informasi yang dibutuhkan konsumen hilir:

- **`kds-service.ts` `buildProductSummary`**: group selections by `groupRole`, rekonstruksi string tampilan "Sugar: X | Ice: Y | Toppings: A, B" menggunakan `groupRole` (bukan menebak key objek).
- **`normalizeNaixerModifiers`**: `groupRole` → `kind` (pemetaan langsung 1:1, karena vocabulary `groupRole` adalah superset dari `modifierKind`), `optionId` tetap — jadi cuma penggantian nama field, bukan perubahan shape.
- **Label printing** (`apps/web/app/(print)/pos/print/label/[orderId]/page.tsx`, demo label client): baca `optionName`/`groupRole` langsung dari tiap entri array, dikelompokkan per `groupRole` untuk tampilan.
- **`salesOrderLines.modifierJson` `$type`**: diupdate ke `ModifierSelection[]`. Tidak perlu migrasi data — karena picker belum pernah ada, kolom ini SELALU `null`/kosong di semua baris yang ada (Finding 1).

## Alternatif yang Dipertimbangkan

1. **Pertahankan shape objek `{sugar,ice,toppings}`, infer `groupRole` ad-hoc di picker tanpa kolom schema** — ditolak: tidak memperbaiki mismatch array-vs-objek dengan `normalizeNaixerModifiers`, dan hardcode key Bahasa Inggris `sugar`/`ice`/`toppings` selamanya meski `name` grup sudah terlokalisasi `{id,en,zh}` — direktur berbahasa Mandarin yang membuat grup custom "双层珍珠" tidak akan tampil benar.
2. **Infer `groupRole` dari string-matching `name.en`** (`"sugar"`, `"ice"`, dst.) saat picker dijalankan — ditolak: rapuh, rusak begitu Lintang mengganti nama grup, dan tidak persisten (setiap picker harus menebak ulang).
3. **Tambahkan `groupRole` ke `product_modifier_options` (bukan groups)** — ditolak: peran adalah properti GRUP ("Level Gula" = grup `sugar`), bukan tiap opsi; menambahkannya per-opsi berarti redundansi (semua opsi dalam satu grup akan punya role yang sama).

## Konsekuensi

- **Positif**: satu shape `modifierJson` kanonik dikonsumsi konsisten oleh picker, KDS, label printing, Naixer QR, dan refund.
- **Positif**: `groupRole` opsional/default (`'custom'`) — grup yang sudah ada (3 grup seed) langsung diberi role yang benar via update seed; grup baru yang dibuat lewat UI (jika/ketika CRUD modifier-group UI dibangun) default ke `'custom'` dan bisa diubah Lintang kapan saja tanpa migrasi tambahan.
- **Trade-off**: `salesOrderLines.modifierJson` `$type` berubah shape (objek → array) — breaking change untuk tipe TS, TAPI karena Finding 1 memastikan kolom ini SELALU kosong di data yang ada, tidak ada migrasi data nyata yang diperlukan.
- **Trade-off**: `kds-service.ts`, label printing (2 lokasi), demo label client, dan `create-sale.ts` (`normalizeNaixerModifiers`) semuanya perlu diupdate membaca shape baru — multi-file tapi mekanis, dikerjakan sebagai bagian dari implementasi picker G1 (lihat checkpoint T-0299).
- **Netral**: `naixer_modifier_codes.modifierKind` (per-opsi, dipakai untuk lookup kode QR) tetap ada sebagaimana adanya — `groupRole` adalah konsep paralel level-grup yang nilainya SAMA secara vocabulary, tapi tidak menggantikan `modifierKind` (satu opsi tetap bisa punya kode Naixer berbeda dari role grup induknya bila diperlukan kasus khusus).

## Referensi

- `docs/benchmark/fnb-erp-gap-analysis.md` — Finding 1, Part D (G1).
- `docs/checkpoints/T-0299-fnb-erp-gap-audit.checkpoint.md` — "Decisions" section (rencana awal `groupRole`), "Next step" (rencana implementasi G1).
- ADR-0007 (Naixer KDS QR integration) — konteks `naixer_modifier_codes`.
