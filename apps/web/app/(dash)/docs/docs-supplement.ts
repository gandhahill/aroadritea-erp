import type { AppLocale } from './docs-content';

export const DOCS_SUPPLEMENT: Record<AppLocale, string> = {
  id: `
## Peta halaman ERP dan cara navigasi
Gunakan sidebar kiri sebagai peta utama ERP. Section bisa dibuka/tutup, tombol logo kecil dapat menciutkan sidebar, dan halaman aktif diberi highlight merah. Semua halaman dashboard membutuhkan login staff; akses tombol dan data tetap mengikuti permission akun.

### Step by step
1. Mulai dari Dashboard untuk melihat shortcut pekerjaan yang sesuai permission.
1. Buka grup modul seperti Accounting, Reporting, POS, Inventory, Purchasing, HR, CRM, Helpdesk, AI Assistant, CMS, atau Settings.
1. Jika halaman tidak muncul atau tombol hilang, cek role akun di Settings > Permissions.
1. Gunakan halaman Docs untuk mencari prosedur kerja, lalu klik Related pages untuk langsung masuk ke modul.
1. Gunakan Notifications dari ikon lonceng untuk membaca notifikasi shift, payroll, ticket, approval, stock, atau outage.

### Control checks
- Jangan meminjam akun user lain untuk membuka menu yang tidak muncul.
- Jika ada 404 atau menu mengarah ke halaman kosong, laporkan melalui Helpdesk dengan URL dan waktu kejadian.
- Setelah mengganti bahasa akun, logout dan login ulang bila label belum berubah.

### Related pages
- Dashboard: /dashboard
- Account: /account
- Notifications: /notifications
- Permissions: /settings/permissions

## POS lanjutan, pesanan, refund, display, dan manual closing {perm=pos.transact}
POS produksi dipakai untuk transaksi nyata. POS Demo hanya untuk latihan. Channel penjualan adalah dine-in, take-away, atau delivery; tunai, QRIS, kartu, dan Flazz adalah metode pembayaran.

### Step by step
1. Di POS produksi, buka shift sebelum transaksi pertama dan tutup shift setelah kas fisik cocok.
1. Pilih channel penjualan yang benar, lalu tambah produk, modifier, member, guest name, catatan item, dan diskon manual bila diperlukan.
1. Diskon manual wajib punya alasan. Sistem menyimpan audit dan mengirim notifikasi untuk review promo.
1. Tekan Pay Now, pilih metode bayar, gunakan full payment atau split payment, lalu konfirmasi. Donasi atau rounding muncul di modal pembayaran jika aktif.
1. Jika offline, transaksi masuk outbox di browser. Jangan hapus cache; cek banner pending sync dan tekan retry saat koneksi pulih.
1. Buka POS Orders untuk audit transaksi. Void hanya untuk order open; refund untuk order paid dan wajib alasan serta qty item yang dikembalikan.
1. Buka Customer Display dari POS agar layar pelanggan memakai tenant dan lokasi yang benar.
1. Gunakan Manual Sales hanya untuk rekap penjualan lama atau closing manual, bukan pengganti POS live.
1. Di POS Demo, gunakan reset demo untuk menghapus riwayat order demo. Gunakan keluar demo untuk menghapus sandbox dan kembali ke POS produksi.

### Control checks
- POS Demo tidak boleh dipakai untuk transaksi pelanggan nyata.
- Void tidak membalik jurnal karena order belum lunas; refund berdampak ke jurnal, stok, dan audit.
- Route print struk dan label memanggil window print. Label saat ini menampilkan QR order atau pickup number, bukan mengirim API ke Naixer.
- Manual closing tidak otomatis identik dengan auto-deduct BOM dari kasir produksi; review stok setelah input manual besar.

### Related pages
- POS Produksi: /pos
- POS Orders: /pos/orders
- Manual Sales: /pos/manual-sales
- POS Demo: /pos/demo
- Customer Display: /display

## Inventory detail: produk, supplies, stok, BOM, adjustment, dan opname {perm=inventory.view}
Inventory memisahkan menu yang dijual, bahan baku, stok outlet, recipe/BOM, adjustment cepat, dan stock opname. Perubahan stok yang benar dilakukan lewat workflow, bukan edit database.

### Step by step
1. Inventory default membuka Produk & Menu. Gunakan Products untuk menu sellable yang muncul di POS.
1. Gunakan Supplies untuk raw material dan consumable seperti teh, lemon, cup, sedotan, dan bahan habis pakai.
1. Di Products New atau detail produk, isi SKU, kategori, kind, UOM, harga, cost, shelf life, status sellable/purchasable, batch, expiry, dan gambar bila ada.
1. Gunakan Variant Manager di detail produk untuk varian ukuran, suhu, atau harga.
1. Gunakan Categories untuk kategori sederhana. Kategori yang masih dipakai produk tidak boleh dihapus sembarangan.
1. Stock by Outlet bersifat read-only. Koreksi stok dilakukan lewat Opname atau Adjust.
1. Di Adjust, input qty akhir setelah koreksi, bukan delta. Pilih reason dan isi notes yang dapat diaudit.
1. Di Recipes, buat BOM produk jadi, tambah ingredient, qty, UOM, dan centang auto-deduct hanya untuk bahan yang harus berkurang otomatis saat POS sale.
1. Di Stock Opname, buat sesi, input counted qty, submit, lalu approve. Jurnal adjustment dibuat saat approval.
1. Variance report dipakai untuk analisis selisih setelah opname, bukan tempat mengubah stok.

### Control checks
- Produk nonaktif tidak boleh dipakai untuk transaksi baru.
- BOM kosong membuat laporan COGS kurang akurat dan dapat mengganggu auto-deduct.
- Opname global dilakukan bulanan; teh dan lemon dicek lebih sering sesuai SOP.
- Adjustment besar wajib punya alasan operasional dan review manajemen.

### Related pages
- Products: /inventory/products
- New Product: /inventory/products/new
- Supplies: /inventory/supplies
- Categories: /inventory/categories
- Stock by Outlet: /inventory/stock
- Recipes: /inventory/recipes
- Quick Adjust: /inventory/adjust
- Stock Opname: /inventory/opname
- Inventory Variance: /inventory/variance

## Purchasing detail: PO, GRN, retur, dan shipment tracking {perm=purchasing.view}
Purchasing mencatat supplier, purchase order, penerimaan barang, retur pembelian, dan tracking resi. PO tidak menambah stok; stok bertambah saat GRN dikonfirmasi.

### Step by step
1. Buka Purchasing untuk melihat daftar PO, filter status/tanggal, dan supplier.
1. Tambah atau perbarui supplier dari form supplier sebelum membuat PO rutin.
1. Buat PO baru dengan supplier, lokasi, tanggal, estimasi diterima, item, qty, UOM, harga, pajak, dan catatan.
1. Setelah PO disetujui dan barang datang, buka detail PO. Form GRN hanya muncul jika PO masih receivable.
1. Isi qty diterima, batch, expiry, dan notes penerimaan. Konfirmasi GRN akan menambah stok dan membuat jejak pembelian sesuai service.
1. Gunakan GRN Report untuk menelusuri histori penerimaan dengan filter tanggal/lokasi/status.
1. Buat Purchase Return dari GRN confirmed. Saat ini form meminta ID GRN, lalu user memilih line, qty returned, unit cost, reason, dan notes.
1. Jalankan alur retur: draft, submitted, approved, posted, atau cancelled. Status posted dan cancelled adalah terminal.
1. Di Shipments, isi courier, AWB, dan 5 digit akhir nomor HP bila kurir meminta, lalu sync tracking manual.

### Control checks
- BinderByte tracking disimpan sebagai cache. Jangan tekan sync berulang tanpa kebutuhan karena kuota terbatas.
- Barang datang yang berbeda dari PO harus dicatat sebelum stok bertambah.
- Retur posted berdampak pada stok dan akuntansi.
- Jangan tulis panduan export GRN jika tombol export belum tersedia di halaman.

### Related pages
- Purchasing: /purchasing
- New PO: /purchasing/po/new
- GRN Report: /purchasing/grn-report
- Purchase Returns: /purchasing/returns
- New Purchase Return: /purchasing/returns/new
- Shipments: /purchasing/shipments

## Accounting detail: COA, jurnal, periode, aset, kas kecil, reimbursement, dan bank recon {perm=accounting.view}
Accounting menjaga data double-entry, bukti transaksi, periode, aset tetap, kas kecil, reimbursement, dan rekonsiliasi bank. Setiap mutasi penting harus punya jejak audit.

### Step by step
1. Di COA, gunakan search, filter tipe, expand/collapse, tambah akun, edit akun, dan safe delete dengan replacement account.
1. Akun non-postable dipakai sebagai parent; akun inactive tidak dipakai untuk jurnal baru tetapi histori tetap tersimpan.
1. Di Journals, gunakan template CSV, import CSV, export Excel, filter status, dan Jurnal Baru.
1. Saat membuat jurnal manual, isi posting date, location, description, reference, debit/kredit, partner, due date, reminder, dan attachment jika ada bukti.
1. Import CSV menghasilkan draft journal. Review balance dan periode sebelum posting.
1. Journal detail dipakai untuk review baris dan lampiran. Jika tombol posting atau reverse tidak tampil, proses dilakukan oleh role/service yang tersedia dan harus dilaporkan bila UI dibutuhkan.
1. Di Periods, tutup periode setelah semua jurnal bulan itu selesai. Force close berisiko meninggalkan draft yang belum diposting.
1. Payables dan Receivables membaca jurnal posted. Mapping akun, due date, reminder, dan allowance rate mempengaruhi aging.
1. Fixed Assets dipakai untuk daftar aset, setting kategori, mapping akun, dan run depreciation.
1. Petty Cash dipakai untuk buka kas outlet, expense kecil, isi ulang, setor bank, dan filter transaksi.
1. Reimbursement mengikuti lifecycle draft, submitted, approved, rejected, dan disbursed dengan bukti lampiran.
1. Bank Reconciliation dimulai dari master bank account, import atau input manual mutasi, match/unmatch line, suggestion, lalu finalize.

### Control checks
- Total debit dan kredit wajib balance.
- Jangan posting ke periode closed tanpa persetujuan reopening atau jurnal koreksi.
- Bukti transaksi dari WhatsApp/email harus masuk Correspondence atau lampiran jurnal, jangan hanya tersimpan di chat pribadi.
- Semua line bank statement harus diselesaikan sebelum finalize; unmatched handling harus jelas.
- Top-up petty cash dan reimbursement bernilai material perlu approval sesuai workflow internal.

### Related pages
- COA: /accounting/coa
- Journals: /accounting/journals
- New Journal: /accounting/journals/new
- Import Journals: /accounting/journals/import
- Periods: /accounting/periods
- Fixed Assets: /accounting/assets
- Payables: /accounting/payables
- Receivables: /accounting/receivables
- Petty Cash: /accounting/petty-cash
- Reimbursement: /accounting/reimbursement
- Bank Reconciliation: /accounting/bank-recon
- Bank Accounts: /settings/bank-accounts

## Reporting dan analisis manajemen {perm=reporting.view}
Reporting membaca data posted dan operasional untuk membantu closing, pajak, staffing, margin, waste, dan keputusan manajemen.

### Step by step
1. Business Intelligence menampilkan KPI manajemen. Gunakan untuk melihat tren, bukan sebagai dokumen pajak final.
1. Trial Balance memakai tanggal as-of dan lokasi untuk mengecek saldo akun.
1. Balance Sheet menunjukkan posisi keuangan dan badge balanced atau not balanced. Jika tidak balance, cek jurnal posted dan mapping akun.
1. Profit Loss memakai periode from/to dan lokasi untuk membaca revenue, COGS, expense, dan net income.
1. Cash Flow memakai jurnal posted dan klasifikasi akun. Jika tombol menyebut XLSX tetapi file CSV, ikuti file yang dihasilkan sampai UI diperbaiki.
1. Aging Receivables dan Aging Payables memakai due date. Koreksi due date dari party ledger bila bucket tidak sesuai.
1. Daily Summary dipakai untuk SOP akhir hari: total sales, metode pembayaran, top product, shift, dan perbandingan periode.
1. Hourly Sales dipakai untuk staffing dan membaca jam ramai; grouping bisa channel atau hari.
1. Donations dipakai untuk rekonsiliasi donasi/rounding.
1. Omzet Harian dipakai untuk rekap fiskal: gross, PB1, net, adjustment, note, dan export Excel.
1. COGS report membutuhkan BOM. Expand baris untuk melihat ingredient dan margin; negative margin harus direview.
1. Waste report membaca stock adjustment reason seperti waste, rusak, spoil, basi, atau expired.

### Control checks
- Laporan keuangan final hanya valid bila periode dan jurnal sudah direview.
- Export dipakai sebagai dokumen kerja; tetap cocokkan dengan bukti transaksi dan aturan pajak.
- Penyesuaian omzet fiskal wajib punya alasan yang jelas.
- Missing BOM atau cost membuat COGS dan margin tidak akurat.

### Related pages
- Business Intelligence: /reporting/business-intelligence
- Trial Balance: /reporting/trial-balance
- Balance Sheet: /reporting/balance-sheet
- Profit Loss: /reporting/profit-loss
- Cash Flow: /reporting/cash-flow
- Aging Receivables: /reporting/aging-receivables
- Aging Payables: /reporting/aging-payables
- Daily Summary: /reporting/daily-summary
- Hourly Sales: /reporting/hourly-sales
- Donations: /reporting/donations
- Omzet Harian: /reporting/omzet-harian
- COGS: /reporting/cogs
- Waste: /reporting/waste

## Tax rates dan tax rules {perm=tax.view}
Tax module mengatur tarif dan aturan pajak. PB1/PBJT retail bersifat inclusive. PPN keluaran retail default off, tetapi engine tetap siap untuk B2B atau kebutuhan pajak lain.

### Step by step
1. Tax default membuka Tax Rates.
1. Di Tax Rates, tambah atau edit kode pajak, nama, rate percent, calculation inclusive/exclusive, posting account, effective date, dan status active.
1. Di Tax Rules, pilih scope global, channel, customer, product category, atau rule lain yang tersedia.
1. Atur priority agar rule spesifik menang dari rule umum.
1. Gunakan effective date untuk perubahan tarif agar histori lama tidak berubah.
1. Review dampak rule ke POS, purchase, dan export pajak sebelum mengaktifkan rule penting.

### Control checks
- Jangan hardcode tarif pajak di source code.
- PB1/PBJT retail tidak ditambahkan di atas harga menu.
- Rule terlalu luas bisa membuat semua transaksi kena pajak yang salah; rule terlalu sempit bisa membuat transaksi lolos.

### Related pages
- Tax Rates: /tax/rates
- Tax Rules: /tax/rules
- Omzet Harian: /reporting/omzet-harian

## HR detail: karyawan, jadwal, presensi, cuti, payroll, SOP, dan whistleblower {perm=hr.view}
HR menyimpan data karyawan, jadwal shift, presensi GPS, cuti, payroll, SP, SOP, rekrutmen, dan pelaporan pelanggaran. Data pribadi harus dibatasi sesuai permission.

### Step by step
1. HR default membuka Employees. Gunakan search, filter status/lokasi, export XLSX, tambah karyawan, dan detail.
1. Saat menambah karyawan, isi identitas, kerja, pajak/BPJS, akun login opsional, role, scope lokasi, dan password awal.
1. Schedule dipakai untuk roster mingguan. Gunakan prev/next week, filter lokasi, klik shift, OFF, atau swap. Swap membutuhkan alasan dan mengirim notifikasi ke karyawan terkait.
1. Check In membutuhkan GPS dan lokasi outlet yang sudah disetting. Jika GPS gagal, retry dan laporkan dengan screenshot.
1. Attendance dipakai admin untuk review presensi, filter employee/tanggal, dan dispensasi telat dengan alasan.
1. My Attendance dipakai karyawan untuk cek riwayat, telat, dan jam kerja sendiri.
1. Leave memisahkan pengaturan leave type, request cuti, approve/reject, delete, dan balance.
1. Payroll dibuat per periode dan lokasi setelah presensi, bonus, potongan, BPJS, dan PPh 21 direview.
1. Payroll detail mengikuti draft, approved, paid, dan journal link bila tersedia.
1. My Payslips dipakai karyawan untuk melihat dan mencetak slip gaji.
1. Disciplinary dipakai untuk SP1, SP2, SP3, lampiran, publish, dan acknowledgement.
1. Recruitment mengikuti lowongan, applicant, screening, interview, offer, hired, atau rejected.
1. SOP menyimpan dokumen final, status draft/published, download, dan archive.
1. Whistleblower form dipakai untuk laporan anonim. Admin review memakai status open, investigating, dan resolved.

### Control checks
- Data KTP, NPWP, telepon, payroll, dan kontrak tidak boleh dibagikan di luar role berwenang.
- Dispensasi telat mempengaruhi payroll dan harus punya alasan.
- Payroll tanggal 8 wajib direview sebelum paid.
- SOP published harus versi final dan mudah dibuka outlet.

### Related pages
- Employees: /hr/employees
- New Employee: /hr/employees/new
- Schedule: /hr/schedule
- Check In: /hr/checkin
- Attendance: /hr/attendance
- My Attendance: /hr/my-attendance
- Leave: /hr/leave
- Payroll: /hr/payroll
- My Payslips: /hr/my-payslips
- Disciplinary: /hr/disciplinary
- Recruitment: /hr/recruitment
- SOP: /hr/sop
- Whistleblower Form: /whistleblower
- Whistleblower Reports: /hr/whistleblower

## CRM, loyalty, dan portal member {perm=crm.member.view}
CRM member dipakai untuk melihat member, tier, histori poin, dan koreksi poin. Portal member publik berbeda dari akun staff ERP.

### Step by step
1. Buka CRM Members untuk mencari member berdasarkan nama, kota, tier, dan pagination.
1. Buka detail member untuk melihat profil, tier, point balance, lifetime points, dan transaksi poin terakhir.
1. Adjust points hanya untuk koreksi operasional. Isi delta dan reason yang jelas.
1. Loyalty Settings mengatur rupiah per poin dan tier. Lifetime points hanya naik untuk menentukan tier.
1. Member publik daftar dari website, menyetujui privacy policy, melewati Turnstile, lalu verifikasi OTP.
1. Member login ke portal untuk melihat saldo, riwayat, voucher, dan QR atau identitas member bila tersedia.
1. Di kasir, lookup member tetap pakai nomor HP terdaftar dan konfirmasi nama pelanggan.

### Control checks
- Koreksi poin tanpa alasan tidak boleh dilakukan.
- Akun member publik bukan akun staff ERP.
- OTP yang kedaluwarsa harus diulang dari flow verifikasi, bukan diaktifkan manual tanpa audit.
- Request hapus akun member harus mengikuti kebijakan privasi dan UU PDP.

### Related pages
- CRM Members: /crm/members
- Loyalty Settings: /settings/loyalty
- Member Registration: /id/member/daftar
- Member Login: /id/member/masuk
- Member Account: /id/member/akun

## Helpdesk, notifikasi, dan AI Assistant
Helpdesk adalah jalur resmi untuk laporan bug dan dukungan. AI Assistant dapat membaca data, membantu OCR struk, dan membuat draft tindakan, tetapi mutasi tetap harus dikonfirmasi user.

### Step by step
1. Buat tiket manual dari Helpdesk New saat ada bug, pertanyaan operasional, atau permintaan bantuan yang perlu dilacak.
1. Isi subject, priority, category, body, URL, waktu, akun, lokasi, langkah terakhir, screenshot, dan error message bila ada.
1. Di detail tiket, handler dapat mengubah status open, in progress, resolved, closed, atau kembali open.
1. Reply biasa terlihat reporter. Internal note hanya untuk handler.
1. Notifications menampilkan inbox user. Gunakan mark read atau mark all read setelah ditindaklanjuti.
1. Notification settings mengatur channel email/WhatsApp/Telegram dan purpose seperti outage, stock alert, atau all.
1. AI Assistant dipakai untuk tanya data, membaca file yang diizinkan, OCR receipt, dan membuat draft manual sale atau ticket.
1. Jika AI membuat Confirm Action Card, baca detailnya lalu confirm atau cancel. AI tidak boleh mutasi langsung tanpa konfirmasi.
1. AI Assistant Log dipakai admin untuk audit tool call, draft, user, entity, dan investigasi.

### Control checks
- Jangan hanya menulis bug di chat pribadi jika butuh follow-up. Buat ticket.
- Jangan confirm draft AI jika data, lokasi, nominal, atau tanggal belum benar.
- Web search AI harus diaktifkan secara sadar bila query membutuhkan internet.
- Notifikasi outage/stock harus punya penerima aktif.

### Related pages
- Helpdesk: /helpdesk
- New Ticket: /helpdesk/new
- Notifications: /notifications
- Notification Settings: /settings/notifications
- AI Assistant: /ai-assistant
- AI Assistant Log: /settings/ai-assistant/log

## CMS, website publik, dan editor panduan {perm=cms.manage} {audience=management,developer}
CMS mengatur halaman publik, post blog/promo/event, dan panduan ERP runtime. Perubahan CMS harus dicek di setiap bahasa yang relevan.

### Step by step
1. CMS default membuka Pages.
1. Pages dipakai untuk halaman website publik berbasis CMS. Perhatikan perbedaan static route yang sudah ada di source dan halaman CMS editable.
1. Saat membuat page, isi locale ID, EN, ZH, slug, type, content, SEO, navbar, dan gambar bila ada.
1. Publish page hanya setelah slug, konten, SEO, dan link publik dicek.
1. Posts dipakai untuk news, promo, recipe, atau event. Isi title, content, excerpt, tags, cover image, status, dan display order.
1. CMS Docs mengubah konten panduan ERP yang tampil di /docs. Gunakan markdown: heading ##, subheading ###, list 1., dan checklist -.
1. Heading docs dapat memakai anotasi {perm=permission.code} untuk menyembunyikan section dari user tanpa permission.
1. Heading docs dapat memakai anotasi {audience=staff,management,developer} untuk membatasi section berdasarkan audience filter.
1. Setelah publish, buka URL publik untuk ID, EN, dan ZH bila konten tersedia.

### Control checks
- Jangan membuat slug publik yang bertabrakan dengan static route.
- Gambar harus relevan dan sudah boleh dipakai brand.
- Perubahan panduan di source tidak otomatis muncul bila database sudah punya erp_docs_content. Gunakan refresh default docs per bahasa dari CMS Docs atau script operasional.

### Related pages
- CMS Docs: /cms/docs
- CMS Pages: /cms/pages
- New CMS Page: /cms/pages/new
- CMS Posts: /cms/posts
- New CMS Post: /cms/posts/new
- Docs: /docs

## Settings, integrasi Naixer, permission, custom field, dan refresh panduan {perm=settings.manage} {audience=management,developer}
Settings menyimpan konfigurasi operasional yang harus bisa berubah tanpa edit source code. Perubahan setting harus dites dengan role dan lokasi yang terdampak.

### Step by step
1. Locations mengatur outlet/kantor, status, alamat, dan GPS attendance.
1. POS Settings mengatur PB1 tax code, akun kas/settlement, akun revenue, akun donasi, channel delivery, commission/net bps, receipt width, dan printer profile.
1. Promotions mengatur promo aktif, syarat, benefit, prioritas, dan approval.
1. Attendance Policy mengatur denda telat, jatah toleransi, dan denda mangkir yang mempengaruhi payroll.
1. Scheduled Jobs mengatur backup, payroll, stock alert, ISR, dan job lain.
1. Naixer KDS adalah QR-only. Default Aroadri memakai Format B dash; Format A pipe adalah fallback. Mapping produk/modifier bukan API integration.
1. Permissions mengatur role dan permission matrix. Setelah perubahan, user perlu logout/login untuk memastikan sesi membaca akses terbaru.
1. Custom Fields menambah field database-driven untuk entity yang didukung tanpa migrasi source.
1. Bank Accounts adalah prasyarat bank reconciliation dan mapping COA bank.
1. Workflow Editor mengatur approval rule tanpa edit source.
1. Untuk mengganti isi panduan yang sudah ada di database, buka CMS Docs, pilih bahasa yang ingin diganti dari default sistem, lalu tekan refresh default. Bahasa lain dipertahankan.
1. Alternatif operasional: jalankan script refresh docs dengan --locales id,en,zh dan --apply dari server/staging setelah backup.

### Control checks
- Jangan simpan secret, password, atau token API di workflow/custom field/docs.
- Uji setting besar dengan akun pemohon dan approver.
- Jangan spam preview/sync Naixer atau shipment jika provider punya kuota.
- Refresh panduan default akan menimpa bahasa yang dipilih. Pastikan edit manual penting sudah disalin atau hanya refresh bahasa yang memang ingin diganti.

### Related pages
- Locations: /settings/locations
- POS Settings: /settings/pos
- Promotions: /settings/promotions
- Attendance Policy: /settings/attendance
- Scheduled Jobs: /settings/scheduled-jobs
- Naixer KDS: /settings/integrations/naixer
- Permissions: /settings/permissions
- Custom Fields: /settings/custom-fields
- Bank Accounts: /settings/bank-accounts
- Workflow Editor: /settings/workflow-editor
- CMS Docs: /cms/docs

## Audit trail, correspondence, dan evidence {perm=audit.view} {audience=management,developer}
Audit trail menjawab siapa mengubah apa dan kapan. Correspondence menyimpan surat, bukti, dan arsip finance/legal/tax yang tidak selalu langsung menjadi lampiran jurnal.

### Step by step
1. Audit Trail dapat difilter berdasarkan entity, action, actor, tanggal, dan pagination.
1. Buka detail audit untuk melihat before dan after diff.
1. Gunakan action seperti create, update, submit, approve, reject, post, close, void, refund, atau delete untuk investigasi.
1. Correspondence dipakai untuk surat masuk/keluar, bukti finance/tax/legal, arsip WhatsApp/email, owner, due date, priority, tags, dan attachment.
1. Untuk bukti transaksi finance, gunakan classification finance dan direction internal agar muncul sebagai register bukti transaksi.
1. Di detail correspondence, update status dari registered, in progress, sent, closed, atau archived sesuai lifecycle.
1. Lampiran jurnal tetap dikelola di journal detail; correspondence adalah register arsip yang lebih umum.

### Control checks
- Audit belum menjadi pengganti approval. Approval tetap dilakukan di workflow/modul terkait.
- Archive correspondence hanya untuk dokumen yang sudah tidak aktif tetapi tetap harus tersimpan.
- Jika ada mutasi penting tanpa audit, laporkan sebagai bug prioritas tinggi.

### Related pages
- Audit Trail: /audit
- Correspondence: /correspondence
- Finance Evidence: /correspondence?classification=finance&direction=internal
- Journals: /accounting/journals
`,
  en: `
## ERP page map and navigation
Use the left sidebar as the main ERP map. Sections can be expanded or collapsed, the small logo control can collapse the sidebar, and the active page is highlighted in red. Every dashboard page requires staff login; buttons and data still follow the account permission set.

### Step by step
1. Start from Dashboard to see work shortcuts allowed for your role.
1. Open module groups such as Accounting, Reporting, POS, Inventory, Purchasing, HR, CRM, Helpdesk, AI Assistant, CMS, or Settings.
1. If a page or button is missing, check the account role in Settings > Permissions.
1. Use Docs to read the procedure, then use Related pages to jump into the module.
1. Use Notifications from the bell icon for shift, payroll, ticket, approval, stock, or outage notifications.

### Control checks
- Do not borrow another user's account to open a menu.
- Report 404 or empty pages through Helpdesk with URL and timestamp.
- After changing account language, sign out and sign in again if labels do not refresh.

### Related pages
- Dashboard: /dashboard
- Account: /account
- Notifications: /notifications
- Permissions: /settings/permissions

## Advanced POS, orders, refunds, display, and manual closing {perm=pos.transact}
Production POS is for real customer transactions. POS Demo is for training only. Sales channel means dine-in, take-away, or delivery; cash, QRIS, card, and Flazz are payment methods.

### Step by step
1. Open the shift before the first transaction and close the shift after physical cash matches.
1. Select the correct sales channel, then add products, modifiers, member, guest name, item notes, and manual discount if needed.
1. Manual discount requires a reason. The system stores audit data and sends a promo review notification.
1. Press Pay Now, choose payment method, use full or split payment, then confirm. Donation or rounding appears in the payment modal when enabled.
1. If offline, the transaction is kept in the browser outbox. Do not clear browser storage; check the pending sync banner and retry after connection returns.
1. Open POS Orders for transaction audit. Void is for open orders; refund is for paid orders and requires reason plus returned item quantities.
1. Open Customer Display from POS so the customer screen uses the correct tenant and location.
1. Use Manual Sales only for old sales recap or manual closing, not as a substitute for live POS.
1. In POS Demo, Reset Demo clears demo order history. Exit Demo clears the sandbox and returns to production POS.

### Control checks
- Never use POS Demo for real customer transactions.
- Void does not reverse journals because the order is not paid; refund affects journal, stock, and audit.
- Receipt and label print routes call window print. Labels currently show order QR or pickup number, not a Naixer API payload.
- Manual closing is not identical to live cashier BOM auto-deduct; review inventory after large manual entries.

### Related pages
- Production POS: /pos
- POS Orders: /pos/orders
- Manual Sales: /pos/manual-sales
- POS Demo: /pos/demo
- Customer Display: /display

## Inventory detail: products, supplies, stock, BOM, adjustment, and opname {perm=inventory.view}
Inventory separates sellable menu items, raw materials, outlet stock, recipe/BOM, quick adjustment, and stock opname. Correct stock changes must go through workflow, not direct database edits.

### Step by step
1. Inventory opens Products by default. Use Products for sellable menu items shown in POS.
1. Use Supplies for raw materials and consumables such as tea, lemon, cups, straws, and disposable stock.
1. In New Product or product detail, fill SKU, category, kind, UOM, price, cost, shelf life, sellable/purchasable status, batch, expiry, and image when available.
1. Use Variant Manager in product detail for size, temperature, or price variants.
1. Use Categories for simple category maintenance. Categories still used by products should not be deleted casually.
1. Stock by Outlet is read-only. Correct stock through Opname or Adjust.
1. In Adjust, enter final quantity after correction, not delta. Choose reason and write auditable notes.
1. In Recipes, create product BOM, add ingredient, quantity, UOM, and enable auto-deduct only for materials that must reduce automatically after POS sale.
1. In Stock Opname, create a session, input counted quantity, submit, then approve. Adjustment journal is created at approval.
1. Variance report is for post-opname analysis, not for changing stock.

### Control checks
- Inactive products cannot be used in new sales.
- Empty BOM makes COGS less accurate and can break auto-deduct expectations.
- Global opname runs monthly; tea and lemon are checked more often by SOP.
- Large adjustments require operational reason and management review.

### Related pages
- Products: /inventory/products
- New Product: /inventory/products/new
- Supplies: /inventory/supplies
- Categories: /inventory/categories
- Stock by Outlet: /inventory/stock
- Recipes: /inventory/recipes
- Quick Adjust: /inventory/adjust
- Stock Opname: /inventory/opname
- Inventory Variance: /inventory/variance

## Purchasing detail: PO, GRN, returns, and shipment tracking {perm=purchasing.view}
Purchasing records suppliers, purchase orders, goods receipts, purchase returns, and shipment tracking. PO does not increase stock; stock increases when GRN is confirmed.

### Step by step
1. Open Purchasing to view PO list, status/date filters, and supplier data.
1. Add or update supplier before creating routine POs.
1. Create a new PO with supplier, location, dates, expected date, items, quantity, UOM, price, tax, and notes.
1. After PO approval and goods arrival, open PO detail. The GRN form appears only when the PO is still receivable.
1. Fill received quantity, batch, expiry, and receiving notes. Confirmed GRN increases stock and creates the purchase trail through service logic.
1. Use GRN Report to trace receiving history with date/location/status filters.
1. Create Purchase Return from a confirmed GRN. The current form asks for GRN ID, then lets users select line, returned quantity, unit cost, reason, and notes.
1. Follow return flow: draft, submitted, approved, posted, or cancelled. Posted and cancelled are terminal states.
1. In Shipments, fill courier, AWB, and phone last 5 digits when required, then sync tracking manually.

### Control checks
- BinderByte tracking is cached. Do not press sync repeatedly without operational need because the quota is limited.
- Goods received differently from PO must be recorded before stock increases.
- Posted purchase return affects stock and accounting.
- Do not document GRN export until an export button exists on the page.

### Related pages
- Purchasing: /purchasing
- New PO: /purchasing/po/new
- GRN Report: /purchasing/grn-report
- Purchase Returns: /purchasing/returns
- New Purchase Return: /purchasing/returns/new
- Shipments: /purchasing/shipments

## Accounting detail: COA, journals, periods, assets, petty cash, reimbursement, and bank recon {perm=accounting.view}
Accounting protects double-entry data, evidence, periods, fixed assets, petty cash, reimbursement, and bank reconciliation. Every important mutation needs an audit trail.

### Step by step
1. In COA, use search, type filter, expand/collapse, create account, edit account, and safe delete with replacement account.
1. Non-postable accounts are parents; inactive accounts cannot be used in new journals but history remains.
1. In Journals, use CSV template, CSV import, Excel export, status filter, and New Journal.
1. When creating a manual journal, fill posting date, location, description, reference, debit/credit lines, partner, due date, reminder, and attachment when evidence exists.
1. CSV import creates journal drafts. Review balance and accounting period before posting.
1. Journal detail is for line and attachment review. If posting or reverse buttons are not visible, use the available service/role path and report UI need if required.
1. In Periods, close the period after all monthly journals are finished. Force close can leave unposted drafts behind.
1. Payables and Receivables read posted journals. Account mapping, due date, reminder, and allowance rates affect aging.
1. Fixed Assets manages asset register, category settings, account mapping, and depreciation run.
1. Petty Cash manages outlet cash account, small expenses, replenishment, bank deposit, and transaction filters.
1. Reimbursement follows draft, submitted, approved, rejected, and disbursed lifecycle with evidence attachments.
1. Bank Reconciliation starts from bank account master, then import or input bank lines manually, match/unmatch, review suggestions, and finalize.

### Control checks
- Total debit and credit must balance.
- Do not post into a closed period without reopening approval or correction journal.
- Evidence from WhatsApp/email must enter Correspondence or journal attachments, not private chat only.
- Resolve every bank statement line before finalize; unmatched handling must be explicit.
- Material petty cash top-up and reimbursement need approval according to internal workflow.

### Related pages
- COA: /accounting/coa
- Journals: /accounting/journals
- New Journal: /accounting/journals/new
- Import Journals: /accounting/journals/import
- Periods: /accounting/periods
- Fixed Assets: /accounting/assets
- Payables: /accounting/payables
- Receivables: /accounting/receivables
- Petty Cash: /accounting/petty-cash
- Reimbursement: /accounting/reimbursement
- Bank Reconciliation: /accounting/bank-recon
- Bank Accounts: /settings/bank-accounts

## Reporting and management analysis {perm=reporting.view}
Reporting reads posted and operational data for closing, tax, staffing, margin, waste, and management decisions.

### Step by step
1. Business Intelligence shows management KPIs. Use it for trends, not as final tax documentation.
1. Trial Balance uses as-of date and location to check account balances.
1. Balance Sheet shows financial position and balanced/not balanced badge. If not balanced, inspect posted journals and account mapping.
1. Profit Loss uses from/to period and location to read revenue, COGS, expenses, and net income.
1. Cash Flow uses posted journals and account classification. If the button says XLSX but the file is CSV, follow the generated file until UI is fixed.
1. Aging Receivables and Aging Payables use due date. Correct due date from party ledger if buckets are wrong.
1. Daily Summary supports end-of-day SOP: total sales, payment methods, top products, shifts, and period comparison.
1. Hourly Sales supports staffing and peak-hour analysis; grouping can be channel or day.
1. Donations supports donation/rounding reconciliation.
1. Omzet Harian supports fiscal revenue recap: gross, PB1, net, adjustment, note, and Excel export.
1. COGS report requires BOM. Expand rows to inspect ingredients and margin; negative margin needs review.
1. Waste report reads stock adjustment reasons such as waste, damage, spoil, stale, or expired.

### Control checks
- Final financial reports are valid only after period and journals are reviewed.
- Exports are working documents; reconcile them with evidence and tax rules.
- Fiscal revenue adjustment requires a clear reason.
- Missing BOM or cost makes COGS and margin inaccurate.

### Related pages
- Business Intelligence: /reporting/business-intelligence
- Trial Balance: /reporting/trial-balance
- Balance Sheet: /reporting/balance-sheet
- Profit Loss: /reporting/profit-loss
- Cash Flow: /reporting/cash-flow
- Aging Receivables: /reporting/aging-receivables
- Aging Payables: /reporting/aging-payables
- Daily Summary: /reporting/daily-summary
- Hourly Sales: /reporting/hourly-sales
- Donations: /reporting/donations
- Omzet Harian: /reporting/omzet-harian
- COGS: /reporting/cogs
- Waste: /reporting/waste

## Tax rates and tax rules {perm=tax.view}
Tax module manages rates and tax application rules. Retail PB1/PBJT is inclusive. Retail output VAT is off by default, while the engine remains ready for B2B or other tax needs.

### Step by step
1. Tax opens Tax Rates by default.
1. In Tax Rates, add or edit tax code, name, rate percent, inclusive/exclusive calculation, posting account, effective date, and active status.
1. In Tax Rules, choose global, channel, customer, product category, or another available scope.
1. Set priority so specific rules win over general rules.
1. Use effective date for rate changes so old history does not change.
1. Review rule impact on POS, purchase, and tax export before activating important rules.

### Control checks
- Do not hardcode tax rates in source code.
- Retail PB1/PBJT is not added on top of menu price.
- Over-broad rules can apply the wrong tax to all transactions; over-narrow rules can let important transactions bypass tax.

### Related pages
- Tax Rates: /tax/rates
- Tax Rules: /tax/rules
- Omzet Harian: /reporting/omzet-harian

## HR detail: employees, schedule, attendance, leave, payroll, SOP, and whistleblower {perm=hr.view}
HR stores employees, shift schedule, GPS attendance, leave, payroll, warning letters, SOP, recruitment, and violation reports. Personal data must be limited by permission.

### Step by step
1. HR opens Employees by default. Use search, status/location filters, XLSX export, add employee, and detail.
1. When adding an employee, fill identity, work, tax/BPJS, optional login account, role, location scope, and initial password.
1. Schedule is for weekly roster. Use prev/next week, location filter, shift click, OFF, or swap. Swap requires reason and notifies affected employees.
1. Check In requires GPS and configured outlet location. If GPS fails, retry and report with screenshot.
1. Attendance lets admins review attendance, filter employee/date, and forgive lateness with reason.
1. My Attendance lets employees check their own history, lateness, and work hours.
1. Leave separates leave type administration, leave request, approve/reject, delete, and balance.
1. Payroll is created by period and location after attendance, bonus, deductions, BPJS, and PPh 21 are reviewed.
1. Payroll detail follows draft, approved, paid, and journal link when available.
1. My Payslips lets employees view and print payslips.
1. Disciplinary manages SP1, SP2, SP3, attachments, publish, and acknowledgement.
1. Recruitment follows opening, applicant, screening, interview, offer, hired, or rejected.
1. SOP stores final documents, draft/published status, download, and archive.
1. Whistleblower form is for anonymous reports. Admin review uses open, investigating, and resolved statuses.

### Control checks
- KTP, NPWP, phone, payroll, and contract data must not be shared outside authorized roles.
- Late forgiveness affects payroll and must have a reason.
- Payroll on the 8th must be reviewed before paid.
- Published SOP must be final and easy for outlets to open.

### Related pages
- Employees: /hr/employees
- New Employee: /hr/employees/new
- Schedule: /hr/schedule
- Check In: /hr/checkin
- Attendance: /hr/attendance
- My Attendance: /hr/my-attendance
- Leave: /hr/leave
- Payroll: /hr/payroll
- My Payslips: /hr/my-payslips
- Disciplinary: /hr/disciplinary
- Recruitment: /hr/recruitment
- SOP: /hr/sop
- Whistleblower Form: /whistleblower
- Whistleblower Reports: /hr/whistleblower

## CRM, loyalty, and member portal {perm=crm.member.view}
CRM members is used to view members, tier, point history, and point corrections. Public member portal accounts are separate from staff ERP accounts.

### Step by step
1. Open CRM Members to search members by name, city, tier, and pagination.
1. Open member detail to see profile, tier, point balance, lifetime points, and recent point transactions.
1. Adjust points only for operational correction. Fill delta and clear reason.
1. Loyalty Settings configures rupiah per point and tiers. Lifetime points only increase for tier calculation.
1. Public members register from the website, consent to privacy policy, pass Turnstile, then verify OTP.
1. Members sign in to the portal to view balance, history, vouchers, and member QR or identity when available.
1. At cashier, member lookup still uses registered phone number and customer name confirmation.

### Control checks
- Do not correct points without reason.
- Public member account is not a staff ERP account.
- Expired OTP must repeat verification flow, not be manually activated without audit.
- Member deletion request must follow privacy policy and PDP compliance.

### Related pages
- CRM Members: /crm/members
- Loyalty Settings: /settings/loyalty
- Member Registration: /id/member/daftar
- Member Login: /id/member/masuk
- Member Account: /id/member/akun

## Helpdesk, notifications, and AI Assistant
Helpdesk is the official path for bug reports and support. AI Assistant can read allowed data, help OCR receipts, and create action drafts, but mutations still require user confirmation.

### Step by step
1. Create a manual ticket from Helpdesk New when a bug, operational question, or support request needs tracking.
1. Fill subject, priority, category, body, URL, time, account, location, last step, screenshot, and error message when available.
1. In ticket detail, handlers can move status open, in progress, resolved, closed, or reopen.
1. Normal replies are visible to reporters. Internal notes are only for handlers.
1. Notifications shows the user inbox. Use mark read or mark all read after follow-up.
1. Notification settings configures email/WhatsApp/Telegram channel and purpose such as outage, stock alert, or all.
1. AI Assistant is used for data questions, allowed file reads, receipt OCR, and manual sale or ticket drafts.
1. If AI creates a Confirm Action Card, read the details then confirm or cancel. AI must not mutate directly without confirmation.
1. AI Assistant Log lets admins audit tool calls, drafts, users, entities, and investigations.

### Control checks
- Do not leave important bugs only in private chat. Create a ticket.
- Do not confirm AI drafts if data, location, amount, or date is wrong.
- AI web search must be explicitly enabled when the question needs internet.
- Outage/stock notifications need active recipients.

### Related pages
- Helpdesk: /helpdesk
- New Ticket: /helpdesk/new
- Notifications: /notifications
- Notification Settings: /settings/notifications
- AI Assistant: /ai-assistant
- AI Assistant Log: /settings/ai-assistant/log

## CMS, public website, and docs editor {perm=cms.manage} {audience=management,developer}
CMS manages public pages, blog/promo/event posts, and runtime ERP docs. CMS changes should be checked in every relevant language.

### Step by step
1. CMS opens Pages by default.
1. Pages manages CMS-backed public website pages. Know the difference between source static routes and editable CMS pages.
1. When creating a page, fill ID, EN, ZH locale content, slug, type, content, SEO, navbar, and image when available.
1. Publish a page only after slug, content, SEO, and public links are checked.
1. Posts are used for news, promo, recipe, or event. Fill title, content, excerpt, tags, cover image, status, and display order.
1. CMS Docs changes the guide shown at /docs. Use markdown: ## headings, ### subheadings, 1. lists, and - checklists.
1. Docs headings can use {perm=permission.code} to hide a section from users without permission.
1. Docs headings can use {audience=staff,management,developer} to filter sections by audience.
1. After publishing, open the public URL for ID, EN, and ZH when content exists.

### Control checks
- Do not create public slugs that collide with static routes.
- Images must be relevant and allowed for brand use.
- Source docs changes do not automatically appear when the database already has erp_docs_content. Use default docs refresh by language from CMS Docs or the operations script.

### Related pages
- CMS Docs: /cms/docs
- CMS Pages: /cms/pages
- New CMS Page: /cms/pages/new
- CMS Posts: /cms/posts
- New CMS Post: /cms/posts/new
- Docs: /docs

## Settings, Naixer integration, permissions, custom fields, and docs refresh {perm=settings.manage} {audience=management,developer}
Settings stores operational configuration that must change without source edits. Setting changes should be tested with affected roles and locations.

### Step by step
1. Locations configures outlets/offices, status, address, and attendance GPS.
1. POS Settings configures PB1 tax code, cash/settlement account, revenue account, donation account, delivery channels, commission/net bps, receipt width, and printer profile.
1. Promotions configures active promos, conditions, benefits, priority, and approval.
1. Attendance Policy configures late penalty, monthly free-late allowance, and absent penalty that affect payroll.
1. Scheduled Jobs configures backup, payroll, stock alert, ISR, and other jobs.
1. Naixer KDS is QR-only. Aroadri default is Format B dash; Format A pipe is fallback. Product/modifier mapping is not an API integration.
1. Permissions manages role and permission matrix. After changes, users should sign out and sign in again to confirm session access.
1. Custom Fields adds database-driven fields for supported entities without source migration.
1. Bank Accounts is required for bank reconciliation and bank COA mapping.
1. Workflow Editor configures approval rules without source edits.
1. To replace guide content already in the database, open CMS Docs, choose languages to replace from system defaults, then refresh defaults. Other languages are preserved.
1. Operational alternative: run the docs refresh script with --locales id,en,zh and --apply from server or staging after backup.

### Control checks
- Do not store secrets, passwords, or API tokens in workflow/custom fields/docs.
- Test large setting changes with requester and approver accounts.
- Do not spam Naixer preview or shipment sync when providers have quotas.
- Default docs refresh overwrites selected languages. Copy important manual edits first or refresh only the language that should be replaced.

### Related pages
- Locations: /settings/locations
- POS Settings: /settings/pos
- Promotions: /settings/promotions
- Attendance Policy: /settings/attendance
- Scheduled Jobs: /settings/scheduled-jobs
- Naixer KDS: /settings/integrations/naixer
- Permissions: /settings/permissions
- Custom Fields: /settings/custom-fields
- Bank Accounts: /settings/bank-accounts
- Workflow Editor: /settings/workflow-editor
- CMS Docs: /cms/docs

## Audit trail, correspondence, and evidence {perm=audit.view} {audience=management,developer}
Audit trail answers who changed what and when. Correspondence stores letters, evidence, and finance/legal/tax archives that are not always direct journal attachments.

### Step by step
1. Audit Trail can be filtered by entity, action, actor, date, and pagination.
1. Open audit detail to inspect before and after diff.
1. Use actions such as create, update, submit, approve, reject, post, close, void, refund, or delete for investigations.
1. Correspondence is used for incoming/outgoing letters, finance/tax/legal evidence, WhatsApp/email archive, owner, due date, priority, tags, and attachment.
1. For finance evidence, use classification finance and direction internal so it appears as transaction evidence register.
1. In correspondence detail, update status from registered, in progress, sent, closed, or archived according to lifecycle.
1. Journal attachments are still managed in journal detail; correspondence is the more general archive register.

### Control checks
- Audit is not a substitute for approval. Approval remains in workflow or module actions.
- Archive correspondence only for inactive documents that still must be retained.
- Report any important mutation without audit as a high-priority bug.

### Related pages
- Audit Trail: /audit
- Correspondence: /correspondence
- Finance Evidence: /correspondence?classification=finance&direction=internal
- Journals: /accounting/journals
`,
  zh: `
## ERP 页面地图与导航
左侧栏是 ERP 的主导航。各模块可以展开或折叠，侧栏可以收起，当前页面会用红色高亮。所有后台页面都需要员工登录；可见按钮和数据仍由账号权限决定。

### Step by step
1. 先进入 Dashboard，查看当前角色允许使用的快捷入口。
1. 打开 Accounting、Reporting、POS、Inventory、Purchasing、HR、CRM、Helpdesk、AI Assistant、CMS 或 Settings 等模块。
1. 如果页面或按钮缺失，请先在 Settings > Permissions 检查账号角色。
1. 在 Docs 阅读操作步骤，再通过 Related pages 直接进入相关页面。
1. 通过铃铛 Notifications 查看排班、工资、工单、审批、库存或服务中断通知。

### Control checks
- 不要借用他人账号打开菜单。
- 如果出现 404 或空页面，请在 Helpdesk 提交 URL 和发生时间。
- 修改账号语言后，如果标签未刷新，请退出并重新登录。

### Related pages
- Dashboard: /dashboard
- Account: /account
- Notifications: /notifications
- Permissions: /settings/permissions

## POS 进阶、订单、退款、顾客屏和手工结账 {perm=pos.transact}
正式 POS 用于真实顾客交易。POS Demo 只用于培训。销售渠道是 dine-in、take-away 或 delivery；现金、QRIS、银行卡和 Flazz 是付款方式。

### Step by step
1. 第一笔交易前先开班，班次结束后核对实体现金再关班。
1. 选择正确销售渠道，然后添加商品、规格、会员、顾客名、单品备注和必要的手工折扣。
1. 手工折扣必须填写原因。系统会保存审计并发送促销复核通知。
1. 点击 Pay Now，选择付款方式，使用全额或拆分付款，然后确认。启用时会显示捐赠或舍入选项。
1. 离线时，交易会保存在浏览器 outbox。不要清除浏览器数据；网络恢复后查看 pending sync 横幅并重试。
1. 打开 POS Orders 审核交易。Void 仅用于 open 订单；refund 用于 paid 订单，并必须填写原因和退回数量。
1. 从 POS 打开 Customer Display，确保顾客屏使用正确租户和门店。
1. Manual Sales 只用于历史销售汇总或手工结账，不替代实时 POS。
1. 在 POS Demo 中，Reset Demo 只清除演示订单；Exit Demo 会清除沙盒并返回正式 POS。

### Control checks
- 不得用 POS Demo 处理真实顾客交易。
- Void 不冲回凭证，因为订单尚未付款；refund 会影响凭证、库存和审计。
- 小票和标签打印页面调用浏览器打印。当前标签显示订单 QR 或取餐号，不是 Naixer API payload。
- Manual closing 不等同于正式 POS 的 BOM 自动扣料；大量手工录入后要复核库存。

### Related pages
- Production POS: /pos
- POS Orders: /pos/orders
- Manual Sales: /pos/manual-sales
- POS Demo: /pos/demo
- Customer Display: /display

## 库存明细：商品、物料、库存、BOM、调整和盘点 {perm=inventory.view}
库存模块区分可销售菜单、原料耗材、门店库存、配方 BOM、快速调整和库存盘点。正确的库存变动必须走系统流程，不能直接改数据库。

### Step by step
1. Inventory 默认打开 Products。Products 用于 POS 中销售的菜单商品。
1. Supplies 用于茶叶、柠檬、杯子、吸管等原料和耗材。
1. 在 New Product 或商品详情中填写 SKU、分类、类型、单位、售价、成本、保质期、可销售/可采购、批次、效期和图片。
1. 在商品详情中用 Variant Manager 管理大小、冷热或价格规格。
1. Categories 用于维护简单分类。仍被商品使用的分类不能随意删除。
1. Stock by Outlet 是只读页面。库存更正通过 Opname 或 Adjust 进行。
1. 在 Adjust 中输入调整后的最终数量，不是差额。选择原因并填写可审计备注。
1. 在 Recipes 中创建成品 BOM，添加原料、数量、单位，并只对需要销售后自动扣减的原料启用 auto-deduct。
1. 在 Stock Opname 中创建盘点会话，输入实盘数量，提交后审批。审批时生成库存调整凭证。
1. Variance report 用于盘点后的差异分析，不用于修改库存。

### Control checks
- 停用商品不能用于新交易。
- BOM 缺失会降低 COGS 准确性，也会影响自动扣料。
- 全量盘点每月执行；茶叶和柠檬按 SOP 更频繁检查。
- 大额调整必须有运营原因并由管理层复核。

### Related pages
- Products: /inventory/products
- New Product: /inventory/products/new
- Supplies: /inventory/supplies
- Categories: /inventory/categories
- Stock by Outlet: /inventory/stock
- Recipes: /inventory/recipes
- Quick Adjust: /inventory/adjust
- Stock Opname: /inventory/opname
- Inventory Variance: /inventory/variance

## 采购明细：PO、GRN、退货和物流跟踪 {perm=purchasing.view}
采购模块记录供应商、采购订单、收货、采购退货和物流跟踪。PO 不增加库存；确认 GRN 后库存才增加。

### Step by step
1. 打开 Purchasing 查看 PO 列表、状态/日期筛选和供应商。
1. 日常采购前先新增或更新供应商资料。
1. 创建 PO，填写供应商、地点、日期、预计到货、商品、数量、单位、价格、税和备注。
1. PO 批准且货到后打开 PO 详情。只有 PO 仍可收货时才显示 GRN 表单。
1. 填写实收数量、批次、效期和收货备注。确认 GRN 会增加库存并形成采购记录。
1. 使用 GRN Report 按日期、地点和状态追踪收货历史。
1. 从已确认 GRN 创建 Purchase Return。当前表单要求输入 GRN ID，然后选择行、退货数量、单位成本、原因和备注。
1. 退货流程为 draft、submitted、approved、posted 或 cancelled。posted 和 cancelled 是终态。
1. 在 Shipments 填写 courier、AWB 和必要的手机号后 5 位，然后手动同步物流。

### Control checks
- BinderByte 跟踪结果会缓存。由于配额有限，不要无需要反复点击 sync。
- 实收与 PO 不一致时，必须在入库前记录差异。
- 已 posted 的采购退货会影响库存和会计。
- 页面没有 GRN export 按钮前，不要在指南中写有 GRN 导出。

### Related pages
- Purchasing: /purchasing
- New PO: /purchasing/po/new
- GRN Report: /purchasing/grn-report
- Purchase Returns: /purchasing/returns
- New Purchase Return: /purchasing/returns/new
- Shipments: /purchasing/shipments

## 会计明细：科目、凭证、期间、资产、零用金、报销和银行对账 {perm=accounting.view}
会计模块保护复式记账、凭证附件、期间、固定资产、零用金、报销和银行对账。重要变更必须有审计记录。

### Step by step
1. 在 COA 中使用搜索、类型筛选、展开/折叠、新增科目、编辑科目和带替代科目的安全删除。
1. 非可过账科目作为父级；停用科目不能用于新凭证，但历史保留。
1. 在 Journals 中使用 CSV 模板、CSV 导入、Excel 导出、状态筛选和 New Journal。
1. 创建手工凭证时填写过账日期、地点、说明、参考号、借贷行、往来单位、到期日、提醒和附件。
1. CSV 导入会生成凭证草稿。过账前要复核平衡和会计期间。
1. 凭证详情用于查看分录和附件。如果看不到 posting 或 reverse 按钮，请使用现有角色/服务流程，并在需要 UI 时提交需求。
1. 在 Periods 中，确认本月凭证完成后再关账。Force close 可能留下未过账草稿。
1. Payables 和 Receivables 读取已过账凭证。科目映射、到期日、提醒和坏账准备率会影响账龄。
1. Fixed Assets 用于资产台账、类别设置、科目映射和折旧运行。
1. Petty Cash 用于门店零用金、小额支出、补款、存入银行和交易筛选。
1. Reimbursement 经过 draft、submitted、approved、rejected 和 disbursed，并需要附件证据。
1. Bank Reconciliation 先配置银行账户，再导入或手工输入银行流水，匹配/取消匹配，查看建议并 finalize。

### Control checks
- 借方和贷方合计必须相等。
- 不得向已关闭期间过账，除非有 reopening approval 或更正凭证。
- WhatsApp/email 中的交易证据必须进入 Correspondence 或凭证附件，不能只留在私人聊天。
- finalize 前要处理每条银行流水；未匹配项必须有明确处理方式。
- 重要零用金补款和报销需要按内部流程审批。

### Related pages
- COA: /accounting/coa
- Journals: /accounting/journals
- New Journal: /accounting/journals/new
- Import Journals: /accounting/journals/import
- Periods: /accounting/periods
- Fixed Assets: /accounting/assets
- Payables: /accounting/payables
- Receivables: /accounting/receivables
- Petty Cash: /accounting/petty-cash
- Reimbursement: /accounting/reimbursement
- Bank Reconciliation: /accounting/bank-recon
- Bank Accounts: /settings/bank-accounts

## 报表与管理分析 {perm=reporting.view}
报表读取已过账和运营数据，用于关账、税务、排班、毛利、损耗和管理决策。

### Step by step
1. Business Intelligence 展示管理 KPI，用于趋势观察，不是最终税务文件。
1. Trial Balance 使用 as-of 日期和地点检查科目余额。
1. Balance Sheet 展示财务状况和 balanced/not balanced 标识。如不平衡，检查已过账凭证和科目映射。
1. Profit Loss 使用 from/to 期间和地点读取收入、COGS、费用和净利润。
1. Cash Flow 使用已过账凭证和科目分类。如果按钮写 XLSX 但生成 CSV，请以实际生成文件为准，直到 UI 修正。
1. Aging Receivables 和 Aging Payables 使用到期日。如账龄不正确，从 party ledger 修正 due date。
1. Daily Summary 支持日结 SOP：总销售、付款方式、热销商品、班次和同期比较。
1. Hourly Sales 用于排班和高峰时段分析；可按 channel 或 day 分组。
1. Donations 用于捐赠/舍入对账。
1. Omzet Harian 用于税务营业额汇总：gross、PB1、net、adjustment、note 和 Excel 导出。
1. COGS report 需要 BOM。展开行查看原料和毛利；负毛利必须复核。
1. Waste report 读取 waste、damage、spoil、stale、expired 等库存调整原因。

### Control checks
- 最终财务报表必须在期间和凭证复核后才有效。
- 导出文件是工作资料，仍需与证据和税务规则核对。
- 税务营业额调整必须有明确原因。
- BOM 或成本缺失会导致 COGS 和毛利不准确。

### Related pages
- Business Intelligence: /reporting/business-intelligence
- Trial Balance: /reporting/trial-balance
- Balance Sheet: /reporting/balance-sheet
- Profit Loss: /reporting/profit-loss
- Cash Flow: /reporting/cash-flow
- Aging Receivables: /reporting/aging-receivables
- Aging Payables: /reporting/aging-payables
- Daily Summary: /reporting/daily-summary
- Hourly Sales: /reporting/hourly-sales
- Donations: /reporting/donations
- Omzet Harian: /reporting/omzet-harian
- COGS: /reporting/cogs
- Waste: /reporting/waste

## 税率与税务规则 {perm=tax.view}
税务模块管理税率和适用规则。零售 PB1/PBJT 为含税。零售销项 PPN 默认关闭，但引擎可支持 B2B 或其他税务需求。

### Step by step
1. Tax 默认打开 Tax Rates。
1. 在 Tax Rates 中新增或编辑税码、名称、税率百分比、inclusive/exclusive、过账科目、生效日期和 active 状态。
1. 在 Tax Rules 中选择 global、channel、customer、product category 或其他可用范围。
1. 设置 priority，让更具体的规则优先于一般规则。
1. 用 effective date 处理税率变化，避免历史交易被改写。
1. 启用重要规则前，复核对 POS、采购和税务导出的影响。

### Control checks
- 不要在 source code 中硬编码税率。
- 零售 PB1/PBJT 不在菜单价上另加。
- 规则过宽会让所有交易套用错误税；规则过窄会让重要交易漏税。

### Related pages
- Tax Rates: /tax/rates
- Tax Rules: /tax/rules
- Omzet Harian: /reporting/omzet-harian

## HR 明细：员工、排班、考勤、请假、工资、SOP 和举报 {perm=hr.view}
HR 保存员工、班次、GPS 考勤、请假、工资、警告、SOP、招聘和违规举报。个人数据必须按权限限制。

### Step by step
1. HR 默认打开 Employees。使用搜索、状态/地点筛选、XLSX 导出、新增员工和详情。
1. 新增员工时填写身份、工作、税务/BPJS、可选登录账号、角色、地点范围和初始密码。
1. Schedule 用于周排班。使用上一周/下一周、地点筛选、点击班次、OFF 或 swap。换班必须填写原因，并通知相关员工。
1. Check In 需要 GPS 和已配置的门店位置。如果 GPS 失败，请重试并带截图报告。
1. Attendance 供管理员查看考勤、按员工/日期筛选，并带原因豁免迟到。
1. My Attendance 供员工查看自己的考勤、迟到和工时。
1. Leave 区分请假类型管理、请假申请、批准/拒绝、删除和余额。
1. Payroll 按期间和地点生成，前提是已复核考勤、奖金、扣款、BPJS 和 PPh 21。
1. Payroll detail 经过 draft、approved、paid，并在可用时显示凭证链接。
1. My Payslips 供员工查看和打印工资单。
1. Disciplinary 管理 SP1、SP2、SP3、附件、发布和确认。
1. Recruitment 经过 opening、applicant、screening、interview、offer、hired 或 rejected。
1. SOP 保存最终文档、draft/published 状态、下载和归档。
1. Whistleblower form 用于匿名举报。管理员用 open、investigating 和 resolved 状态处理。

### Control checks
- KTP、NPWP、电话、工资和合同数据不得在授权角色外分享。
- 迟到豁免会影响工资，必须有原因。
- 每月 8 日发薪前必须复核 payroll。
- 已发布 SOP 必须是最终版，并方便门店打开。

### Related pages
- Employees: /hr/employees
- New Employee: /hr/employees/new
- Schedule: /hr/schedule
- Check In: /hr/checkin
- Attendance: /hr/attendance
- My Attendance: /hr/my-attendance
- Leave: /hr/leave
- Payroll: /hr/payroll
- My Payslips: /hr/my-payslips
- Disciplinary: /hr/disciplinary
- Recruitment: /hr/recruitment
- SOP: /hr/sop
- Whistleblower Form: /whistleblower
- Whistleblower Reports: /hr/whistleblower

## CRM、积分和会员门户 {perm=crm.member.view}
CRM Members 用于查看会员、等级、积分历史和积分修正。公共会员门户账号与员工 ERP 账号不同。

### Step by step
1. 打开 CRM Members，按姓名、城市、等级和分页搜索会员。
1. 打开会员详情，查看资料、等级、积分余额、累计积分和近期积分交易。
1. Adjust points 仅用于运营更正。填写 delta 和明确原因。
1. Loyalty Settings 配置每积分对应金额和等级。用于等级计算的 lifetime points 只增加。
1. 公共会员从网站注册，同意隐私政策，通过 Turnstile，然后验证 OTP。
1. 会员登录门户查看余额、历史、券和可用时的会员 QR 或身份。
1. 收银时仍按注册手机号查找会员，并向顾客确认姓名。

### Control checks
- 不得无原因修正积分。
- 公共会员账号不是员工 ERP 账号。
- OTP 过期后必须重新走验证流程，不能无审计手工激活。
- 会员删除请求必须遵守隐私政策和 PDP 合规。

### Related pages
- CRM Members: /crm/members
- Loyalty Settings: /settings/loyalty
- Member Registration: /id/member/daftar
- Member Login: /id/member/masuk
- Member Account: /id/member/akun

## Helpdesk、通知和 AI Assistant
Helpdesk 是 bug 报告和支持的正式渠道。AI Assistant 可以读取允许的数据、OCR 小票并创建操作草稿，但数据变更仍需用户确认。

### Step by step
1. 当 bug、运营问题或支持请求需要跟踪时，从 Helpdesk New 创建工单。
1. 填写 subject、priority、category、body、URL、时间、账号、地点、最后一步、截图和错误信息。
1. 在工单详情中，处理人可将状态改为 open、in progress、resolved、closed 或重新 open。
1. 普通回复对报告人可见。Internal note 仅处理人可见。
1. Notifications 显示用户收件箱。处理后可 mark read 或 mark all read。
1. Notification settings 配置 email/WhatsApp/Telegram 频道和 outage、stock alert 或 all 等 purpose。
1. AI Assistant 用于数据问题、允许的文件读取、小票 OCR、manual sale 草稿或 ticket 草稿。
1. 如果 AI 创建 Confirm Action Card，请先核对详情，再 confirm 或 cancel。AI 不得未经确认直接变更数据。
1. AI Assistant Log 供管理员审计 tool call、draft、user、entity 和调查。

### Control checks
- 重要 bug 不要只留在私人聊天，必须创建 ticket。
- 如果 AI 草稿的数据、地点、金额或日期不正确，不要确认。
- 需要互联网信息时，AI web search 必须由用户明确开启。
- outage/stock 通知必须有 active 接收人。

### Related pages
- Helpdesk: /helpdesk
- New Ticket: /helpdesk/new
- Notifications: /notifications
- Notification Settings: /settings/notifications
- AI Assistant: /ai-assistant
- AI Assistant Log: /settings/ai-assistant/log

## CMS、公共网站和指南编辑器 {perm=cms.manage} {audience=management,developer}
CMS 管理公共页面、博客/促销/活动文章，以及运行时 ERP 指南。CMS 变更应检查所有相关语言。

### Step by step
1. CMS 默认打开 Pages。
1. Pages 管理 CMS 驱动的公共网站页面。请区分 source static route 和可编辑 CMS 页面。
1. 创建页面时填写 ID、EN、ZH 内容、slug、type、content、SEO、navbar 和可用图片。
1. 发布前必须检查 slug、内容、SEO 和公共链接。
1. Posts 用于 news、promo、recipe 或 event。填写 title、content、excerpt、tags、cover image、status 和 display order。
1. CMS Docs 修改 /docs 显示的指南。使用 markdown：## 标题、### 小节、1. 步骤和 - 清单。
1. Docs 标题可用 {perm=permission.code} 对无权限用户隐藏 section。
1. Docs 标题可用 {audience=staff,management,developer} 按受众过滤 section。
1. 发布后，如有对应内容，分别打开 ID、EN 和 ZH 公共 URL 检查。

### Control checks
- 不要创建与 static route 冲突的公共 slug。
- 图片必须相关，并且允许品牌使用。
- 如果数据库已有 erp_docs_content，source 中的指南变更不会自动显示。请在 CMS Docs 按语言刷新默认指南，或运行运维脚本。

### Related pages
- CMS Docs: /cms/docs
- CMS Pages: /cms/pages
- New CMS Page: /cms/pages/new
- CMS Posts: /cms/posts
- New CMS Post: /cms/posts/new
- Docs: /docs

## Settings、Naixer 集成、权限、自定义字段和指南刷新 {perm=settings.manage} {audience=management,developer}
Settings 保存无需改 source 即可调整的运营配置。配置变更应使用受影响角色和地点进行测试。

### Step by step
1. Locations 配置门店/办公室、状态、地址和考勤 GPS。
1. POS Settings 配置 PB1 tax code、现金/结算科目、收入科目、捐赠科目、外卖渠道、佣金/net bps、小票宽度和打印机 profile。
1. Promotions 配置启用的促销、条件、权益、优先级和审批。
1. Attendance Policy 配置迟到罚款、每月免迟到次数和旷工罚款，并影响工资。
1. Scheduled Jobs 配置备份、工资、库存提醒、ISR 和其他任务。
1. Naixer KDS 是 QR-only。Aroadri 默认 Format B dash；Format A pipe 是备用。商品/规格 mapping 不是 API integration。
1. Permissions 管理角色和权限矩阵。变更后，用户应退出再登录以确认新权限。
1. Custom Fields 可为支持的 entity 增加数据库驱动字段，无需 source migration。
1. Bank Accounts 是银行对账和银行科目映射的前提。
1. Workflow Editor 无需改 source 即可配置审批规则。
1. 要替换数据库中已有指南内容，请打开 CMS Docs，选择要从系统默认替换的语言，然后刷新默认。其他语言会保留。
1. 运维替代方式：备份后，在服务器或 staging 使用 --locales id,en,zh 和 --apply 运行指南刷新脚本。

### Control checks
- 不要在 workflow、custom field 或 docs 中保存 secret、密码或 API token。
- 大的配置变更要用申请人和审批人账号测试。
- 当供应商有配额时，不要反复触发 Naixer preview 或 shipment sync。
- 默认指南刷新会覆盖所选语言。先保存重要手工编辑，或只刷新确实要替换的语言。

### Related pages
- Locations: /settings/locations
- POS Settings: /settings/pos
- Promotions: /settings/promotions
- Attendance Policy: /settings/attendance
- Scheduled Jobs: /settings/scheduled-jobs
- Naixer KDS: /settings/integrations/naixer
- Permissions: /settings/permissions
- Custom Fields: /settings/custom-fields
- Bank Accounts: /settings/bank-accounts
- Workflow Editor: /settings/workflow-editor
- CMS Docs: /cms/docs

## 审计、信件和证据 {perm=audit.view} {audience=management,developer}
Audit Trail 回答谁在何时修改了什么。Correspondence 保存信件、证据和财务/法律/税务归档，不一定都是凭证附件。

### Step by step
1. Audit Trail 可按 entity、action、actor、日期和分页筛选。
1. 打开审计详情查看 before 和 after diff。
1. 调查时关注 create、update、submit、approve、reject、post、close、void、refund 或 delete 等 action。
1. Correspondence 用于来往信件、财务/税务/法律证据、WhatsApp/email 归档、owner、due date、priority、tags 和附件。
1. 财务证据请使用 classification finance 和 direction internal，使其进入 transaction evidence register。
1. 在 correspondence 详情中，根据生命周期更新 registered、in progress、sent、closed 或 archived 状态。
1. 凭证附件仍在 journal detail 管理；correspondence 是更通用的归档登记。

### Control checks
- 审计不能替代审批。审批仍在 workflow 或相关模块中执行。
- 只有不再活跃但仍需保留的文件才应 archive。
- 如果重要变更没有审计记录，应作为高优先级 bug 报告。

### Related pages
- Audit Trail: /audit
- Correspondence: /correspondence
- Finance Evidence: /correspondence?classification=finance&direction=internal
- Journals: /accounting/journals
`,
};
