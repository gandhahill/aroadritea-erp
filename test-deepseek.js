const key = 'sk-f07d50cb911441bba7b0a74c9b496ce6';
const url = 'https://api.deepseek.com/chat/completions'; // api.deepseek.com/v1 doesn't need /v1 if we use /chat/completions? Wait, standard is https://api.deepseek.com/chat/completions or https://api.deepseek.com/v1/chat/completions.

async function test() {
  const payload = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: 'Halo' }],
    max_tokens: 10
  };
  console.log("Calling deepseek API...");
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Fetch error:", e);
  }
}
test();
