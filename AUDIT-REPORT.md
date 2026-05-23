# Laporan Audit ERP Aroadri Tea (Fase 1: Functional & Integrity)

Sebagai *principal engineer* independen, saya telah melakukan *deep dive* ke dalam modul Akuntansi dan POS berdasarkan `SYSTEM-DESIGN.md`. Mengingat batasan driver database saat ini (Neon HTTP, *no native transactions*), telah ditemukan **4 cacat kritikal (BLOCKER)** yang dapat merusak integritas finansial dan sinkronisasi POS di lingkungan produksi.

---

## 1. Accounting: *Sequence Generation Race Condition*
**Lokasi**: `packages/services/src/accounting/number-generator.ts`
**Deskripsi**: Fungsi `generateJournalNumber` menggunakan query `SELECT COUNT(*)` untuk menentukan nomor urut dokumen berikutnya. Tanpa *transaction lock*, jika ada dua *request* pembuatan jurnal yang masuk bersamaan (misal sinkronisasi POS paralel), keduanya bisa mendapatkan hasil `count` yang sama dan menggunakan nomor JE yang sama, berpotensi memicu *Unique Constraint Violation* atau nomor ganda jika *constraint* lemah.
**Dampak**: Kegagalan *posting* secara acak di bawah *high concurrency* (terutama saat offline sync massal dari POS).
**Rekomendasi**: 
- **[AUTO-FIX]**: Ubah mekanisme menjadi tabel *sequence* eksplisit dengan pola *Claim-First* (Drizzle `UPDATE ... RETURNING`), atau setidaknya gunakan `ORDER BY number DESC LIMIT 1` dan manipulasi string ketimbang mengandalkan `COUNT(*)` yang rentan.

## 2. Accounting: Cacat Logika *Double-Reversal* pada Jurnal
**Lokasi**: `packages/services/src/accounting/reverse-journal.ts` & `reporting/trial-balance.ts`
**Deskripsi**: Saat fungsi *reverse* dipanggil, sistem melakukan **dua** tindakan sekaligus:
1. Mengubah status *journal entry* asli menjadi `reversed`. (Ini membuat jurnal asli **dikecualikan** dari perhitungan *Trial Balance* karena query mensyaratkan `status = 'posted'`).
2. Membuat *journal entry* baru dengan status `posted` yang memiliki nilai *debit* dan *kredit* yang dibalik dari jurnal aslinya.
Karena jurnal asli sudah dikecualikan dari perhitungan, nilai awalnya sudah dinetralkan. Jurnal pembalik (*reversal*) baru justru akan **menambahkan kembali** kebalikan saldo tersebut, menghasilkan efek *Double Reversal* (saldo akhir bukan 0, melainkan -1x dari nominal asli).
**Dampak**: Laporan Neraca (Balance Sheet) dan Laba/Rugi (Profit/Loss) akan kacau dan tidak seimbang setiap kali terjadi *Void* penjualan atau *Reversal* akuntansi.
**Rekomendasi**: 
- **[AUTO-FIX]**: Pertahankan prinsip *soft-reversal*. Jurnal asli **harus tetap memiliki status 'posted'** (jangan ubah statusnya menjadi 'reversed', atau buat agar 'reversed' tetap dihitung di *Trial Balance*). Dengan begitu, jurnal asli + jurnal pembalik = 0 secara matematis.

## 3. POS: *Idempotency Trap* Mencegah *Retry Sync*
**Lokasi**: `packages/services/src/pos/create-sale.ts`
**Deskripsi**: Apabila pembuatan *Sales Order* gagal di tengah jalan, *idempotency record* tetap tersimpan dengan `responseStatus: 500`. Sayangnya, di awal fungsi `createSale`, terdapat pengecekan kaku yang langsung mengembalikan error `AppError.conflict('pos.createSale.idempotencyInProgress')` jika rekam *idempotency* sudah ada, **tanpa memeriksa apakah proses sebelumnya itu gagal (500)**. 
**Dampak**: Jika koneksi jaringan buruk dan terjadi *error* pada sinkronisasi *offline* pertama, pesanan itu akan selamanya diblokir saat mencoba di-*retry* oleh aplikasi PWA (nyangkut di Outbox Kasir).
**Rekomendasi**: 
- **[AUTO-FIX]**: Ubah pengecekan *idempotency*. Jika rekam jejak menunjukkan status 5xx, izinkan proses berlanjut (*retry* order). Hanya tolak order jika status masih '102 Processing'.

## 4. POS & Accounting: Integritas *Partial Insert* (*Orphan Sales Order*)
**Lokasi**: `packages/services/src/pos/create-sale.ts`
**Deskripsi**: Tanpa transaksi DB *native*, fungsi `createSale` sangat rentan terputus di tengah operasi. Ia melakukan:
1. `insert` order, lines, payments (berhasil)
2. `createJournal` (gagal, misal karena error validasi atau putus koneksi)
Jika langkah 2 gagal, blok `catch` melakukan pembatalan (*rollback*) pemotongan stok bahan baku, **TETAPI TIDAK menghapus order yang telanjur masuk di langkah 1**. 
Lebih fatalnya lagi, saat kasir me-*retry* sync, *endpoint* `/api/sync/pos/route.ts` justru akan memeriksa tabel `salesOrders` menggunakan *idempotencyKey* dan menjawab HTTP 200 `already_synced` karena mengira transaksi sukses.
**Dampak**: Uang penjualan "masuk" di laporan shift POS, namun **jurnal akuntansi kosong** dan **stok bahan baku utuh**. Terjadi selisih besar antara kas riil dengan catatan keuangan. (Ini *BLOCKER* paling kritis).
**Rekomendasi**: 
- **[NEED-DECISION / AUTO-FIX]**: Solusi terkuat adalah implementasi *Compensation Pattern*: jika `createJournal` gagal, tambahkan logika `await db.delete(salesOrders)` (dan turunannya) untuk melakukan *rollback* manual di DB, sehingga *retry* selanjutnya dapat bekerja murni dari awal.

---

**STATUS: WAITING_FOR_USER_DECISION**
Mohon tinjau ke-4 celah di atas. Jika Anda setuju dengan rekomendasi *[AUTO-FIX]*, saya akan segera mengimplementasikan perbaikannya ke dalam modul Akuntansi dan POS secara bertahap.
