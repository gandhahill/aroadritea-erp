const fs = require('fs');
['en', 'id', 'zh'].forEach(lang => {
  const file = `apps/web/messages/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  const translations = {
    en: {
      product: "Product",
      selectProduct: "Select Product",
      qty: "Qty",
      price: "Price",
      delete: "Delete"
    },
    id: {
      product: "Produk",
      selectProduct: "Pilih Produk",
      qty: "Kuantitas",
      price: "Harga",
      delete: "Hapus"
    },
    zh: {
      product: "产品",
      selectProduct: "选择产品",
      qty: "数量",
      price: "价格",
      delete: "删除"
    }
  };
  
  Object.assign(data.pos.manualSales, translations[lang]);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});
console.log("i18n updated");
