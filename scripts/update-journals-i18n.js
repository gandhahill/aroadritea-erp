const fs = require('fs');
const path = require('path');

const locales = ['en', 'id', 'zh'];
const dir = path.join(__dirname, '..', 'apps', 'web', 'messages');

const translations = {
  en: {
    journals: {
      postJournal: "Post Journal",
      posting: "Posting...",
      deleteDraft: "Delete Draft",
      deleting: "Deleting...",
      reverseJournal: "Reverse Journal",
      reversalDate: "Reversal Date",
      confirmReverse: "Confirm",
      reversing: "Reversing...",
      cancel: "Cancel",
      confirmDelete: "Are you sure you want to delete this draft?"
    }
  },
  id: {
    journals: {
      postJournal: "Posting Jurnal",
      posting: "Memposting...",
      deleteDraft: "Hapus Draf",
      deleting: "Menghapus...",
      reverseJournal: "Jurnal Balik",
      reversalDate: "Tanggal Pembalikan",
      confirmReverse: "Konfirmasi",
      reversing: "Membalik...",
      cancel: "Batal",
      confirmDelete: "Yakin ingin menghapus draf jurnal ini?"
    }
  },
  zh: {
    journals: {
      postJournal: "过账日记账",
      posting: "过账中...",
      deleteDraft: "删除草稿",
      deleting: "删除中...",
      reverseJournal: "冲销日记账",
      reversalDate: "冲销日期",
      confirmReverse: "确认",
      reversing: "冲销中...",
      cancel: "取消",
      confirmDelete: "您确定要删除此草稿吗？"
    }
  }
};

for (const locale of locales) {
  const filePath = path.join(dir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!data.journals) data.journals = {};
  
  Object.assign(data.journals, translations[locale].journals);
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${locale}.json`);
}
