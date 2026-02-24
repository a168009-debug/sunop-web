// netlify/functions/chat.js
exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "請先在 Netlify 設定 OPENAI_API_KEY" }) };
    }

    const { message, context: ctx, history } = JSON.parse(event.body || "{}");
    if (!message) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "缺少 message" }) };
    }

    const systemPrompt = getContextPrompt(ctx);
    const messages = [
      { role: "system", content: systemPrompt },
      ...normalizeHistory(history),
      { role: "user", content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    }).finally(() => clearTimeout(timeout));

    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.error?.message || `OpenAI error: HTTP ${resp.status}`;
      return { statusCode: resp.status, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ reply }) };

  } catch (err) {
    const msg = err?.name === "AbortError" ? "請求超時（25秒）" : (err?.message || "Server error");
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: msg }) };
  }
};

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6);
}

function getContextPrompt(ctx) {
  const prompts = {
    "命理分析": "你是命理分析 AI 助理。用繁體中文回答，專業且具體。",
    "姓名分析": "你是姓名分析 AI 助理。用繁體中文回答。",
    "智慧卡": "你是智慧卡解讀 AI 助理。用繁體中文回答。",
    "測字": "你是測字解讀 AI 助理。用繁體中文回答。",
    "情緒曲線": "你是情緒分析 AI 助理。用繁體中文回答。",
    "AI畫像": "你是AI畫像解讀 AI 助理。用繁體中文回答。"
  };
  return prompts[ctx] || prompts["命理分析"];
}
