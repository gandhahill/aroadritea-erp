const fs = require('fs');
['en', 'id', 'zh'].forEach(lang => {
  const file = `apps/web/messages/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  if (lang === 'id') {
    data.aiAssistantLanding.title = "Asisten AI";
    data.aiAssistantLanding.description = "Tanyakan alur kerja, deteksi error, atau bantu OCR struk POS lama. Identitas dan izin Anda dihormati pada setiap perintah.";
  } else if (lang === 'en') {
    data.aiAssistantLanding.title = "AI Assistant";
    data.aiAssistantLanding.description = "Ask about workflows, detect errors, or get help with OCR for old POS receipts. Your identity and permissions are respected on every command.";
  } else {
    data.aiAssistantLanding.title = "AI 助手";
    data.aiAssistantLanding.description = "询问工作流程、检测错误或获取旧版POS收据的OCR帮助。您的身份和权限将在每次命令中受到尊重。";
  }
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});
console.log("i18n updated");
