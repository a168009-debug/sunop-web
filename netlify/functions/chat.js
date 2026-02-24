const https = require("https");

exports.handler = async (event) => {
  // CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { message, context: ctx, history } = JSON.parse(event.body || "{}");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "請在 Netlify 設定 OPENAI_API_KEY" }) };
    }

    if (!message) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "缺少 message" }) };
    }

    const systemPrompt = getContextPrompt(ctx);
    const safeHistory = Array.isArray(history) ? history : [];
    const trimmedHistory = safeHistory
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-6);

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    const reply = await callOpenAI(apiKey, messages);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

function getContextPrompt(ctx) {
  const prompts = {
    "命理分析": "你是命理分析AI助理。用繁體中文回答，專業、清楚、可操作，避免神神叨叨。",
    "姓名分析": "你是姓名分析AI助理。用繁體中文回答，說明優缺點與建議。",
    "智慧卡": "你是智慧卡解讀AI助理。用繁體中文回答，給出牌義+建議行動。",
    "測字": "你是測字解讀AI助理。用繁體中文回答，先拆字意象，再給建議。",
  };
  return prompts[ctx] || prompts["命理分析"];
}

function callOpenAI(apiKey, messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 1200,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 25000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body || "{}");
          if (!res.statusCode || res.statusCode >= 400) {
            const msg = json?.error?.message || `HTTP ${res.statusCode}: ${body}`;
            return reject(new Error(msg));
          }
          const content = json?.choices?.[0]?.message?.content;
          if (!content) return reject(new Error("OpenAI 回傳空內容"));
          resolve(content);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("OpenAI request timeout")));
    req.write(data);
    req.end();
  });
}
