import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Docs - Aroadri ERP',
};

const GUIDES = [
  {
    title: 'Login, bahasa, dan logout',
    body: 'Pilih bahasa di halaman login sebelum masuk. Setelah masuk, tombol Logout ada di header kanan. Jika akun ditolak, minta director mengecek role dan status user.',
  },
  {
    title: 'POS dan member',
    body: 'Kasir menanyakan apakah pelanggan punya member. Jika ada, masukkan nomor telepon, cocokkan nama yang muncul, lalu lanjutkan transaksi. POS demo hanya untuk latihan dan tidak disinkronkan ke server.',
  },
  {
    title: 'Produk & Menu',
    body: 'Master produk, kategori, gambar, harga default, dan varian Regular/Large atau Hot/Cold dikelola dari Inventory -> Produk & Menu. Setelah data produk aktif, POS dan public menu dapat memakai data yang sama.',
  },
  {
    title: 'Inventory dan stock opname',
    body: 'Gunakan Stock Opname untuk membuat sesi hitung stok, isi hasil hitung per item, lalu submit. Varians Persediaan dipakai untuk mengecek selisih stok berdasarkan lokasi.',
  },
  {
    title: 'Accounting',
    body: 'Jurnal wajib balance debit dan kredit, memakai periode akuntansi yang masih open, dan location_id yang benar. Tutup periode hanya setelah seluruh transaksi bulan tersebut selesai direview.',
  },
  {
    title: 'Tax',
    body: 'PBJT/PB1 retail disiapkan sebagai inclusive tax. Tax Rates menyimpan rate dan akun posting. Tax Rules menentukan kapan rule diterapkan berdasarkan channel, segmen, kategori, atau default global.',
  },
  {
    title: 'HR dan payroll',
    body: 'Data karyawan dibuat dari HR -> Employees -> Add Employee. Data tersebut dipakai untuk attendance, cuti, payroll, dan surat peringatan.',
  },
  {
    title: 'Permissions',
    body: 'Permissions berada di Settings -> Permissions. Perubahan role disimpan ke database dan cache permission dibersihkan. Hindari menghapus wildcard director dari database kecuali ada akun director lain yang sudah diuji.',
  },
  {
    title: 'Naixer KDS',
    body: 'Mapping kode Naixer berada di Settings -> Naixer KDS. Label stiker mendukung 6x4 cm dan 4x3 cm landscape; receipt width diatur fleksibel per printer lewat POS settings.',
  },
  {
    title: 'Troubleshooting cepat',
    body: 'Jika halaman error, catat URL, jam kejadian, akun, action terakhir, dan digest jika ada. Setelah itu cek PM2 logs, health endpoint, session, permission role, dan data yang dipakai halaman tersebut.',
  },
];

const CHECKLIST = [
  'Data master tidak diedit langsung di database jika sudah ada UI.',
  'Jangan deploy sebelum typecheck, test modul terkait, build, PM2 reload, healthcheck, dan smoke test selesai.',
  'Untuk bug produksi, cari root cause dari log terlebih dahulu, lalu buat regression test bila memungkinkan.',
  'Setiap perubahan permission harus diuji dengan akun role terkait, bukan hanya akun director.',
  'Jangan mengubah periode akuntansi closed tanpa proses reopening yang disetujui.',
];

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-red/80">
            Source of Truth
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-ink">Docs ERP</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-ink-3">
            Panduan operasional untuk user Aroadri Tea. Halaman ini menjadi pintu pertama saat user
            bingung cara memakai fitur, memahami alur kerja, atau menangani error.
          </p>
        </div>
        <Link
          href="/settings/permissions"
          className="rounded-lg border border-brand-cream-3 bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          Cek permissions
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((guide) => (
          <article
            key={guide.title}
            className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-brand-ink">{guide.title}</h2>
            <p className="mt-3 text-sm leading-6 text-brand-ink-3">{guide.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-ink">Checklist sebelum operasional</h2>
        <div className="mt-4 divide-y divide-brand-cream-3">
          {CHECKLIST.map((item) => (
            <div key={item} className="flex gap-3 py-3 text-sm text-brand-ink-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-brand-red" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
