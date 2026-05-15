import type { AppLocale } from '@/i18n/config';

export type QuickPath = {
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
};

export type GuideSection = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  steps: string[];
  checks: string[];
  links?: Array<{ label: string; href: string }>;
};

export type DocsContent = {
  badge: string;
  title: string;
  subtitle: string;
  tocTitle: string;
  quickTitle: string;
  quickPaths: QuickPath[];
  sections: GuideSection[];
  assessorTitle: string;
  assessorIntro: string;
  assessorItems: Array<{ standard: string; focus: string; evidence: string }>;
  supportTitle: string;
  supportSteps: string[];
};

export const DOCS_CONTENT: Record<AppLocale, DocsContent> = {
  id: {
    badge: 'Panduan Operasional',
    title: 'Docs ERP Aroadri Tea',
    subtitle:
      'Pusat petunjuk penggunaan ERP untuk kasir, admin outlet, finance, HR, dan director. Gunakan halaman ini saat memulai kerja, menjalankan proses harian, mengecek alur approval, atau menelusuri error.',
    tocTitle: 'Daftar isi',
    quickTitle: 'Jalur cepat berdasarkan peran',
    quickPaths: [
      {
        title: 'Kasir outlet',
        description:
          'Mulai dari login, buka shift, transaksi POS, member, pembayaran, sampai tutup shift.',
        links: [
          { label: 'Buka POS', href: '/pos' },
          { label: 'Mode latihan', href: '/pos/demo' },
          { label: 'Panduan POS', href: '#pos-member' },
        ],
      },
      {
        title: 'Admin menu & stok',
        description: 'Kelola produk, harga, varian, topping, stock opname, dan selisih persediaan.',
        links: [
          { label: 'Produk & Menu', href: '/inventory/products' },
          { label: 'Stock Opname', href: '/inventory/opname' },
          { label: 'Panduan Inventaris', href: '#inventory' },
        ],
      },
      {
        title: 'Finance & director',
        description:
          'Pantau jurnal, periode akuntansi, pajak, approval, permission, dan audit operasional.',
        links: [
          { label: 'Jurnal', href: '/accounting/journals' },
          { label: 'Permissions', href: '/settings/permissions' },
          { label: 'Workflow', href: '#workflow' },
        ],
      },
    ],
    sections: [
      {
        id: 'login',
        eyebrow: 'Akses',
        title: 'Login, bahasa, akun, dan logout',
        summary:
          'Gunakan bahasa yang tepat sebelum bekerja agar label dan instruksi sesuai dengan user. Akun yang dipakai menentukan lokasi, role, dan permission yang boleh diakses.',
        steps: [
          'Buka halaman login ERP.',
          'Pilih bahasa di kolom bahasa sebelum memasukkan email dan kata sandi.',
          'Masuk dengan akun staff yang diberikan oleh director atau administrator.',
          'Cek nama akun di kanan atas. Jika nama tidak sesuai, hentikan transaksi dan laporkan sebelum melanjutkan pekerjaan.',
          'Jika selesai bekerja, tekan Logout di kanan atas. Jangan hanya menutup tab browser di perangkat bersama.',
        ],
        checks: [
          'Akun tidak boleh dipakai bergantian antar karyawan.',
          'Jika akses menu hilang, cek role di Settings > Permissions.',
          'Jika akun suspended atau password salah, minta administrator memperbaiki akun, bukan membuat transaksi memakai akun orang lain.',
        ],
        links: [
          { label: 'Login', href: '/login' },
          { label: 'Permissions', href: '/settings/permissions' },
        ],
      },
      {
        id: 'pos-member',
        eyebrow: 'Kasir',
        title: 'POS, member, pembayaran, dan shift',
        summary:
          'POS adalah modul paling kritis untuk outlet. Semua transaksi harus dimulai dari shift yang benar, produk yang benar, member yang dikonfirmasi, dan pembayaran yang cocok dengan channel.',
        steps: [
          'Masuk ke POS produksi dari menu POS > Kasir POS.',
          'Buka shift dan isi kas awal sesuai uang fisik di laci kas.',
          'Saat pelanggan memesan, tanyakan: "Apakah ada member?"',
          'Jika ada member, masukkan nomor telepon, tunggu data muncul, lalu konfirmasi nama: "Atas nama ...?"',
          'Jika pelanggan mengonfirmasi, gunakan member tersebut. Jika bukan, lepas member dan lanjutkan sebagai walk-in atau arahkan ke pendaftaran member.',
          'Tambahkan produk, ukuran, suhu, gula, es, dan topping sesuai pesanan. Pilihan gula harus mencakup normal sugar, less sugar, dan no sugar. Pilihan es harus mencakup normal ice, less ice, dan no ice bila produk mendukung.',
          'Pilih channel penjualan yang benar: dine in, QRIS, kartu, atau delivery aggregator.',
          'Proses pembayaran. Untuk non-tunai, nilai pembayaran harus sesuai tagihan; gunakan tunai bila ada kembalian.',
          'Sebelum tutup shift, cocokkan kas sistem dengan kas fisik dan catat selisih bila ada.',
        ],
        checks: [
          'Jangan memakai POS Demo untuk transaksi nyata.',
          'Jika offline, lanjutkan transaksi hanya bila POS menampilkan antrian sync dan segera cek status sinkron setelah koneksi kembali.',
          'Batalkan/refund transaksi hanya dengan alasan yang jelas, karena akan masuk audit trail.',
        ],
        links: [
          { label: 'POS Produksi', href: '/pos' },
          { label: 'POS Demo', href: '/pos/demo' },
          { label: 'Pengaturan POS', href: '/settings/pos' },
        ],
      },
      {
        id: 'products',
        eyebrow: 'Master data',
        title: 'Produk, kategori, varian, harga, dan gambar menu',
        summary:
          'Data produk adalah sumber utama untuk POS dan menu. Perubahan menu operasional dilakukan dari ERP, bukan edit source code atau langsung di database.',
        steps: [
          'Buka Inventory > Produk & Menu.',
          'Buat atau pilih kategori seperti Fresh Milk Tea, Fresh Tea, Lemon Fresh Tea, Snow Cap Milk Tea, Dessert, atau Merchandise.',
          'Isi nama produk dalam bahasa Indonesia, English, dan Mandarin bila tersedia.',
          'Masukkan deskripsi singkat, gambar produk, status aktif, dan urutan tampil.',
          'Tambahkan varian seperti Regular, Large, Hot, atau Cold sesuai produk.',
          'Masukkan harga jual per varian dalam IDR tanpa desimal.',
          'Simpan, lalu cek produk muncul di daftar dan statusnya aktif.',
          'Uji di POS atau public menu setelah perubahan penting agar kasir tidak menjual data lama.',
        ],
        checks: [
          'Harga tidak boleh di-hardcode di source code.',
          'Produk nonaktif tidak boleh dipakai untuk transaksi baru.',
          'Gambar harus memakai foto produk per menu, bukan foto board yang diambil dari kamera HP.',
        ],
        links: [
          { label: 'Produk & Menu', href: '/inventory/products' },
          { label: 'Tambah Produk', href: '/inventory/products/new' },
        ],
      },
      {
        id: 'inventory',
        eyebrow: 'Inventaris',
        title: 'Stock opname dan selisih persediaan',
        summary:
          'Stock opname dipakai untuk mencocokkan stok sistem dengan stok fisik. Modul ini penting untuk kontrol kehilangan, bahan rusak, bahan kedaluwarsa, dan koreksi akuntansi.',
        steps: [
          'Buka Inventory > Stock Opname.',
          'Buat sesi opname untuk lokasi yang benar.',
          'Hitung fisik per item sesuai satuan yang dipakai sistem.',
          'Input hasil hitung per baris produk.',
          'Simpan progres bila hitungan belum selesai.',
          'Ajukan opname setelah semua baris selesai dihitung.',
          'Director atau role berwenang meninjau selisih dan menyetujui opname.',
          'Buka Varians Persediaan untuk melihat selisih per item dan tindakan lanjut.',
        ],
        checks: [
          'Stock opname global dilakukan bulanan; bahan teh dan lemon dicek lebih sering.',
          'Selisih besar harus punya alasan dan approval.',
          'Jangan mengubah hasil hitung setelah approval tanpa proses pembatalan atau koreksi yang tercatat.',
        ],
        links: [
          { label: 'Stock Opname', href: '/inventory/opname' },
          { label: 'Varians Persediaan', href: '/inventory/variance' },
        ],
      },
      {
        id: 'accounting-tax',
        eyebrow: 'Finance',
        title: 'Accounting, periode, jurnal, dan pajak',
        summary:
          'Finance menjaga agar setiap transaksi punya jejak akuntansi yang balance, periode yang benar, dan perlakuan pajak yang konsisten. Retail F&B memakai PBJT/PB1 inclusive sesuai konfigurasi pajak.',
        steps: [
          'Gunakan Chart of Accounts untuk melihat akun resmi perusahaan.',
          'Buka Jurnal untuk melihat transaksi yang sudah dibuat sistem atau manual.',
          'Saat membuat jurnal manual, isi tanggal posting, lokasi, deskripsi, dan baris debit/kredit.',
          'Pastikan total debit sama dengan total kredit sebelum posting.',
          'Cek Periode Akuntansi sebelum posting transaksi bulan berjalan.',
          'Jangan posting ke periode closed. Jika ada koreksi, lakukan prosedur reopening atau jurnal koreksi sesuai persetujuan director.',
          'Gunakan Tax Rates untuk melihat tarif pajak dan Tax Rules untuk aturan penerapan pajak.',
        ],
        checks: [
          'Total debit dan kredit wajib balance.',
          'PBJT/PB1 retail bersifat inclusive, bukan ditambahkan di atas harga display.',
          'Perubahan COA, tax rate, dan tax rule harus dilakukan lewat UI/migration yang tercatat.',
        ],
        links: [
          { label: 'Chart of Accounts', href: '/accounting/coa' },
          { label: 'Jurnal', href: '/accounting/journals' },
          { label: 'Buat Jurnal', href: '/accounting/journals/new' },
          { label: 'Tax Rules', href: '/tax/rules' },
        ],
      },
      {
        id: 'purchasing',
        eyebrow: 'Pembelian',
        title: 'Supplier dan purchase order',
        summary:
          'Purchasing membantu outlet mencatat rencana pembelian, supplier, dan dasar approval sebelum barang diterima. PO harus dibuat untuk kebutuhan pembelian yang perlu jejak kontrol.',
        steps: [
          'Buka Purchasing.',
          'Pastikan supplier sudah ada. Jika belum, buat supplier dengan nama dan kontak yang benar.',
          'Klik PO Baru.',
          'Pilih supplier, lokasi, tanggal, dan item pembelian.',
          'Periksa harga, jumlah, pajak, dan catatan pembelian.',
          'Simpan PO sebagai dasar permintaan pembelian.',
          'Jika approval aktif, PO akan mengikuti workflow yang berlaku untuk purchase order.',
        ],
        checks: [
          'Supplier fiktif atau sementara tidak boleh dipakai untuk pembelian rutin.',
          'PO bernilai besar harus melalui approval sesuai workflow.',
          'Perbedaan barang datang dengan PO harus dicatat sebelum stok ditambah.',
        ],
        links: [
          { label: 'Purchasing', href: '/purchasing' },
          { label: 'PO Baru', href: '/purchasing/po/new' },
          { label: 'Workflow Editor', href: '/settings/workflow-editor' },
        ],
      },
      {
        id: 'hr',
        eyebrow: 'SDM',
        title: 'Karyawan, attendance, cuti, payroll, dan surat peringatan',
        summary:
          'HR menyimpan data karyawan yang dipakai untuk attendance, kontrak, payroll, cuti, dan disciplinary record. Data pribadi harus dilihat dan diubah hanya oleh role yang berwenang.',
        steps: [
          'Buka HR > Employees untuk melihat daftar karyawan.',
          'Klik Add Employee untuk membuat data karyawan baru.',
          'Isi nama, email, telepon, posisi, lokasi kerja, tanggal mulai, dan data kontrak yang diperlukan.',
          'Karyawan melakukan presensi dari HR > Check In atau shortcut PWA di perangkat outlet. Pilih shift pagi 09:30-17:30 atau shift siang 14:30-22:30 sesuai jadwal.',
          'Presensi GPS membutuhkan koordinat lokasi yang sudah diisi administrator. Jika GPS belum disiapkan, gunakan QR check-in sesuai instruksi outlet.',
          'Attendance mencatat jam masuk, jam pulang, metode check-in, status telat, dan menit telat. Toleransi telat adalah 15 menit dari awal shift.',
          'Jatah telat adalah 3 kali per bulan. Telat berikutnya dikenai potongan Rp 50.000 per kejadian. Tidak hadir tanpa kabar dikenai potongan Rp 100.000 per kejadian.',
          'Jam istirahat shift pagi adalah 13:30-15:30 selama 1 jam. Shift siang istirahat 16:00-17:00 atau setelah 20:30; hindari istirahat 18:00-20:30 kecuali kebutuhan khusus seperti ibadah, sakit maag, atau menstruasi.',
          'Gunakan Leave untuk mengatur jenis cuti, memproses permintaan cuti, dan memastikan tukar libur atau cuti mendapat persetujuan atasan.',
          'Jalankan Payroll sesuai periode payroll, review komponen gaji, potongan telat/absen, BPJS, dan PPh 21 sebelum approval atau pembayaran.',
          'Gunakan Surat Peringatan untuk mencatat SP1/SP2/SP3 dengan tanggal kejadian dan alasan yang jelas.',
          'SOP pembukaan toko: seduh teh, buat creamer bila perlu, bersihkan meja/kursi/lantai, siram tanaman, rapikan bar dan pintu kaca, cek mesin, cek stok teh dan egg tart, lalu input mutasi stok bila ada pemakaian pagi.',
          'SOP penutupan toko: tutup order sekitar 22:00, mulai closing/cleaning solution sekitar 21:50, bersihkan mesin, wadah teh, pan oven, lantai, area bar, lalu buat laporan keuangan harian.',
        ],
        checks: [
          'Data KTP, NPWP, telepon, dan payroll termasuk data pribadi dan tidak boleh dibagikan sembarangan.',
          'Payroll tanggal 8 harus direview sebelum dibayar.',
          'Pembuatan produk wajib memakai gelas ukur/takaran/timbangan. Karyawan tidak boleh menakar dengan perasaan.',
          'Produk yang tidak sesuai standar tidak boleh disajikan kepada pelanggan.',
          'Area bar hanya untuk alat minum dan kain lap. HP, tumbler pribadi, dan barang non-pekerjaan tidak boleh berada di area bar.',
          'Karyawan wajib memakai apron, menjaga kebersihan diri, dan menjaga area kerja tetap kering serta rapi.',
          'Surat peringatan harus punya alasan, tanggal kejadian, dan status acknowledgement.',
        ],
        links: [
          { label: 'Employees', href: '/hr/employees' },
          { label: 'Add Employee', href: '/hr/employees/new' },
          { label: 'Check In', href: '/hr/checkin' },
          { label: 'Attendance', href: '/hr/attendance' },
          { label: 'Leave', href: '/hr/leave' },
          { label: 'Payroll', href: '/hr/payroll' },
        ],
      },
      {
        id: 'workflow',
        eyebrow: 'Governance',
        title: 'Workflow Editor: fungsi, contoh, dan cara pakai',
        summary:
          'Workflow Editor dipakai untuk mengatur siapa yang harus menyetujui proses tertentu tanpa mengubah source code. Contohnya PO besar, stock adjustment, reimbursement, cuti, payroll, atau jurnal manual tertentu.',
        steps: [
          'Buka Settings > Workflow Editor.',
          'Klik Create Workflow.',
          'Pilih modul yang akan diatur, misalnya purchase_order, leave_request, stock_adjustment, reimbursement_request, atau journal_entry.',
          'Isi nama workflow dalam beberapa bahasa agar tampil jelas untuk semua user.',
          'Tambahkan kondisi pemicu bila workflow hanya berlaku pada kasus tertentu, misalnya amount > 5000000 atau location = malioboro.',
          'Tambahkan langkah approval. Contoh sederhana: step 1 = director. Contoh bertingkat: step 1 = finance, step 2 = director.',
          'Atur prioritas. Jika beberapa workflow cocok, prioritas tertinggi yang dipakai.',
          'Simpan workflow.',
          'Uji dengan membuat transaksi contoh yang memenuhi kondisi, lalu cek apakah status berubah menjadi menunggu approval.',
          'Jika workflow salah, nonaktifkan atau ubah rule, lalu dokumentasikan perubahan agar user lain paham efeknya.',
        ],
        checks: [
          'Workflow bukan tempat menyimpan secret, password, atau URL teknis.',
          'Rule terlalu umum dapat membuat semua transaksi tertahan approval.',
          'Rule terlalu sempit dapat membuat transaksi penting lolos tanpa approval.',
          'Setiap perubahan workflow harus diuji memakai akun role pemohon dan akun approver.',
        ],
        links: [
          { label: 'Workflow Editor', href: '/settings/workflow-editor' },
          { label: 'Permissions', href: '/settings/permissions' },
        ],
      },
      {
        id: 'permissions',
        eyebrow: 'Security',
        title: 'Permission, role, dan audit akses',
        summary:
          'Permission menentukan menu dan aksi yang boleh dilakukan user. Pengaturan ini mendukung prinsip least privilege: user hanya mendapat akses yang diperlukan untuk pekerjaannya.',
        steps: [
          'Buka Settings > Permissions.',
          'Pilih role yang akan ditinjau.',
          'Cek permission read, create, update, approve, export, dan manage sesuai kebutuhan kerja.',
          'Simpan perubahan role.',
          'Minta user logout dan login ulang bila akses belum berubah.',
          'Uji minimal satu aksi penting dengan akun role tersebut.',
        ],
        checks: [
          'Jangan memberi wildcard access ke role operasional outlet.',
          'Director/admin boleh punya akses luas, tetapi tetap harus memakai akun personal.',
          'Review akses secara berkala saat ada karyawan pindah role atau resign.',
        ],
        links: [{ label: 'Permissions', href: '/settings/permissions' }],
      },
      {
        id: 'settings-support',
        eyebrow: 'Support',
        title: 'Pengaturan, notifikasi, job otomatis, dan troubleshooting',
        summary:
          'Pengaturan operasional dipakai agar ERP bisa menyesuaikan kebutuhan outlet tanpa edit source code. Jika terjadi error, catat bukti yang cukup supaya root cause bisa ditelusuri.',
        steps: [
          'Gunakan POS Settings untuk ukuran struk, posting akuntansi POS, channel, dan kebutuhan printer.',
          'Gunakan Naixer KDS untuk mapping QR dan format label KDS.',
          'Gunakan Notifications untuk penerima alert operasional.',
          'Gunakan Scheduled Jobs untuk jadwal backup, payroll, stock alert, dan revalidasi cache bila sudah dikonfigurasi.',
          'Saat error muncul, catat URL, waktu kejadian, akun, lokasi, langkah terakhir, dan digest/error message.',
          'Cek apakah user punya permission yang benar.',
          'Cek apakah data yang dibuka sudah ada dan aktif.',
          'Laporkan dengan bukti lengkap agar perbaikan tidak berdasarkan tebakan.',
        ],
        checks: [
          'Ukuran struk dan label harus disesuaikan dengan printer outlet.',
          'Label Naixer KDS mendukung 6x4 cm dan 4x3 cm landscape.',
          'Perubahan job otomatis harus diuji supaya tidak mengirim alert palsu atau melewatkan proses penting.',
        ],
        links: [
          { label: 'POS Settings', href: '/settings/pos' },
          { label: 'Naixer KDS', href: '/settings/integrations/naixer' },
          { label: 'Notifications', href: '/settings/notifications' },
          { label: 'Scheduled Jobs', href: '/settings/scheduled-jobs' },
        ],
      },
    ],
    assessorTitle: 'Kontrol assessor',
    assessorIntro:
      'Bagian ini menerjemahkan standar tata kelola menjadi kontrol praktis yang perlu terlihat di ERP dan rutinitas operasional.',
    assessorItems: [
      {
        standard: 'ISO/IEC 27001',
        focus: 'Akses, data pribadi, audit trail, dan keamanan sesi.',
        evidence:
          'Permission per role, akun personal, logout, data pribadi dibatasi, perubahan penting masuk audit.',
      },
      {
        standard: 'ISO 9001',
        focus: 'Konsistensi proses dan instruksi kerja.',
        evidence: 'Docs berisi langkah baku POS, inventory, finance, HR, dan troubleshooting.',
      },
      {
        standard: 'ISO/IEC 25010',
        focus: 'Usability, reliability, security, maintainability.',
        evidence:
          'Bahasa sesuai user, route tidak 404, healthcheck, build/typecheck, dan konfigurasi lewat UI.',
      },
      {
        standard: 'ISO 22301',
        focus: 'Kontinuitas operasional.',
        evidence:
          'POS offline, job backup, healthcheck, PM2 auto-restart, dan prosedur incident capture.',
      },
      {
        standard: 'ISO/IEC 38500, COBIT, ITIL',
        focus: 'Governance, value delivery, change control, dan incident management.',
        evidence:
          'Workflow approval, permission review, scheduled jobs, dan panduan pelaporan error.',
      },
    ],
    supportTitle: 'Format laporan bug yang benar',
    supportSteps: [
      'Tuliskan URL halaman dan waktu kejadian.',
      'Tuliskan akun yang dipakai dan lokasi kerja.',
      'Tuliskan langkah terakhir sebelum error.',
      'Lampirkan screenshot dan digest/error message bila ada.',
      'Sebutkan apakah error terjadi setelah deploy, setelah perubahan data, atau saat koneksi internet bermasalah.',
    ],
  },
  en: {
    badge: 'Operations Guide',
    title: 'Aroadri Tea ERP Docs',
    subtitle:
      'The user guide for cashiers, outlet admins, finance, HR, and directors. Use it to start work, run daily procedures, understand approvals, and report issues with enough evidence.',
    tocTitle: 'Contents',
    quickTitle: 'Quick paths by role',
    quickPaths: [
      {
        title: 'Outlet cashier',
        description: 'Login, open shift, run POS, attach members, take payment, and close shift.',
        links: [
          { label: 'Open POS', href: '/pos' },
          { label: 'Training mode', href: '/pos/demo' },
          { label: 'POS guide', href: '#pos-member' },
        ],
      },
      {
        title: 'Menu and stock admin',
        description:
          'Manage products, prices, variants, toppings, stock opname, and inventory variance.',
        links: [
          { label: 'Products & Menu', href: '/inventory/products' },
          { label: 'Stock Opname', href: '/inventory/opname' },
          { label: 'Inventory guide', href: '#inventory' },
        ],
      },
      {
        title: 'Finance and director',
        description:
          'Review journals, periods, tax, approvals, permissions, and operating controls.',
        links: [
          { label: 'Journals', href: '/accounting/journals' },
          { label: 'Permissions', href: '/settings/permissions' },
          { label: 'Workflow', href: '#workflow' },
        ],
      },
    ],
    sections: [
      {
        id: 'login',
        eyebrow: 'Access',
        title: 'Login, language, account, and logout',
        summary:
          'Choose the right language before working. The account determines location, role, and permissions.',
        steps: [
          'Open the ERP login page.',
          'Choose the language before entering email and password.',
          'Sign in with the staff account provided by the director or administrator.',
          'Check the account name in the top-right area. If it is wrong, stop and report it before continuing.',
          'When finished, click Logout. Do not only close the browser tab on shared devices.',
        ],
        checks: [
          'Do not share staff accounts.',
          'If menu access is missing, review the role in Settings > Permissions.',
          'If the account is suspended or the password is rejected, ask an administrator to fix the account.',
        ],
        links: [
          { label: 'Login', href: '/login' },
          { label: 'Permissions', href: '/settings/permissions' },
        ],
      },
      {
        id: 'pos-member',
        eyebrow: 'Cashier',
        title: 'POS, members, payments, and shift',
        summary:
          'POS is the most critical outlet module. Every sale must use the correct shift, product, member confirmation, channel, and payment method.',
        steps: [
          'Open POS from POS > POS Cashier.',
          'Open the shift and enter the physical opening cash.',
          'Ask the customer: "Any member?"',
          'If yes, enter the phone number, wait for the member data, then confirm the registered name.',
          'If confirmed, attach the member. If not, clear the member and continue as walk-in or ask the customer to register.',
          'Add product, size, temperature, sugar, ice, and toppings as ordered. Sugar should include normal sugar, less sugar, and no sugar. Ice should include normal ice, less ice, and no ice when supported.',
          'Choose the correct sales channel.',
          'Process the payment. Non-cash payments must match the bill; use cash when change is needed.',
          'Before closing shift, reconcile system cash with physical cash and record any variance.',
        ],
        checks: [
          'Do not use Demo POS for real transactions.',
          'If offline, continue only when pending sync is visible and verify sync after the network returns.',
          'Void/refund requires a clear reason because it is auditable.',
        ],
        links: [
          { label: 'Production POS', href: '/pos' },
          { label: 'Demo POS', href: '/pos/demo' },
          { label: 'POS Settings', href: '/settings/pos' },
        ],
      },
      {
        id: 'products',
        eyebrow: 'Master data',
        title: 'Products, categories, variants, prices, and images',
        summary:
          'Product data feeds POS and the public menu. Operational menu changes must be managed from ERP, not source code or direct database edits.',
        steps: [
          'Open Inventory > Products & Menu.',
          'Create or choose the category.',
          'Fill product names in Indonesian, English, and Chinese when available.',
          'Enter description, product image, active status, and display order.',
          'Add variants such as Regular, Large, Hot, or Cold.',
          'Enter selling price per variant in IDR.',
          'Save and confirm the product appears as active.',
          'Test important changes in POS or public menu.',
        ],
        checks: [
          'Prices must not be hardcoded in source code.',
          'Inactive products must not be sold in new transactions.',
          'Use per-menu product photos, not phone-camera photos of menu boards.',
        ],
        links: [
          { label: 'Products & Menu', href: '/inventory/products' },
          { label: 'Add Product', href: '/inventory/products/new' },
        ],
      },
      {
        id: 'inventory',
        eyebrow: 'Inventory',
        title: 'Stock opname and inventory variance',
        summary:
          'Stock opname reconciles system stock with physical stock and supports loss, damage, expiry, and accounting correction controls.',
        steps: [
          'Open Inventory > Stock Opname.',
          'Create a session for the correct location.',
          'Count physical stock per item using the system unit.',
          'Enter counted quantity for each product line.',
          'Save progress if counting is not complete.',
          'Submit opname after all lines are counted.',
          'A director or authorized role reviews and approves the variance.',
          'Open Inventory Variance to review differences and follow-up actions.',
        ],
        checks: [
          'Global stock opname is monthly; tea and lemon are checked more frequently.',
          'Large variances require reason and approval.',
          'Do not alter approved counts without a recorded correction process.',
        ],
        links: [
          { label: 'Stock Opname', href: '/inventory/opname' },
          { label: 'Inventory Variance', href: '/inventory/variance' },
        ],
      },
      {
        id: 'accounting-tax',
        eyebrow: 'Finance',
        title: 'Accounting, periods, journals, and tax',
        summary:
          'Finance keeps transactions balanced, posted to the right period, and taxed consistently. Retail F&B uses inclusive PBJT/PB1 according to tax configuration.',
        steps: [
          'Use Chart of Accounts to review official accounts.',
          'Open Journals to review system and manual entries.',
          'For manual journals, fill posting date, location, description, and debit/credit lines.',
          'Ensure total debit equals total credit before posting.',
          'Check Accounting Periods before posting current-month transactions.',
          'Do not post to closed periods.',
          'Use Tax Rates and Tax Rules to review active tax behavior.',
        ],
        checks: [
          'Debit and credit must balance.',
          'Retail PBJT/PB1 is inclusive, not added on top of display price.',
          'COA, tax rates, and tax rules must be changed through tracked UI or migration.',
        ],
        links: [
          { label: 'Chart of Accounts', href: '/accounting/coa' },
          { label: 'Journals', href: '/accounting/journals' },
          { label: 'Create Journal', href: '/accounting/journals/new' },
          { label: 'Tax Rules', href: '/tax/rules' },
        ],
      },
      {
        id: 'purchasing',
        eyebrow: 'Purchasing',
        title: 'Suppliers and purchase orders',
        summary:
          'Purchasing records supplier data and purchase requests before goods are received.',
        steps: [
          'Open Purchasing.',
          'Confirm the supplier exists. If not, create it with the correct name and contact.',
          'Click New PO.',
          'Choose supplier, location, date, and purchase items.',
          'Review price, quantity, tax, and notes.',
          'Save the PO as purchase request evidence.',
          'If approval is active, the PO follows the purchase order workflow.',
        ],
        checks: [
          'Do not use fake suppliers for routine purchases.',
          'High-value POs must follow approval workflow.',
          'Differences between received goods and PO must be recorded before stock is increased.',
        ],
        links: [
          { label: 'Purchasing', href: '/purchasing' },
          { label: 'New PO', href: '/purchasing/po/new' },
          { label: 'Workflow Editor', href: '/settings/workflow-editor' },
        ],
      },
      {
        id: 'hr',
        eyebrow: 'HR',
        title: 'Employees, attendance, leave, payroll, and warnings',
        summary:
          'HR stores employee data used for attendance, contracts, payroll, leave, and disciplinary records.',
        steps: [
          'Open HR > Employees.',
          'Click Add Employee to create a new employee record.',
          'Fill name, email, phone, position, work location, start date, and contract data.',
          'Employees check in from HR > Check In or a PWA shortcut on the outlet device. Choose morning shift 09:30-17:30 or evening shift 14:30-22:30 according to schedule.',
          'GPS attendance requires location coordinates configured by an administrator. If GPS is not prepared yet, use QR check-in according to outlet instructions.',
          'Attendance records check-in time, check-out time, method, late status, and late minutes. Late tolerance is 15 minutes from shift start.',
          'The monthly free late allowance is 3 events. Every late event after that deducts Rp 50,000. Absence without notice deducts Rp 100,000 per event.',
          'Morning break is 13:30-15:30 for 1 hour. Evening break is 16:00-17:00 or after 20:30; avoid 18:00-20:30 except for prayer, stomach illness, menstruation, or similar needs.',
          'Use Leave to maintain leave types, process requests, and make sure leave swaps or weekly-off changes have supervisor approval.',
          'Run Payroll for the correct period, then review salary components, late/absence deductions, BPJS, and PPh 21 before approval or payment.',
          'Use Disciplinary Actions for SP1/SP2/SP3 records with clear incident date and reason.',
          'Opening SOP: brew tea, make creamer when needed, clean tables/chairs/floor, water plants, tidy the bar and glass doors, check machines, check tea and egg tart stock, then input stock mutation for morning usage.',
          'Closing SOP: close orders around 22:00, start closing/cleaning around 21:50, clean machines, tea containers, oven pans, floor, and bar area, then prepare the daily finance report.',
        ],
        checks: [
          'KTP, NPWP, phone, and payroll data are personal data and must not be shared casually.',
          'Payroll on the 8th must be reviewed before payment.',
          'Product preparation must use measuring cups, measures, or scales. Employees may not estimate by feeling.',
          'Products below standard must not be served to customers.',
          'The bar area is only for drink tools and cloths. Phones, personal tumblers, and unrelated items are not allowed.',
          'Employees must wear aprons, maintain grooming, and keep the work area dry and tidy.',
          'Warnings require reason, incident date, and acknowledgement status.',
        ],
        links: [
          { label: 'Employees', href: '/hr/employees' },
          { label: 'Add Employee', href: '/hr/employees/new' },
          { label: 'Check In', href: '/hr/checkin' },
          { label: 'Attendance', href: '/hr/attendance' },
          { label: 'Leave', href: '/hr/leave' },
          { label: 'Payroll', href: '/hr/payroll' },
        ],
      },
      {
        id: 'workflow',
        eyebrow: 'Governance',
        title: 'Workflow Editor: purpose, examples, and steps',
        summary:
          'Workflow Editor controls who must approve certain processes without source-code changes. Examples include purchase orders, stock adjustments, reimbursement, leave, payroll, or manual journals.',
        steps: [
          'Open Settings > Workflow Editor.',
          'Click Create Workflow.',
          'Choose the module, such as purchase_order, leave_request, stock_adjustment, reimbursement_request, or journal_entry.',
          'Fill workflow names in multiple languages.',
          'Add trigger conditions when the workflow applies only to specific cases, for example amount > 5000000.',
          'Add approval steps. Simple example: step 1 = director. Tiered example: step 1 = finance, step 2 = director.',
          'Set priority. If several workflows match, the highest priority runs.',
          'Save the workflow.',
          'Test with a sample transaction that matches the condition.',
          'If the workflow is wrong, disable or edit it, then document the change.',
        ],
        checks: [
          'Workflow is not for storing secrets, passwords, or deployment URLs.',
          'A rule that is too broad can hold all transactions for approval.',
          'A rule that is too narrow can let important transactions bypass approval.',
          'Test workflow changes with both requester and approver accounts.',
        ],
        links: [
          { label: 'Workflow Editor', href: '/settings/workflow-editor' },
          { label: 'Permissions', href: '/settings/permissions' },
        ],
      },
      {
        id: 'permissions',
        eyebrow: 'Security',
        title: 'Permissions, roles, and access review',
        summary:
          'Permissions define menu access and allowed actions. Keep each role limited to what it needs.',
        steps: [
          'Open Settings > Permissions.',
          'Choose the role to review.',
          'Review read, create, update, approve, export, and manage permissions.',
          'Save role changes.',
          'Ask the user to log out and log in again if access has not changed.',
          'Test at least one important action using that role.',
        ],
        checks: [
          'Do not grant wildcard access to outlet operational roles.',
          'Director/admin may have broad access but must still use personal accounts.',
          'Review access when employees change roles or leave.',
        ],
        links: [{ label: 'Permissions', href: '/settings/permissions' }],
      },
      {
        id: 'settings-support',
        eyebrow: 'Support',
        title: 'Settings, notifications, jobs, and troubleshooting',
        summary:
          'Operational settings let ERP adapt to outlets without source-code changes. When errors happen, capture enough evidence before fixing.',
        steps: [
          'Use POS Settings for receipt width, POS accounting posting, channels, and printer needs.',
          'Use Naixer KDS for QR mapping and label formats.',
          'Use Notifications for operational alert recipients.',
          'Use Scheduled Jobs for backup, payroll, stock alert, and cache jobs when configured.',
          'When an error appears, record URL, time, account, location, last action, and digest/error message.',
          'Check whether the user has the correct permission.',
          'Check whether the required data exists and is active.',
          'Report with complete evidence so fixes do not rely on guesses.',
        ],
        checks: [
          'Receipt and label sizes must match the outlet printer.',
          'Naixer KDS labels support 6x4 cm and 4x3 cm landscape.',
          'Automated jobs must be tested to avoid false alerts or missed tasks.',
        ],
        links: [
          { label: 'POS Settings', href: '/settings/pos' },
          { label: 'Naixer KDS', href: '/settings/integrations/naixer' },
          { label: 'Notifications', href: '/settings/notifications' },
          { label: 'Scheduled Jobs', href: '/settings/scheduled-jobs' },
        ],
      },
    ],
    assessorTitle: 'Assessor controls',
    assessorIntro:
      'These controls translate governance standards into practical ERP behavior and operating routines.',
    assessorItems: [
      {
        standard: 'ISO/IEC 27001',
        focus: 'Access, personal data, audit trail, and session security.',
        evidence:
          'Role permissions, personal accounts, logout, limited personal-data access, and audited changes.',
      },
      {
        standard: 'ISO 9001',
        focus: 'Process consistency and work instructions.',
        evidence: 'Step-by-step docs for POS, inventory, finance, HR, and troubleshooting.',
      },
      {
        standard: 'ISO/IEC 25010',
        focus: 'Usability, reliability, security, and maintainability.',
        evidence:
          'Selected language is applied, routes do not 404, health checks pass, and settings are UI-managed.',
      },
      {
        standard: 'ISO 22301',
        focus: 'Operational continuity.',
        evidence:
          'Offline POS, backup jobs, health checks, PM2 restart, and incident capture procedures.',
      },
      {
        standard: 'ISO/IEC 38500, COBIT, ITIL',
        focus: 'Governance, value delivery, change control, and incident management.',
        evidence:
          'Approval workflows, access review, scheduled jobs, and issue reporting guidance.',
      },
    ],
    supportTitle: 'Correct bug report format',
    supportSteps: [
      'Write the page URL and incident time.',
      'Write the account and work location.',
      'Write the last action before the error.',
      'Attach screenshot and digest/error message if available.',
      'Mention whether it happened after deployment, data changes, or internet issues.',
    ],
  },
  zh: {
    badge: '操作指南',
    title: 'Aroadri Tea ERP 文档',
    subtitle:
      '面向收银员、门店管理员、财务、人事和董事的使用指南。用于开始工作、执行日常流程、理解审批和报告问题。',
    tocTitle: '目录',
    quickTitle: '按角色快速入口',
    quickPaths: [
      {
        title: '门店收银员',
        description: '登录、开班、POS收银、绑定会员、收款和收班。',
        links: [
          { label: '打开POS', href: '/pos' },
          { label: '训练模式', href: '/pos/demo' },
          { label: 'POS指南', href: '#pos-member' },
        ],
      },
      {
        title: '菜单和库存管理员',
        description: '管理产品、价格、规格、加料、库存盘点和库存差异。',
        links: [
          { label: '产品与菜单', href: '/inventory/products' },
          { label: '库存盘点', href: '/inventory/opname' },
          { label: '库存指南', href: '#inventory' },
        ],
      },
      {
        title: '财务和董事',
        description: '查看凭证、会计期间、税务、审批、权限和运营控制。',
        links: [
          { label: '凭证', href: '/accounting/journals' },
          { label: '权限', href: '/settings/permissions' },
          { label: '工作流', href: '#workflow' },
        ],
      },
    ],
    sections: [
      {
        id: 'login',
        eyebrow: '访问',
        title: '登录、语言、账户和退出',
        summary: '工作前请选择正确语言。账户决定用户的门店、角色和权限。',
        steps: [
          '打开ERP登录页面。',
          '输入邮箱和密码前先选择语言。',
          '使用董事或管理员提供的员工账户登录。',
          '查看右上角账户姓名。若姓名不正确，请先停止操作并报告。',
          '工作结束后点击退出，不要只关闭浏览器标签页。',
        ],
        checks: [
          '员工账户不得共用。',
          '如果菜单权限缺失，请在设置 > 权限中检查角色。',
          '如果账户被停用或密码错误，请让管理员修复账户。',
        ],
        links: [
          { label: '登录', href: '/login' },
          { label: '权限', href: '/settings/permissions' },
        ],
      },
      {
        id: 'pos-member',
        eyebrow: '收银',
        title: 'POS、会员、支付和班次',
        summary:
          'POS是门店最关键的模块。每笔销售都必须使用正确班次、产品、会员确认、渠道和支付方式。',
        steps: [
          '从 POS > POS收银 打开正式POS。',
          '开班并输入实际备用金。',
          '询问顾客：“有会员吗？”',
          '如果有，输入手机号，等待会员资料出现，然后确认姓名。',
          '顾客确认后绑定会员；若不是本人，移除会员并按普通顾客继续或引导注册。',
          '按订单添加产品、规格、冷热、糖度、冰量和加料。糖度应包含正常糖、少糖、无糖；冰量应包含正常冰、少冰、去冰。',
          '选择正确销售渠道。',
          '处理付款。非现金付款必须等于账单金额；需要找零时使用现金。',
          '收班前核对系统现金和实际现金，并记录差异。',
        ],
        checks: [
          '不要用Demo POS处理真实交易。',
          '离线时只有在系统显示待同步队列时才继续交易，并在网络恢复后确认同步。',
          '作废或退款必须填写明确原因，因为会进入审计记录。',
        ],
        links: [
          { label: '正式POS', href: '/pos' },
          { label: 'Demo POS', href: '/pos/demo' },
          { label: 'POS设置', href: '/settings/pos' },
        ],
      },
      {
        id: 'products',
        eyebrow: '主数据',
        title: '产品、分类、规格、价格和图片',
        summary: '产品数据供POS和公开菜单使用。菜单变更应在ERP中管理，不应修改源码或直接改数据库。',
        steps: [
          '打开 库存 > 产品与菜单。',
          '创建或选择分类。',
          '填写印尼语、英语和中文产品名。',
          '填写说明、产品图片、启用状态和显示顺序。',
          '添加Regular、Large、Hot或Cold等规格。',
          '填写每个规格的IDR售价。',
          '保存并确认产品已启用。',
          '重要变更后在POS或公开菜单中测试。',
        ],
        checks: [
          '价格不得硬编码在源码中。',
          '停用产品不得用于新交易。',
          '应使用每个菜单产品的真实照片，不使用手机拍摄的菜单板照片。',
        ],
        links: [
          { label: '产品与菜单', href: '/inventory/products' },
          { label: '新增产品', href: '/inventory/products/new' },
        ],
      },
      {
        id: 'inventory',
        eyebrow: '库存',
        title: '库存盘点和库存差异',
        summary: '库存盘点用于核对系统库存和实物库存，并支持损耗、损坏、过期和会计调整控制。',
        steps: [
          '打开 库存 > 库存盘点。',
          '为正确门店创建盘点会话。',
          '按系统单位逐项清点实物库存。',
          '为每个产品行输入实盘数量。',
          '如果未完成，先保存进度。',
          '所有行完成后提交盘点。',
          '董事或授权角色审核并批准差异。',
          '打开库存差异查看差异和后续处理。',
        ],
        checks: [
          '全局盘点每月执行；茶叶和柠檬更频繁检查。',
          '重大差异必须有原因和审批。',
          '已审批数据不得无记录修改。',
        ],
        links: [
          { label: '库存盘点', href: '/inventory/opname' },
          { label: '库存差异', href: '/inventory/variance' },
        ],
      },
      {
        id: 'accounting-tax',
        eyebrow: '财务',
        title: '会计、期间、凭证和税务',
        summary: '财务确保交易平衡、期间正确、税务一致。零售餐饮使用按配置的含税PBJT/PB1。',
        steps: [
          '使用科目表查看公司正式科目。',
          '打开凭证查看系统和手工凭证。',
          '创建手工凭证时填写过账日期、地点、说明和借贷行。',
          '过账前确认借方合计等于贷方合计。',
          '过账当月交易前检查会计期间。',
          '不要向已关闭期间过账。',
          '使用税率和税务规则查看当前税务设置。',
        ],
        checks: [
          '借贷必须平衡。',
          '零售PBJT/PB1为含税，不是在展示价上另加。',
          '科目、税率和税务规则变更必须通过有记录的UI或迁移。',
        ],
        links: [
          { label: '科目表', href: '/accounting/coa' },
          { label: '凭证', href: '/accounting/journals' },
          { label: '创建凭证', href: '/accounting/journals/new' },
          { label: '税务规则', href: '/tax/rules' },
        ],
      },
      {
        id: 'purchasing',
        eyebrow: '采购',
        title: '供应商和采购订单',
        summary: '采购模块记录供应商和采购申请，为收货前提供控制依据。',
        steps: [
          '打开采购。',
          '确认供应商已存在；若没有，请创建正确名称和联系方式。',
          '点击新建PO。',
          '选择供应商、地点、日期和采购项目。',
          '检查价格、数量、税和备注。',
          '保存PO作为采购申请依据。',
          '如果启用审批，PO会进入采购订单工作流。',
        ],
        checks: [
          '日常采购不得使用虚假供应商。',
          '高金额PO必须走审批工作流。',
          '实收与PO不一致时，入库前必须记录差异。',
        ],
        links: [
          { label: '采购', href: '/purchasing' },
          { label: '新建PO', href: '/purchasing/po/new' },
          { label: '工作流编辑器', href: '/settings/workflow-editor' },
        ],
      },
      {
        id: 'hr',
        eyebrow: '人事',
        title: '员工、考勤、请假、工资和警告',
        summary: '人事模块保存员工资料，用于考勤、合同、工资、请假和纪律记录。',
        steps: [
          '打开 HR > Employees。',
          '点击新增员工创建员工资料。',
          '填写姓名、邮箱、电话、职位、工作地点、入职日期和合同资料。',
          '使用考勤查看出勤情况。',
          '使用请假查看或处理请假申请。',
          '按正确期间运行工资，并在审批或付款前复核。',
          '用纪律记录登记SP1/SP2/SP3，并填写事件日期和明确原因。',
        ],
        checks: [
          'KTP、NPWP、电话和工资属于个人数据，不得随意分享。',
          '每月8日工资发放前必须复核。',
          '警告记录必须有原因、事件日期和确认状态。',
        ],
        links: [
          { label: '员工', href: '/hr/employees' },
          { label: '新增员工', href: '/hr/employees/new' },
          { label: '签到', href: '/hr/checkin' },
          { label: '考勤', href: '/hr/attendance' },
          { label: '请假', href: '/hr/leave' },
          { label: '工资', href: '/hr/payroll' },
        ],
      },
      {
        id: 'workflow',
        eyebrow: '治理',
        title: '工作流编辑器：用途、示例和步骤',
        summary:
          '工作流编辑器用于在不改源码的情况下设置谁必须审批某些流程，例如采购订单、库存调整、报销、请假、工资或手工凭证。',
        steps: [
          '打开 设置 > 工作流编辑器。',
          '点击创建工作流。',
          '选择模块，例如 purchase_order、leave_request、stock_adjustment、reimbursement_request 或 journal_entry。',
          '填写多语言工作流名称。',
          '如果只适用于特定情况，添加触发条件，例如 amount > 5000000。',
          '添加审批步骤。简单示例：第1步 = director；分级示例：第1步 = finance，第2步 = director。',
          '设置优先级。多个工作流匹配时，最高优先级会运行。',
          '保存工作流。',
          '创建符合条件的测试交易，确认状态变为等待审批。',
          '如果工作流错误，请停用或修改，并记录变更影响。',
        ],
        checks: [
          '工作流不是保存密码、secret或部署URL的地方。',
          '规则过宽会让所有交易都卡在审批。',
          '规则过窄会让重要交易绕过审批。',
          '工作流变更必须用申请人和审批人账户测试。',
        ],
        links: [
          { label: '工作流编辑器', href: '/settings/workflow-editor' },
          { label: '权限', href: '/settings/permissions' },
        ],
      },
      {
        id: 'permissions',
        eyebrow: '安全',
        title: '权限、角色和访问复核',
        summary: '权限决定用户能看到的菜单和可执行的动作。每个角色只应获得工作所需权限。',
        steps: [
          '打开 设置 > 权限。',
          '选择要检查的角色。',
          '检查read、create、update、approve、export和manage权限。',
          '保存角色变更。',
          '若权限未变化，请用户退出后重新登录。',
          '用该角色测试至少一个重要动作。',
        ],
        checks: [
          '不要给门店操作角色通配权限。',
          '董事或管理员可以有较宽权限，但仍需使用个人账户。',
          '员工调岗或离职时必须复核权限。',
        ],
        links: [{ label: '权限', href: '/settings/permissions' }],
      },
      {
        id: 'settings-support',
        eyebrow: '支持',
        title: '设置、通知、自动任务和故障处理',
        summary: '运营设置让ERP无需改源码即可适应门店需求。发生错误时先收集足够证据。',
        steps: [
          '使用POS设置管理小票宽度、POS会计过账、渠道和打印机需求。',
          '使用Naixer KDS管理QR映射和标签格式。',
          '使用通知设置运营警报接收人。',
          '配置后使用定时任务管理备份、工资、库存提醒和缓存任务。',
          '出现错误时记录URL、时间、账户、地点、最后动作和digest/error message。',
          '检查用户是否有正确权限。',
          '检查所需数据是否存在且已启用。',
          '提交完整证据，避免凭猜测修复。',
        ],
        checks: [
          '小票和标签尺寸必须匹配门店打印机。',
          'Naixer KDS标签支持横向6x4厘米和4x3厘米。',
          '自动任务必须测试，避免误报或漏执行。',
        ],
        links: [
          { label: 'POS设置', href: '/settings/pos' },
          { label: 'Naixer KDS', href: '/settings/integrations/naixer' },
          { label: '通知', href: '/settings/notifications' },
          { label: '定时任务', href: '/settings/scheduled-jobs' },
        ],
      },
    ],
    assessorTitle: '评估控制',
    assessorIntro: '这些控制把治理标准转化为ERP行为和日常运营要求。',
    assessorItems: [
      {
        standard: 'ISO/IEC 27001',
        focus: '访问、个人数据、审计记录和会话安全。',
        evidence: '角色权限、个人账户、退出登录、限制个人数据访问和审计变更。',
      },
      {
        standard: 'ISO 9001',
        focus: '流程一致性和作业指导。',
        evidence: 'POS、库存、财务、人事和故障处理的步骤化文档。',
      },
      {
        standard: 'ISO/IEC 25010',
        focus: '可用性、可靠性、安全性和可维护性。',
        evidence: '语言正确、路由不404、健康检查通过、设置通过UI管理。',
      },
      {
        standard: 'ISO 22301',
        focus: '运营连续性。',
        evidence: '离线POS、备份任务、健康检查、PM2重启和事件记录流程。',
      },
      {
        standard: 'ISO/IEC 38500, COBIT, ITIL',
        focus: '治理、价值交付、变更控制和事件管理。',
        evidence: '审批工作流、权限复核、定时任务和问题报告指南。',
      },
    ],
    supportTitle: '正确的Bug报告格式',
    supportSteps: [
      '写明页面URL和发生时间。',
      '写明使用账户和工作地点。',
      '写明错误前最后一步操作。',
      '如有截图和digest/error message，请附上。',
      '说明是否发生在部署后、数据变更后或网络异常时。',
    ],
  },
};
