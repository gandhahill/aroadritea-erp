const fs = require('fs');
const path = require('path');

const locales = ['en', 'id', 'zh'];
const msgDir = path.resolve('apps/web/messages');

const translations = {
  en: {
    accounting: {
      invoice: {
        new: {
          typeSales: 'Sales',
          typePurchase: 'Purchase',
          partnerAddress: 'Partner Address',
          selectPartner: 'Select Partner...',
          partnerNpwp: 'Partner NPWP',
          paymentTerms: 'Payment Terms',
          paymentTermsPlaceholder: 'e.g. Net 30',
          notesLabel: 'Notes',
          noTax: 'No Tax',
        },
      },
    },
    nav: {
      companySettings: 'Company Info',
      accountingSettings: 'Accounting',
      outgoingShipments: 'Outgoing Shipments',
    },
    settings: {
      company: {
        title: 'Company Settings',
        subtitle: 'Manage PT. Gandha Hill company identity',
        companyName: 'Company Name',
        companyNameHelp: 'Displayed on printed invoices and receipts.',
        companyAddress: 'Company Address',
        companyAddressHelp: 'Displayed on printed invoices and receipts.',
        companyNpwp: 'Company NPWP',
        companyNpwpHelp: 'Tax identification number.',
        companyPhone: 'Phone Number',
        saved: 'Company info saved successfully.',
        saveAction: 'Save Changes',
      },
      accounting: {
        title: 'Accounting Settings',
        subtitle: 'Configure default accounts for accounting modules',
        purchasing: 'Purchasing',
        purchasingDesc: 'Default account mapped for purchase invoices',
        apAccount: 'Accounts Payable (AP)',
        selectAccount: 'Select AP Account...',
        apAccountHelp: 'This account will be credited when posting a purchase invoice.',
        saveAction: 'Save Settings',
      },
    },
    logistics: {
      outgoingShipments: 'Outgoing Shipments',
      outgoingShipmentsSubtitle: 'Manage shipments and track delivery statuses',
    },
  },
  id: {
    accounting: {
      invoice: {
        new: {
          typeSales: 'Penjualan',
          typePurchase: 'Pembelian',
          partnerAddress: 'Alamat Partner',
          selectPartner: 'Pilih Partner...',
          partnerNpwp: 'NPWP Partner',
          paymentTerms: 'Termin Pembayaran',
          paymentTermsPlaceholder: 'Cth: Net 30',
          notesLabel: 'Catatan',
          noTax: 'Tanpa Pajak',
        },
      },
    },
    nav: {
      companySettings: 'Info Perusahaan',
      accountingSettings: 'Akuntansi',
      outgoingShipments: 'Pengiriman Keluar',
    },
    settings: {
      company: {
        title: 'Pengaturan Perusahaan',
        subtitle: 'Kelola identitas perusahaan PT. Gandha Hill',
        companyName: 'Nama Perusahaan',
        companyNameHelp: 'Ditampilkan pada cetakan invoice dan kuitansi.',
        companyAddress: 'Alamat Perusahaan',
        companyAddressHelp: 'Ditampilkan pada cetakan invoice dan kuitansi.',
        companyNpwp: 'NPWP Perusahaan',
        companyNpwpHelp: 'Nomor Pokok Wajib Pajak.',
        companyPhone: 'Nomor Telepon',
        saved: 'Info perusahaan berhasil disimpan.',
        saveAction: 'Simpan Perubahan',
      },
      accounting: {
        title: 'Pengaturan Akuntansi',
        subtitle: 'Atur akun default untuk modul akuntansi',
        purchasing: 'Pembelian',
        purchasingDesc: 'Akun default yang dipetakan untuk invoice pembelian',
        apAccount: 'Akun Utang (AP)',
        selectAccount: 'Pilih Akun Utang...',
        apAccountHelp: 'Akun ini akan dikreditkan saat mem-posting invoice pembelian.',
        saveAction: 'Simpan Pengaturan',
      },
    },
    logistics: {
      outgoingShipments: 'Pengiriman Keluar',
      outgoingShipmentsSubtitle: 'Kelola pengiriman barang dan lacak status pesanan',
    },
  },
  zh: {
    accounting: {
      invoice: {
        new: {
          typeSales: '销售',
          typePurchase: '采购',
          partnerAddress: '合作伙伴地址',
          selectPartner: '选择合作伙伴...',
          partnerNpwp: '合作伙伴税号 (NPWP)',
          paymentTerms: '付款条件',
          paymentTermsPlaceholder: '例如：Net 30',
          notesLabel: '备注',
          noTax: '免税',
        },
      },
    },
    nav: {
      companySettings: '公司信息',
      accountingSettings: '会计',
      outgoingShipments: '发出货物',
    },
    settings: {
      company: {
        title: '公司设置',
        subtitle: '管理 PT. Gandha Hill 公司身份',
        companyName: '公司名称',
        companyNameHelp: '显示在打印的发票和收据上。',
        companyAddress: '公司地址',
        companyAddressHelp: '显示在打印的发票和收据上。',
        companyNpwp: '公司税号 (NPWP)',
        companyNpwpHelp: '税务识别号。',
        companyPhone: '电话号码',
        saved: '公司信息已成功保存。',
        saveAction: '保存更改',
      },
      accounting: {
        title: '会计设置',
        subtitle: '配置会计模块的默认账户',
        purchasing: '采购',
        purchasingDesc: '采购发票映射的默认账户',
        apAccount: '应付账款 (AP)',
        selectAccount: '选择应付账款...',
        apAccountHelp: '过账采购发票时将贷记此账户。',
        saveAction: '保存设置',
      },
    },
    logistics: {
      outgoingShipments: '发出货物',
      outgoingShipmentsSubtitle: '管理货物发送并跟踪交付状态',
    },
  },
};

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

for (const lang of locales) {
  const filePath = path.join(msgDir, `${lang}.json`);
  let data = {};
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  deepMerge(data, translations[lang]);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${lang}.json`);
}
