const fs = require('fs');

['en', 'id', 'zh'].forEach(lang => {
  const p = 'apps/web/messages/' + lang + '.json';
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));

  data.aiAssistantLanding = data.aiAssistantLanding || {};
  
  if (lang === 'id') {
    data.aiAssistantLanding = {
      disabled: "Asisten AI dinonaktifkan oleh admin (AI_ASSISTANT_ENABLED=false). Hubungi administrator untuk mengaktifkan kembali.",
      startNew: "Mulai percakapan baru",
      policy: "Kebijakan: 30 pesan / jam / pengguna · audit lengkap · model DeepSeek v4.",
      titlePlaceholder: "Judul singkat (opsional)",
      btnNewSession: "+ Sesi baru",
      tabMine: "Percakapan saya",
      tabAll: "Semua percakapan (admin)",
      empty: "Belum ada percakapan. Mulai sesi baru di atas.",
      owner: "pemilik",
      btnRename: "Ganti nama",
      btnArchive: "Arsipkan",
      btnSave: "Simpan"
    };
    data.pos.manualSales.products = "Produk";
    data.pos.manualSales.addProduct = "Tambah Produk";
  } else if (lang === 'en') {
    data.aiAssistantLanding = {
      disabled: "AI Assistant is disabled by admin (AI_ASSISTANT_ENABLED=false). Contact administrator to re-enable.",
      startNew: "Start new conversation",
      policy: "Policy: 30 messages / hour / user · full audit · DeepSeek v4 model.",
      titlePlaceholder: "Short title (optional)",
      btnNewSession: "+ New session",
      tabMine: "My conversations",
      tabAll: "All conversations (admin)",
      empty: "No conversations yet. Start a new session above.",
      owner: "owner",
      btnRename: "Rename",
      btnArchive: "Archive",
      btnSave: "Save"
    };
    data.pos.manualSales.products = "Products";
    data.pos.manualSales.addProduct = "Add Product";
  } else if (lang === 'zh') {
    data.aiAssistantLanding = {
      disabled: "管理员已禁用 AI 助手 (AI_ASSISTANT_ENABLED=false)。请联系管理员重新启用。",
      startNew: "开始新对话",
      policy: "政策：每用户每小时 30 条消息 · 完整审计 · DeepSeek v4 模型。",
      titlePlaceholder: "简短标题（可选）",
      btnNewSession: "+ 新会话",
      tabMine: "我的对话",
      tabAll: "所有对话（管理员）",
      empty: "暂无对话。请在上方开始新会话。",
      owner: "所有者",
      btnRename: "重命名",
      btnArchive: "归档",
      btnSave: "保存"
    };
    data.pos.manualSales.products = "产品";
    data.pos.manualSales.addProduct = "添加产品";
  }

  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
});
