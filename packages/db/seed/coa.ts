/**
 * COA Seed — SOURCE-OF-TRUTH Lampiran A (60+ akun SAK ETAP)
 * Run: pnpm --filter @erp/db seed
 */

import type { LocaleString } from '@erp/shared/types';

type AccountSeed = {
  code: string;
  name: LocaleString;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'cogs' | 'expense';
  subtype: string;
  normalBalance: 'debit' | 'credit';
  isPostable: boolean;
};

// Helper
const n = (id: string, en: string, zh: string): LocaleString => ({ id, en, zh });

export const COA_SEED: AccountSeed[] = [
  // === AKTIVA LANCAR ===
  { code: '1-0000', name: n('Aktiva Lancar', 'Current Assets', '流动资产'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: false },
  { code: '1-1010', name: n('Kas Kecil', 'Petty Cash', '零用金'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1020', name: n('Kas', 'Cash', '现金'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1030', name: n('Kas di Bank', 'Cash in Bank', '银行存款'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1040', name: n('Pingpong Payments', 'Pingpong Payments', 'Pingpong Payments'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1110', name: n('Piutang Usaha', 'Account Receivable', '应收账款'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1120', name: n('Cadangan Kerugian Piutang', 'Allowance for Doubtful Debt', '坏账准备'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },
  { code: '1-1210', name: n('Persediaan Barang Dagangan', 'Merchandise Inventory', '商品库存'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1310', name: n('Perlengkapan Kantor', 'Office Supplies', '办公用品'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1320', name: n('Perlengkapan Toko', 'Store Supplies', '店铺用品'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1410', name: n('Beban Dibayar Dimuka', 'Prepaid Expense', '预付费用'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1420', name: n('Sewa Dibayar Dimuka - Kantor Jakarta', 'Prepaid Rent of Jakarta Office', '预付租金-雅加达'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1430', name: n('Sewa Dibayar Dimuka - Kantor Yogyakarta', 'Prepaid Rent of Yogyakarta Office', '预付租金-日惹'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1440', name: n('Sewa Dibayar Dimuka - Toko Malioboro', 'Prepaid Rent of Malioboro Store', '预付租金-马里奥波罗'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1510', name: n('Deposit Jaminan Kantor Jakarta', 'Jakarta Office Security Deposit', '保证金-雅加达'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1520', name: n('Deposit Jaminan Kantor Yogyakarta', 'Yogyakarta Office Security Deposit', '保证金-日惹'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1530', name: n('Deposit Jaminan Toko', 'Store Security Deposit', '保证金-店铺'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1610', name: n('PPh Final Dibayar Dimuka', 'Prepaid Final Tax', '预缴最终税'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1620', name: n('PBJT Dibayar Dimuka', 'Prepaid PBJT Tax', '预缴PBJT'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1630', name: n('PPN Dibayar Dimuka', 'Prepaid PPN', '预缴增值税'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-1640', name: n('PPN Masukan', 'Vat In (PPN Income)', '进项增值税'), type: 'asset', subtype: 'current_asset', normalBalance: 'debit', isPostable: true },

  // === AKTIVA TETAP & INVESTASI ===
  { code: '1-2000', name: n('Aktiva Tetap & Investasi', 'Fixed Assets & Investment', '固定资产与投资'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: false },
  { code: '1-2010', name: n('Investasi', 'Investment', '投资'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2020', name: n('Konstruksi dalam Proses', 'Construction in Progress', '在建工程'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2030', name: n('Renovasi / Leasehold Improvement', 'Renovasi / Leasehold Improvement', '租赁改良'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2110', name: n('Peralatan Toko', 'Store Equipment', '店铺设备'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2111', name: n('Akum. Penyusutan Peralatan Toko', 'Accumulated Depreciation Of Store Equipment', '累计折旧-店铺设备'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },
  { code: '1-2120', name: n('Peralatan Kantor', 'Office Equipment', '办公设备'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2121', name: n('Akum. Penyusutan Peralatan Kantor', 'Accumulated Depreciation Of Office Equipment', '累计折旧-办公设备'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },
  { code: '1-2130', name: n('Mesin', 'Machine', '机器'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2131', name: n('Akum. Penyusutan Mesin', 'Accumulated Depreciation Of Machine', '累计折旧-机器'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },
  { code: '1-2140', name: n('Merek Dagang', 'Trademarks', '商标'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2141', name: n('Akum. Penyusutan Merek Dagang', 'Accumulated Depreciation Of Trademark', '累计折旧-商标'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },
  { code: '1-2150', name: n('Furnitur dan Perlengkapan', 'Furniture and Fixture', '家具及设备'), type: 'asset', subtype: 'fixed_asset', normalBalance: 'debit', isPostable: true },
  { code: '1-2151', name: n('Akum. Penyusutan Furnitur', 'Accumulated Depreciation Of Furniture and Fixture', '累计折旧-家具'), type: 'asset', subtype: 'contra_asset', normalBalance: 'credit', isPostable: true },

  // === KEWAJIBAN ===
  { code: '2-0000', name: n('Kewajiban', 'Liabilities', '负债'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: false },
  { code: '2-1010', name: n('Utang Usaha', 'Account Payable', '应付账款'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1020', name: n('Beban yang Masih Harus Dibayar', 'Expense Payable', '应付费用'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1030', name: n('Utang Pajak Penghasilan', 'Income Tax Payable', '应付所得税'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1040', name: n('PPN yang Harus Dibayar', 'PPN Payable', '应付增值税'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1050', name: n('PB1/PBJT yang Harus Dibayar', 'PB1 / PBJT Payable', '应付餐饮税'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1060', name: n('Utang Gaji', 'Salaries Payable', '应付工资'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1070', name: n('Utang PPh Final', 'Final Income Tax Payable', '应付最终所得税'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1080', name: n('Utang PPh 23', 'Final Income Tax 23 Payable', '应付PPh 23'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1090', name: n('Utang kepada Pemilik', 'Due to Owner', '应付业主'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1100', name: n('Utang Reimbursement', 'Reimbursement Payable', '应付报销'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-2010', name: n('Kewajiban Jangka Panjang', 'Long Term Liabilities', '长期负债'), type: 'liability', subtype: 'long_term_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-2020', name: n('Pinjaman Bank BCA', 'Bank BCA Loan', 'BCA银行贷款'), type: 'liability', subtype: 'long_term_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1110', name: n('PPN Keluaran', 'PPN Outcome (Vat Out)', '销项增值税'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-1120', name: n('Barang Diterima Belum Ditagih', 'Goods Received Not Invoiced', '已收未开票'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true },
  { code: '2-2050', name: n('Donasi Tabungan Amal', 'Donation Trust Payable', '慈善信托负债'), type: 'liability', subtype: 'current_liability', normalBalance: 'credit', isPostable: true }, // SD §25.11

  // === MODAL / EKUITAS ===
  { code: '3-0000', name: n('Modal / Ekuitas', 'Equity', '权益'), type: 'equity', subtype: 'equity', normalBalance: 'credit', isPostable: false },
  { code: '3-1010', name: n('Modal Disetor', 'Common Stock', '股本'), type: 'equity', subtype: 'equity', normalBalance: 'credit', isPostable: true },
  { code: '3-1020', name: n('Dividen', 'Dividend', '股利'), type: 'equity', subtype: 'equity', normalBalance: 'debit', isPostable: true },
  { code: '3-1030', name: n('Ikhtisar Laba Rugi', 'Income Summary', '损益汇总'), type: 'equity', subtype: 'equity', normalBalance: 'credit', isPostable: true },
  { code: '3-1040', name: n('Laba Ditahan', 'Retained Earning', '留存收益'), type: 'equity', subtype: 'equity', normalBalance: 'credit', isPostable: true },

  // === PENDAPATAN ===
  { code: '4-0000', name: n('Pendapatan', 'Revenue', '收入'), type: 'income', subtype: 'revenue', normalBalance: 'credit', isPostable: false },
  { code: '4-1010', name: n('Penjualan', 'Sales', '销售收入'), type: 'income', subtype: 'revenue', normalBalance: 'credit', isPostable: true },
  { code: '4-1020', name: n('Retur Penjualan', 'Sales Return', '销售退回'), type: 'income', subtype: 'contra_revenue', normalBalance: 'debit', isPostable: true },
  { code: '4-1030', name: n('Diskon Penjualan', 'Sales Discount', '销售折扣'), type: 'income', subtype: 'contra_revenue', normalBalance: 'debit', isPostable: true },
  { code: '4-2010', name: n('Pendapatan Bunga', 'Interest Revenue', '利息收入'), type: 'income', subtype: 'other_income', normalBalance: 'credit', isPostable: true },
  { code: '4-2020', name: n('Pendapatan Lainnya', 'Other Income', '其他收入'), type: 'income', subtype: 'other_income', normalBalance: 'credit', isPostable: true },

  // === HPP / COGS ===
  { code: '5-0000', name: n('Harga Pokok Penjualan', 'Cost of Goods Sold', '销售成本'), type: 'cogs', subtype: 'cogs', normalBalance: 'debit', isPostable: false },
  { code: '5-1010', name: n('Pembelian', 'Purchase', '采购'), type: 'cogs', subtype: 'cogs', normalBalance: 'debit', isPostable: true },
  { code: '5-1020', name: n('Retur Pembelian', 'Purchase Return', '采购退回'), type: 'cogs', subtype: 'contra_cogs', normalBalance: 'credit', isPostable: true },
  { code: '5-1030', name: n('Diskon Pembelian', 'Purchase Discount', '采购折扣'), type: 'cogs', subtype: 'contra_cogs', normalBalance: 'credit', isPostable: true },
  { code: '5-1040', name: n('Persediaan Awal', 'Beginning Inventory', '期初库存'), type: 'cogs', subtype: 'cogs', normalBalance: 'debit', isPostable: true },
  { code: '5-1050', name: n('Persediaan Akhir', 'Ending Inventory', '期末库存'), type: 'cogs', subtype: 'cogs', normalBalance: 'credit', isPostable: true },
  { code: '5-1060', name: n('Ongkos Angkut Masuk', 'Freight Paid / Freight In', '运费（入）'), type: 'cogs', subtype: 'cogs', normalBalance: 'debit', isPostable: true },

  // === BEBAN OPERASIONAL ===
  { code: '6-0000', name: n('Beban Operasional', 'Operating Expenses', '营业费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: false },
  { code: '6-1010', name: n('Beban Iklan', 'Advertising Expense', '广告费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1020', name: n('Beban Utilitas Kantor Jakarta', 'Jakarta Office Utilities Expense', '雅加达办公室水电费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1030', name: n('Beban Utilitas Kantor Yogyakarta', 'Yogyakarta Office Utilities Expense', '日惹办公室水电费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1040', name: n('Beban Utilitas Toko', 'Store Utilities Expense', '店铺水电费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1050', name: n('Beban Piutang Tak Tertagih', 'Bad Debt Expense', '坏账费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1060', name: n('Beban Penyusutan', 'Depreciation Expense', '折旧费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1070', name: n('Beban Instalasi', 'Installation Expense', '安装费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1080', name: n('Beban Sewa Toko', 'Store Rent Expense', '店铺租金'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1090', name: n('Beban Sewa Kantor', 'Office Rent Expense', '办公室租金'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1100', name: n('Beban Gaji & Upah', 'Wages and Salaries Expense', '工资费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1110', name: n('Beban Operasional Lainnya', 'Others Operating Expense', '其他营业费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1120', name: n('Beban Gaji Kantor', 'Office Salaries Expense', '办公室薪资'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1130', name: n('Beban Gaji Toko', 'Store Salaries Expense', '店铺薪资'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1140', name: n('Beban Perlengkapan Kantor', 'Office Supplies Expense', '办公用品费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1150', name: n('Beban Perlengkapan Toko', 'Store Supplies Expense', '店铺用品费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1160', name: n('Beban Administrasi', 'Administrative Expense', '行政费用'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1170', name: n('Beban Pemeliharaan Properti', 'Property Maintenance Expense', '物业维护费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1180', name: n('Beban Pra-Operasi', 'Pre-Operation Expenses', '开办费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1190', name: n('Beban Renovasi', 'Renovation Expense', '装修费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1200', name: n('Beban Penyusutan Furnitur', 'Depreciation Expense of Furniture and Fixture', '折旧费-家具'), type: 'expense', subtype: 'depreciation', normalBalance: 'debit', isPostable: true },
  { code: '6-1210', name: n('Beban Penyusutan Mesin', 'Depreciation Expense of Machine', '折旧费-机器'), type: 'expense', subtype: 'depreciation', normalBalance: 'debit', isPostable: true },
  { code: '6-1220', name: n('Beban Penyusutan Peralatan Kantor', 'Depreciation Expense of Office Equipment', '折旧费-办公设备'), type: 'expense', subtype: 'depreciation', normalBalance: 'debit', isPostable: true },
  { code: '6-1230', name: n('Beban Penyusutan Peralatan Toko', 'Depreciation Expense of Store Equipment', '折旧费-店铺设备'), type: 'expense', subtype: 'depreciation', normalBalance: 'debit', isPostable: true },
  { code: '6-1240', name: n('Beban Penyusutan Merek Dagang', 'Depreciation Expense of Trademark', '折旧费-商标'), type: 'expense', subtype: 'depreciation', normalBalance: 'debit', isPostable: true },
  { code: '6-1250', name: n('Beban PPh Final Sewa', 'Final Rental Tax Expense', '租赁最终税费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1260', name: n('Beban Komisi', 'Commission Expense', '佣金费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1270', name: n('Ongkos Angkut Keluar', 'Freight Out', '运费（出）'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1280', name: n('Beban Sewa Kantor Jakarta', 'Jakarta Office Rent Expense', '雅加达办公室租金'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1290', name: n('Beban Sewa Kantor Yogyakarta', 'Yogyakarta Office Rent Expense', '日惹办公室租金'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1300', name: n('Beban PJU', 'PJU Expense', '路灯税费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1310', name: n('Beban Transportasi', 'Transportation Expense', '交通费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },
  { code: '6-1320', name: n('Beban Komunikasi', 'Communication Expense', '通讯费'), type: 'expense', subtype: 'operating', normalBalance: 'debit', isPostable: true },

  // === BEBAN NON-OPERASIONAL ===
  { code: '7-0000', name: n('Beban Non-Operasional', 'Non-Operating Expenses', '营业外支出'), type: 'expense', subtype: 'non_operating', normalBalance: 'debit', isPostable: false },
  { code: '7-1010', name: n('Beban Bunga', 'Interest Expense', '利息费用'), type: 'expense', subtype: 'non_operating', normalBalance: 'debit', isPostable: true },
  { code: '7-1020', name: n('Beban Administrasi Bank', 'Bank Administration Fees', '银行手续费'), type: 'expense', subtype: 'non_operating', normalBalance: 'debit', isPostable: true },
  { code: '7-1030', name: n('Beban Pajak Penghasilan', 'Income Tax Expenses', '所得税费用'), type: 'expense', subtype: 'non_operating', normalBalance: 'debit', isPostable: true },
];
