const fs = require('fs');
const path = require('path');

const locales = ['en', 'id', 'zh'];
const msgDir = path.resolve('apps/web/messages');

const translations = {
  en: {
    accounting: {
      invoice: {
        subtotal: 'Subtotal',
        tax: 'Tax',
        payAction: 'Pay',
        printKuitansi: 'Print Receipt',
        errorSelectAccount: 'Please select an account.',
        amountToPay: 'Amount to Pay',
        paymentDate: 'Payment Date',
        paymentAccount: 'Payment Account',
        selectAccount: 'Select Account...',
        cancel: 'Cancel',
        processing: 'Processing...',
        payInvoice: 'Pay Invoice'
      },
      print: {
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
        amountInWords: 'Amount in Words',
        printHint: 'Print this document for your records.',
        paymentTerms: 'Payment Terms',
        subtotal: 'Subtotal',
        tax: 'Tax'
      }
    },
    hr: {
      attendance: {
        onTime: 'On Time'
      }
    },
    inventory: {
      opname: {
        saveChanges: 'Save Changes',
        emptyList: 'No items found.',
        noMatchFilter: 'No items match the filter.',
        saveAction: 'Save',
        columns: {
          varianceValue: 'Variance Value'
        }
      },
      variance: {
        emptySessions: 'No opname sessions found.',
        emptyProducts: 'No products with variance found.',
        charts: {
          varianceDistribution: 'Variance Distribution',
          topVarianceProducts: 'Top Products with Variance'
        },
        columns: {
          lines: 'Lines',
          withVariance: 'With Variance',
          netQty: 'Net Qty',
          product: 'Product',
          session: 'Session',
          netVariance: 'Net Variance',
          value: 'Value',
          rate: 'Rate'
        }
      }
    },
    logistics: {
      outgoingShipment: {
        errorSelectLocation: 'Please select a location.',
        number: 'Number',
        location: 'Location',
        selectLocation: 'Select Location...',
        subject: 'Subject',
        subjectPlaceholder: 'e.g. Goods delivery',
        recipientName: 'Recipient Name',
        recipientPhone: 'Recipient Phone',
        recipientAddress: 'Recipient Address',
        shippingDetails: 'Shipping Details',
        courierCode: 'Courier Code',
        awb: 'AWB',
        cancel: 'Cancel',
        saving: 'Saving...',
        saveAction: 'Save',
        title: 'Outgoing Shipment',
        createNew: 'Create New'
      }
    },
    purchasing: {
      statusDraft: 'Draft',
      statusSubmitted: 'Submitted',
      statusApproved: 'Approved',
      statusPartial: 'Partial',
      statusReceived: 'Received',
      statusClosed: 'Closed',
      statusCancelled: 'Cancelled'
    },
    reporting: {
      dailySummary: {
        shiftSummary: 'Shift Summary'
      }
    },
    settings: {
      accounting: {
        errorSelectAccount: 'Please select an account.',
        saving: 'Saving...'
      },
      company: {
        saving: 'Saving...'
      }
    }
  },
  id: {
    accounting: {
      invoice: {
        subtotal: 'Subtotal',
        tax: 'Pajak',
        payAction: 'Bayar',
        printKuitansi: 'Cetak Kuitansi',
        errorSelectAccount: 'Harap pilih akun.',
        amountToPay: 'Jumlah Dibayar',
        paymentDate: 'Tanggal Pembayaran',
        paymentAccount: 'Akun Pembayaran',
        selectAccount: 'Pilih Akun...',
        cancel: 'Batal',
        processing: 'Memproses...',
        payInvoice: 'Bayar Invoice'
      },
      print: {
        description: 'Keterangan',
        debit: 'Debit',
        credit: 'Kredit',
        amountInWords: 'Terbilang',
        printHint: 'Cetak dokumen ini untuk arsip Anda.',
        paymentTerms: 'Termin',
        subtotal: 'Subtotal',
        tax: 'Pajak'
      }
    },
    hr: {
      attendance: {
        onTime: 'Tepat Waktu'
      }
    },
    inventory: {
      opname: {
        saveChanges: 'Simpan Perubahan',
        emptyList: 'Data kosong.',
        noMatchFilter: 'Data tidak ditemukan.',
        saveAction: 'Simpan',
        columns: {
          varianceValue: 'Nilai Selisih'
        }
      },
      variance: {
        emptySessions: 'Tidak ada sesi opname.',
        emptyProducts: 'Tidak ada produk dengan selisih.',
        charts: {
          varianceDistribution: 'Distribusi Selisih',
          topVarianceProducts: 'Produk Teratas (Selisih)'
        },
        columns: {
          lines: 'Baris',
          withVariance: 'Ada Selisih',
          netQty: 'Kuantitas Bersih',
          product: 'Produk',
          session: 'Sesi',
          netVariance: 'Selisih Bersih',
          value: 'Nilai',
          rate: 'Tingkat'
        }
      }
    },
    logistics: {
      outgoingShipment: {
        errorSelectLocation: 'Harap pilih lokasi.',
        number: 'Nomor',
        location: 'Lokasi',
        selectLocation: 'Pilih Lokasi...',
        subject: 'Subjek',
        subjectPlaceholder: 'Cth: Pengiriman barang',
        recipientName: 'Nama Penerima',
        recipientPhone: 'No. HP Penerima',
        recipientAddress: 'Alamat Penerima',
        shippingDetails: 'Detail Pengiriman',
        courierCode: 'Kode Kurir',
        awb: 'Resi (AWB)',
        cancel: 'Batal',
        saving: 'Menyimpan...',
        saveAction: 'Simpan',
        title: 'Pengiriman Keluar',
        createNew: 'Buat Baru'
      }
    },
    purchasing: {
      statusDraft: 'Draf',
      statusSubmitted: 'Diajukan',
      statusApproved: 'Disetujui',
      statusPartial: 'Sebagian',
      statusReceived: 'Diterima',
      statusClosed: 'Selesai',
      statusCancelled: 'Dibatalkan'
    },
    reporting: {
      dailySummary: {
        shiftSummary: 'Ringkasan Shift'
      }
    },
    settings: {
      accounting: {
        errorSelectAccount: 'Harap pilih akun.',
        saving: 'Menyimpan...'
      },
      company: {
        saving: 'Menyimpan...'
      }
    }
  },
  zh: {
    accounting: {
      invoice: {
        subtotal: '小计',
        tax: '税金',
        payAction: '支付',
        printKuitansi: '打印收据',
        errorSelectAccount: '请选择账户。',
        amountToPay: '支付金额',
        paymentDate: '付款日期',
        paymentAccount: '付款账户',
        selectAccount: '选择账户...',
        cancel: '取消',
        processing: '处理中...',
        payInvoice: '支付发票'
      },
      print: {
        description: '描述',
        debit: '借方',
        credit: '贷方',
        amountInWords: '大写金额',
        printHint: '打印此文件以供存档。',
        paymentTerms: '付款条件',
        subtotal: '小计',
        tax: '税金'
      }
    },
    hr: {
      attendance: {
        onTime: '准时'
      }
    },
    inventory: {
      opname: {
        saveChanges: '保存更改',
        emptyList: '无数据。',
        noMatchFilter: '没有符合过滤条件的数据。',
        saveAction: '保存',
        columns: {
          varianceValue: '差异金额'
        }
      },
      variance: {
        emptySessions: '未找到盘点。',
        emptyProducts: '未找到有差异的产品。',
        charts: {
          varianceDistribution: '差异分布',
          topVarianceProducts: '顶级差异产品'
        },
        columns: {
          lines: '行',
          withVariance: '有差异',
          netQty: '净数量',
          product: '产品',
          session: '盘点',
          netVariance: '净差异',
          value: '金额',
          rate: '费率'
        }
      }
    },
    logistics: {
      outgoingShipment: {
        errorSelectLocation: '请选择地点。',
        number: '编号',
        location: '地点',
        selectLocation: '选择地点...',
        subject: '主题',
        subjectPlaceholder: '例如：货物交付',
        recipientName: '收件人姓名',
        recipientPhone: '收件人电话',
        recipientAddress: '收件人地址',
        shippingDetails: '运输详情',
        courierCode: '快递代码',
        awb: '运单号',
        cancel: '取消',
        saving: '保存中...',
        saveAction: '保存',
        title: '发出货物',
        createNew: '创建新的'
      }
    },
    purchasing: {
      statusDraft: '草稿',
      statusSubmitted: '已提交',
      statusApproved: '已批准',
      statusPartial: '部分',
      statusReceived: '已接收',
      statusClosed: '已关闭',
      statusCancelled: '已取消'
    },
    reporting: {
      dailySummary: {
        shiftSummary: '班次摘要'
      }
    },
    settings: {
      accounting: {
        errorSelectAccount: '请选择账户。',
        saving: '保存中...'
      },
      company: {
        saving: '保存中...'
      }
    }
  }
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
