/**
 * IAM Seed — default tenant, locations, roles, permissions
 * SOURCE-OF-TRUTH §3.2, §15.1
 */

import type { LocaleString } from '@erp/shared/types';

const n = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });

// === TENANT ===
export const DEFAULT_TENANT = {
  id: 'default',
  name: 'PT Gandha Hill Catering Management Indonesia',
  localeDefault: 'id',
};

// === LOCATIONS — SoT §15.1 ===
export const LOCATIONS_SEED = [
  {
    code: 'MLI',
    name: n(
      'Aroadri Tea Malioboro Mall',
      'Aroadri Tea Malioboro Mall',
      'Aroadri Tea Malioboro Mall',
    ),
    type: 'store' as const,
    address:
      'Malioboro Mall, Jl. Mataram No. 31, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
  },
  {
    code: 'PLZ',
    name: n(
      'Aroadri Tea Plaza Malioboro',
      'Aroadri Tea Plaza Malioboro',
      'Aroadri Tea Plaza Malioboro',
    ),
    type: 'store' as const,
    address:
      'Plaza Malioboro, Jl. Malioboro No. 52-58, Suryatmajan, Danurejan, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55213',
  },
  {
    code: 'YOG-OFC',
    name: n('Kantor Yogyakarta', 'Yogyakarta Office', '日惹办公室'),
    type: 'office' as const,
    address: 'Yogyakarta, Daerah Istimewa Yogyakarta',
  },
  {
    code: 'JKT-OFC',
    name: n('Kantor Jakarta', 'Jakarta Office', '雅加达办公室'),
    type: 'office' as const,
    address: 'Jakarta, Indonesia',
  },
];

export const LEGACY_INACTIVE_LOCATION_CODES = ['JKT', 'YOG'];

// === ROLES — SoT §3.2 ===
export const ROLES_SEED = [
  { code: 'director', name: n('Direktur', 'Director', '总监') },
  { code: 'vice_director', name: n('Wakil Direktur', 'Vice Director', '副总监') },
  { code: 'management', name: n('Manajemen', 'Management', '管理层') },
  { code: 'accountant', name: n('Akuntan / Keuangan', 'Accountant / Finance', '会计/财务') },
  { code: 'store_manager', name: n('Kepala Toko', 'Store Manager', '店长') },
  { code: 'cashier', name: n('Kasir', 'Cashier', '收银员') },
  { code: 'assistant', name: n('Asisten', 'Assistant', '助理') },
];

