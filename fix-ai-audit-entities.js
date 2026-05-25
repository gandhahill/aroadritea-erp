const fs = require('fs');
['en', 'id', 'zh'].forEach(lang => {
  const file = `apps/web/messages/${lang}.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  if (!data.ai.audit.entities) data.ai.audit.entities = {};
  if (lang === 'id') {
    data.ai.audit.entities = {
      ai_chat_session: "Sesi Percakapan AI",
      ai_chat_message: "Pesan Percakapan AI",
      ai_tool_call: "Pemanggilan Alat AI",
      ai_action_draft: "Draf Aksi AI"
    };
  } else if (lang === 'en') {
    data.ai.audit.entities = {
      ai_chat_session: "AI Chat Session",
      ai_chat_message: "AI Chat Message",
      ai_tool_call: "AI Tool Call",
      ai_action_draft: "AI Action Draft"
    };
  } else {
    data.ai.audit.entities = {
      ai_chat_session: "AI 聊天会话",
      ai_chat_message: "AI 聊天消息",
      ai_tool_call: "AI 工具调用",
      ai_action_draft: "AI 操作草稿"
    };
  }
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});
console.log("i18n updated");