// === PERMISSIONS — grouped by module, with multilingual descriptions ===
export const PERMISSIONS_SEED = [
  // System wildcard
  {
    code: '*.*',
    module: 'system',
    description: n('Akses penuh seluruh sistem', 'Full system access', '完整系统访问权限'),
  },
  // IAM
  {
    code: 'iam.manage_users',
    module: 'iam',
    description: n(
      'Kelola pengguna (buat/ubah/nonaktifkan)',
      'Manage users (create/edit/deactivate)',
      '管理用户（创建/编辑/停用）',
    ),
  },
  {
    code: 'iam.manage_roles',
    module: 'iam',
    description: n(
      'Kelola role dan hak akses',
      'Manage roles and access rights',
      '管理角色和访问权限',
    ),
  },
  {
    code: 'iam.manage_permissions',
    module: 'iam',
    description: n('Atur permission per role', 'Set permissions per role', '设置每个角色的权限'),
  },
  {
    code: 'iam.manage_locations',
    module: 'iam',
    description: n('Kelola lokasi/outlet', 'Manage locations/outlets', '管理地点/门店'),
  },
  // Accounting
  {
    code: 'accounting.view',
    module: 'accounting',
    description: n('Lihat data akuntansi', 'View accounting data', '查看会计数据'),
  },
  {
    code: 'accounting.journal.create',
    module: 'accounting',
    description: n('Buat jurnal baru', 'Create new journal entry', '创建新日记账'),
  },
  {
    code: 'accounting.journal.post',
    module: 'accounting',
    description: n('Posting jurnal ke buku besar', 'Post journal to ledger', '将日记账过账到总账'),
  },
  {
    code: 'accounting.journal.reverse',
    module: 'accounting',
    description: n(
      'Balik jurnal yang sudah posting',
      'Reverse posted journal',
      '冲销已过账的日记账',
    ),
  },
  {
    code: 'accounting.period.open',
    module: 'accounting',
    description: n('Buka periode akuntansi', 'Open accounting period', '打开会计期间'),
  },
  {
    code: 'accounting.period.close',
    module: 'accounting',
    description: n('Tutup periode akuntansi', 'Close accounting period', '关闭会计期间'),
  },
  {
    code: 'accounting.coa.manage',
    module: 'accounting',
    description: n('Kelola chart of accounts', 'Manage chart of accounts', '管理会计科目表'),
  },
  {
    code: 'accounting.reports',
    module: 'accounting',
    description: n('Lihat laporan keuangan', 'View financial reports', '查看财务报表'),
  },
  {
    code: 'accounting.petty_cash.view',
    module: 'accounting',
    description: n('Lihat kas kecil', 'View petty cash', '查看零用金'),
  },
  {
    code: 'accounting.petty_cash.expense',
    module: 'accounting',
    description: n('Catat pengeluaran kas kecil', 'Record petty cash expense', '记录零用金支出'),
  },
  {
    code: 'accounting.petty_cash.replenish',
    module: 'accounting',
    description: n('Isi ulang kas kecil', 'Replenish petty cash', '补充零用金'),
  },
  {
    code: 'accounting.petty_cash.manage',
    module: 'accounting',
    description: n(
      'Kelola kas kecil (buat/tutup)',
      'Manage petty cash (create/close)',
      '管理零用金（创建/关闭）',
    ),
  },
  {
    code: 'accounting.reimbursement.create',
    module: 'accounting',
    description: n('Ajukan reimbursement', 'Submit reimbursement', '提交报销'),
  },
  {
    code: 'accounting.reimbursement.approve',
    module: 'accounting',
    description: n('Setujui reimbursement', 'Approve reimbursement', '批准报销'),
  },
  {
    code: 'accounting.reimbursement.disburse',
    module: 'accounting',
    description: n('Cairkan reimbursement', 'Disburse reimbursement', '发放报销'),
  },
  {
    code: 'accounting.reimbursement.view',
    module: 'accounting',
    description: n('Lihat data reimbursement', 'View reimbursement data', '查看报销数据'),
  },
  {
    code: 'accounting.fixed_asset.view',
    module: 'accounting',
    description: n('Lihat daftar aset tetap', 'View fixed asset register', '查看固定资产列表'),
  },
  {
    code: 'accounting.fixed_asset.manage',
    module: 'accounting',
    description: n('Kelola aset tetap', 'Manage fixed assets', '管理固定资产'),
  },
  {
    code: 'accounting.fixed_asset.depreciate',
    module: 'accounting',
    description: n(
      'Jalankan penyusutan aset tetap',
      'Run fixed asset depreciation',
      '运行固定资产折旧',
    ),
  },
  {
    code: 'accounting.bank_recon.view',
    module: 'accounting',
    description: n('Lihat rekonsiliasi bank', 'View bank reconciliation', '查看银行对账'),
  },
  {
    code: 'accounting.bank_recon.manage',
    module: 'accounting',
    description: n('Kelola rekonsiliasi bank', 'Manage bank reconciliation', '管理银行对账'),
  },
  // Tax
  {
    code: 'tax.view',
    module: 'tax',
    description: n('Lihat data pajak', 'View tax data', '查看税务数据'),
  },
  {
    code: 'tax.manage_rates',
    module: 'tax',
    description: n('Kelola tarif pajak', 'Manage tax rates', '管理税率'),
  },
  {
    code: 'tax.export',
    module: 'tax',
    description: n('Export laporan pajak', 'Export tax reports', '导出税务报表'),
  },
  // POS
  {
    code: 'pos.transact',
    module: 'pos',
    description: n('Buat transaksi POS', 'Create POS transaction', '创建POS交易'),
  },
  {
    code: 'pos.void',
    module: 'pos',
    description: n('Void/batalkan transaksi', 'Void transaction', '作废交易'),
  },
  {
    code: 'pos.refund',
    module: 'pos',
    description: n('Refund transaksi', 'Refund transaction', '退款交易'),
  },
  {
    code: 'pos.demo.use',
    module: 'pos',
    description: n('Gunakan mode demo POS', 'Use POS demo mode', '使用POS演示模式'),
  },
  {
    code: 'pos.shift.open',
    module: 'pos',
    description: n('Buka shift kasir', 'Open cashier shift', '开启收银班次'),
  },
  {
    code: 'pos.shift.close',
    module: 'pos',
    description: n('Tutup shift kasir', 'Close cashier shift', '关闭收银班次'),
  },
  // Promotion
  {
    code: 'promotion.view',
    module: 'promotion',
    description: n('Lihat promosi', 'View promotions', '查看促销'),
  },
  {
    code: 'promotion.manage',
    module: 'promotion',
    description: n(
      'Kelola promosi (buat/ubah/nonaktifkan)',
      'Manage promotions (create/edit/deactivate)',
      '管理促销（创建/编辑/停用）',
    ),
  },
  // Inventory
  {
    code: 'inventory.view',
    module: 'inventory',
    description: n('Lihat stok & inventaris', 'View stock & inventory', '查看库存'),
  },
  {
    code: 'inventory.product.read',
    module: 'inventory',
    description: n('Lihat produk', 'View products', '查看产品'),
  },
  {
    code: 'inventory.product.create',
    module: 'inventory',
    description: n('Buat produk baru', 'Create new product', '创建新产品'),
  },
  {
    code: 'inventory.product.update',
    module: 'inventory',
    description: n('Ubah produk', 'Update product', '修改产品'),
  },
  {
    code: 'inventory.product.delete',
    module: 'inventory',
    description: n(
      'Hapus permanen produk yang belum pernah digunakan',
      'Permanently delete unused products',
      '永久删除未使用产品',
    ),
  },
  {
    code: 'inventory.category.read',
    module: 'inventory',
    description: n('Lihat kategori produk', 'View product categories', '查看产品分类'),
  },
  {
    code: 'inventory.category.create',
    module: 'inventory',
    description: n('Buat kategori produk', 'Create product category', '创建产品分类'),
  },
  {
    code: 'inventory.category.update',
    module: 'inventory',
    description: n('Ubah kategori produk', 'Update product category', '修改产品分类'),
  },
  {
    code: 'inventory.adjust',
    module: 'inventory',
    description: n('Penyesuaian stok', 'Stock adjustment', '库存调整'),
  },
  {
    code: 'inventory.transfer',
    module: 'inventory',
    description: n('Transfer stok antar outlet', 'Transfer stock between outlets', '门店间调拨'),
  },
  {
    code: 'inventory.writeoff',
    module: 'inventory',
    description: n('Write-off / hapus stok', 'Write-off stock', '库存报废'),
  },
  {
    code: 'inventory.adjust.approve',
    module: 'inventory',
    description: n('Setujui penyesuaian stok', 'Approve stock adjustments', '批准库存调整'),
  },
  {
    code: 'inventory.opname',
    module: 'inventory',
    description: n('Kelola stock opname', 'Manage stock opname', '管理库存盘点'),
  },
  {
    code: 'inventory.opname.approve',
    module: 'inventory',
    description: n('Setujui stock opname', 'Approve stock opname', '批准库存盘点'),
  },
  // Purchasing
  {
    code: 'purchasing.view',
    module: 'purchasing',
    description: n('Lihat data pembelian', 'View purchasing data', '查看采购数据'),
  },
  {
    code: 'purchasing.po.create',
    module: 'purchasing',
    description: n('Buat purchase order', 'Create purchase order', '创建采购订单'),
  },
  {
    code: 'purchasing.po.approve',
    module: 'purchasing',
    description: n('Setujui purchase order', 'Approve purchase order', '批准采购订单'),
  },
  {
    code: 'purchasing.grn.create',
    module: 'purchasing',
    description: n('Catat penerimaan barang', 'Record goods received', '记录收货'),
  },
  {
    code: 'purchasing.return.create',
    module: 'purchasing',
    description: n('Buat retur pembelian', 'Create purchase return', '创建采购退货'),
  },
  {
    code: 'purchasing.return.approve',
    module: 'purchasing',
    description: n('Setujui retur pembelian', 'Approve purchase return', '批准采购退货'),
  },
  {
    code: 'purchasing.return.post',
    module: 'purchasing',
    description: n(
      'Posting jurnal retur pembelian',
      'Post purchase-return journal',
      '过账采购退货分录',
    ),
  },
  {
    code: 'crm.member.view',
    module: 'crm',
    description: n('Lihat data member', 'View member data', '查看会员数据'),
  },
  {
    code: 'crm.member.adjustPoints',
    module: 'crm',
    description: n('Penyesuaian poin loyalitas member', 'Adjust loyalty points', '调整会员积分'),
  },
  // Helpdesk — T-0184
  {
    code: 'helpdesk.create',
    module: 'helpdesk',
    description: n('Buat tiket helpdesk', 'Create helpdesk ticket', '创建工单'),
  },
  {
    code: 'helpdesk.view',
    module: 'helpdesk',
    description: n('Lihat tiket sendiri', 'View own tickets', '查看自己的工单'),
  },
  {
    code: 'helpdesk.handle',
    module: 'helpdesk',
    description: n('Tangani semua tiket', 'Handle all tickets', '处理所有工单'),
  },
  // HR
  {
    code: 'hr.view',
    module: 'hr',
    description: n('Lihat data HR', 'View HR data', '查看人事数据'),
  },
  {
    code: 'hr.employee.read',
    module: 'hr',
    description: n('Lihat data karyawan', 'View employee data', '查看员工数据'),
  },
  {
    code: 'hr.employee.write',
    module: 'hr',
    description: n('Edit data karyawan', 'Edit employee data', '编辑员工数据'),
  },
  {
    code: 'hr.manage_employees',
    module: 'hr',
    description: n(
      'Kelola karyawan (onboard/offboard)',
      'Manage employees (onboard/offboard)',
      '管理员工（入职/离职）',
    ),
  },
  {
    code: 'hr.whistleblower.read',
    module: 'hr',
    description: n('Lihat laporan whistleblower', 'View whistleblower reports', '查看举报人报告'),
  },
  {
    code: 'hr.manage_attendance',
    module: 'hr',
    description: n('Kelola presensi', 'Manage attendance', '管理考勤'),
  },
  {
    code: 'hr.attendance.read',
    module: 'hr',
    description: n('Lihat data presensi', 'View attendance data', '查看考勤数据'),
  },
  {
    code: 'hr.attendance.write',
    module: 'hr',
    description: n('Catat presensi', 'Record attendance', '记录考勤'),
  },
  {
    code: 'hr.approve_leave',
    module: 'hr',
    description: n('Setujui cuti', 'Approve leave', '批准休假'),
  },
  {
    code: 'hr.disciplinary.read',
    module: 'hr',
    description: n('Lihat data SP/disiplin', 'View disciplinary data', '查看纪律数据'),
  },
  {
    code: 'hr.disciplinary.write',
    module: 'hr',
    description: n('Buat/kelola SP', 'Create/manage warnings', '创建/管理警告'),
  },
  // SOP (User Req 2 — 2026-05-24)
  {
    code: 'hr.sop.read',
    module: 'hr',
    description: n('Lihat dokumen SOP perusahaan', 'View company SOP documents', '查看公司SOP文件'),
  },
  {
    code: 'hr.sop.manage',
    module: 'hr',
    description: n(
      'Unggah / edit / arsipkan SOP',
      'Upload / edit / archive SOPs',
      '上传/编辑/归档SOP',
    ),
  },
  // AI assistant (User Req 1 — 2026-05-24)
  {
    code: 'ai.assistant.use',
    module: 'ai',
    description: n(
      'Gunakan AI asisten (chat + tools terbatas RBAC)',
      'Use the AI assistant (chat + RBAC-gated tools)',
      '使用AI助手（受RBAC限制的聊天和工具）',
    ),
  },
  {
    code: 'ai.assistant.admin',
    module: 'ai',
    description: n(
      'Lihat semua percakapan AI lintas pengguna + konfigurasi',
      'View every AI conversation across users + configure',
      '查看跨用户的所有AI对话及配置',
    ),
  },
  // Payroll
  {
    code: 'hr.payroll.write',
    module: 'payroll',
    description: n('Proses penggajian', 'Process payroll', '处理工资'),
  },
  {
    code: 'hr.payroll.approve',
    module: 'payroll',
    description: n('Setujui payroll', 'Approve payroll', '批准工资'),
  },
  // CRM
  {
    code: 'crm.view',
    module: 'crm',
    description: n('Lihat data CRM', 'View CRM data', '查看CRM数据'),
  },
  {
    code: 'crm.manage_members',
    module: 'crm',
    description: n('Kelola data member', 'Manage member data', '管理会员数据'),
  },
  {
    code: 'crm.logComplaint',
    module: 'crm',
    description: n('Catat keluhan', 'Log complaint', '记录投诉'),
  },
  {
    code: 'crm.listComplaints',
    module: 'crm',
    description: n('Lihat daftar keluhan', 'View complaint list', '查看投诉列表'),
  },
  {
    code: 'crm.resolveComplaint',
    module: 'crm',
    description: n('Selesaikan keluhan', 'Resolve complaint', '解决投诉'),
  },
  {
    code: 'crm.awardCompensation',
    module: 'crm',
    description: n('Berikan kompensasi', 'Award compensation', '给予补偿'),
  },
  // Correspondence / letter register
  {
    code: 'correspondence.view',
    module: 'correspondence',
    description: n('Lihat surat menyurat', 'View correspondence', '查看信函记录'),
  },
  {
    code: 'correspondence.create',
    module: 'correspondence',
    description: n('Catat surat baru', 'Create correspondence', '创建信函记录'),
  },
  {
    code: 'correspondence.update',
    module: 'correspondence',
    description: n('Ubah surat menyurat', 'Update correspondence', '更新信函记录'),
  },
  {
    code: 'correspondence.delete',
    module: 'correspondence',
    description: n(
      'Arsipkan atau hapus surat',
      'Archive or delete correspondence',
      '归档或删除信函',
    ),
  },
  // Member
  {
    code: 'member.signup',
    module: 'member',
    description: n('Pendaftaran member (publik)', 'Member signup (public)', '会员注册（公开）'),
  },
  // Settings
  {
    code: 'settings.manage',
    module: 'settings',
    description: n('Kelola pengaturan sistem', 'Manage system settings', '管理系统设置'),
  },
  {
    code: 'settings.bank_accounts.manage',
    module: 'settings',
    description: n('Kelola akun bank', 'Manage bank accounts', '管理银行账户'),
  },
  // Workflow
  {
    code: 'workflow.approve',
    module: 'workflow',
    description: n('Setujui workflow', 'Approve workflow', '批准工作流'),
  },
  {
    code: 'workflow.view',
    module: 'workflow',
    description: n('Lihat workflow', 'View workflow', '查看工作流'),
  },
  // Kitchen
  {
    code: 'kitchen.view',
    module: 'kitchen',
    description: n('Lihat KDS / dapur', 'View KDS / kitchen', '查看厨房显示'),
  },
  // Reporting
  {
    code: 'reporting.view',
    module: 'reporting',
    description: n('Lihat laporan', 'View reports', '查看报表'),
  },
  {
    code: 'reporting.export',
    module: 'reporting',
    description: n('Export laporan', 'Export reports', '导出报表'),
  },
  // Audit
  {
    code: 'audit.view',
    module: 'audit',
    description: n('Lihat audit trail', 'View audit trail', '查看审计日志'),
  },
  // CMS
  {
    code: 'cms.manage',
    module: 'cms',
    description: n('Kelola konten website', 'Manage website content', '管理网站内容'),
  },
  // Docs (in-app operations manual)
  {
    code: 'docs.view',
    module: 'docs',
    description: n('Lihat panduan operasi', 'View operations docs', '查看操作指南'),
  },
  {
    code: 'docs.edit',
    module: 'docs',
    description: n('Ubah panduan operasi', 'Edit operations docs', '编辑操作指南'),
  },
];

// === ROLE → PERMISSION MAPPING (SoT §3.2 + §3.4) ===
export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  director: PERMISSIONS_SEED.map((p) => p.code), // all permissions
  vice_director: PERMISSIONS_SEED.map((p) => p.code), // all permissions (delegated from director)
  management: [
    'accounting.view',
    'accounting.reports',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.petty_cash.replenish',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'accounting.fixed_asset.view',
    'accounting.bank_recon.view',
    'accounting.bank_recon.manage',
    'settings.bank_accounts.manage',
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
    'inventory.view',
    'inventory.product.read',
    'inventory.product.create',
    'inventory.product.update',
    'inventory.product.delete',
    'inventory.category.read',
    'inventory.category.create',
    'inventory.category.update',
    'inventory.adjust',
    'inventory.opname',
    'inventory.transfer',
    'purchasing.view',
    'purchasing.po.create',
    'purchasing.grn.create',
    'purchasing.return.create',
    'purchasing.return.approve',
    'purchasing.return.post',
    'crm.member.view',
    'crm.member.adjustPoints',
    'helpdesk.create',
    'helpdesk.view',
    'helpdesk.handle',
    'hr.view',
    'hr.employee.read',
    'hr.employee.write',
    'hr.manage_attendance',
    'hr.attendance.read',
    'hr.attendance.write',
    'hr.disciplinary.read',
    'hr.disciplinary.write',
    'hr.sop.read',
    'hr.sop.manage',
    'ai.assistant.use',
    'kitchen.view',
    'reporting.view',
    'reporting.export',
    'audit.view',
    'crm.view',
    'crm.logComplaint',
    'crm.listComplaints',
    'crm.resolveComplaint',
    'correspondence.view',
    'correspondence.create',
    'correspondence.update',
    'correspondence.delete',
    'workflow.approve',
    'workflow.view',
    'docs.view',
    'docs.edit',
  ],
  accountant: [
    'accounting.view',
    'accounting.journal.create',
    'accounting.journal.post',
    'accounting.journal.reverse',
    'accounting.period.open',
    'accounting.period.close',
    'accounting.coa.manage',
    'accounting.reports',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.petty_cash.replenish',
    'accounting.petty_cash.manage',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'accounting.reimbursement.approve',
    'accounting.reimbursement.disburse',
    'accounting.fixed_asset.view',
    'accounting.fixed_asset.manage',
    'accounting.fixed_asset.depreciate',
    'accounting.bank_recon.view',
    'accounting.bank_recon.manage',
    'settings.bank_accounts.manage',
    'tax.view',
    'tax.manage_rates',
    'tax.export',
    'hr.view',
    'hr.employee.read',
    'hr.attendance.read',
    'hr.disciplinary.read',
    'correspondence.view',
    'correspondence.create',
    'correspondence.update',
    'reporting.view',
    'reporting.export',
    'audit.view',
    'hr.sop.read',
    'ai.assistant.use',
    'docs.view',
  ],
  store_manager: [
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
    'inventory.view',
    'inventory.product.read',
    'inventory.product.create',
    'inventory.product.update',
    'inventory.category.read',
    'inventory.category.create',
    'inventory.category.update',
    'inventory.adjust',
    'inventory.opname',
    'accounting.petty_cash.view',
    'accounting.petty_cash.expense',
    'accounting.reimbursement.view',
    'accounting.reimbursement.create',
    'hr.view',
    'hr.employee.read',
    'hr.manage_attendance',
    'hr.attendance.read',
    'hr.attendance.write',
    'hr.disciplinary.read',
    'hr.disciplinary.write',
    'hr.sop.read',
    'hr.sop.manage',
    'ai.assistant.use',
    'correspondence.view',
    'correspondence.create',
    'correspondence.update',
    'kitchen.view',
    'reporting.view',
    'docs.view',
    'docs.edit',
    'helpdesk.create',
    'helpdesk.view',
  ],
  cashier: [
    'pos.transact',
    'pos.void',
    'pos.refund',
    'pos.demo.use',
    'pos.shift.open',
    'pos.shift.close',
    'promotion.view',
    'hr.attendance.write',
    'hr.sop.read',
    'ai.assistant.use',
    'docs.view',
    'helpdesk.create',
    'helpdesk.view',
  ],
  assistant: [
    'accounting.view',
    'accounting.journal.create',
    'accounting.reports',
    'tax.view',
    'reporting.view',
    'correspondence.view',
    'correspondence.create',
    'hr.attendance.write',
    'hr.sop.read',
    'ai.assistant.use',
    'docs.view',
  ],
};

// === BOOTSTRAP ADMIN USER DEFAULTS ===
// Password is intentionally not stored here. Set SEED_ADMIN_PASSWORD only for initial bootstrap.
export const DEV_ADMIN_USER = {
  email: 'admin@aroadritea.com',
  displayName: 'Admin Dev',
  locale: 'id' as const,
  status: 'active' as const,
  roleCode: 'director', // full access
};
