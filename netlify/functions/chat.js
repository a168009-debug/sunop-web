const https = require("https");

exports.handler = async (event) => {
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
    const { message, context: ctx, history, mode, baziData } = JSON.parse(event.body || "{}");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "請在 Netlify 設定 OPENAI_API_KEY" }) };
    }

    if (!message) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "缺少 message" }) };
    }

    // Determine mode: fast or deep
    const analysisMode = mode || "fast";
    const systemPrompt = getContextPrompt(ctx, analysisMode, baziData);
    const safeHistory = Array.isArray(history) ? history : [];
    const trimmedHistory = safeHistory
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8);

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: message },
    ];

    const reply = await callOpenAI(apiKey, messages, analysisMode);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply, mode: analysisMode }),
    };
  } catch (err) {
    const errorMsg = err.message || String(err);
    let statusCode = 500;
    
    if (errorMsg.includes("quota") || errorMsg.includes("exceeded")) {
      statusCode = 402;
    } else if (errorMsg.includes("timeout") || errorMsg.includes("超時")) {
      statusCode = 504;
    }
    
    return { statusCode, headers: corsHeaders, body: JSON.stringify({ error: errorMsg }) };
  }
};

function getContextPrompt(ctx, mode, baziData) {
  const isDeep = mode === "deep";
  const maxTokens = isDeep ? 2000 : 800;
  
  const prompts = {
    "命理分析": `你是專業八字命理大師，具備結構化推理能力。

分析原則：
• 先分析結構（年、月、日、時四柱組合）
• 判斷日主強弱
• 邏輯性推斷用神
• 避免神祕化語言
• 用專業但淺顯易懂的方式解釋
• 用繁體中文回答
${isDeep ? `
【深度分析模式】
請提供完整結構化分析：
1. 命盤結構分析：四柱天干地支組合
2. 日主強弱分析
3. 用神邏輯推斷
4. 十神解讀
5. 10年大運概覽
6. 事業策略建議
7. 財富結構
8. 情感模式
9. 健康結構
10. 風險警示
11. 策略性生活建議
` : `
【快速解讀模式】
請簡潔回答（600-800字）：
1. 整體結構強度
2. 用神建議
3. 健康趨勢
4. 事業建議
5. 情感趨勢
6. 簡短總結
`}`,
    
    "姓名分析": `你是姓名學專家。用繁體中文${isDeep ? "詳細" : "簡潔"}分析。`,
    
    "智慧卡": `你是塔羅/智慧卡解讀專家。用繁體中文${isDeep ? "詳細" : "簡潔"}回答。`,
    
    "測字": `你是測字解讀專家。用繁體中文${isDeep ? "詳細" : "簡潔"}回答。`,
    
    "情緒曲線": `你是情緒管理顧問。用繁體中文${isDeep ? "詳細" : "簡潔"}回答。`,
    
    "AI畫像": `你是五行能量解讀專家。用繁體中文${isDeep ? "詳細" : "簡潔"}回答。`
  };
  
  return prompts[ctx] || prompts["命理分析"];
}

function callOpenAI(apiKey, messages, mode) {
  const maxTokens = mode === "deep" ? 2000 : 800;
  const temperature = mode === "deep" ? 0.6 : 0.7;
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature,
      max_tokens: maxTokens,
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
      timeout: mode === "deep" ? 20000 : 10000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body || "{}");
          
          if (json.error) {
            return reject(new Error(json.error.message));
          }
          
          if (!res.statusCode || res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          
          const content = json?.choices?.[0]?.message?.content;
          if (!content) return reject(new Error("回應為空"));
          resolve(content);
        } catch (e) {
          reject(new Error("解析失敗"));
        }
      });
    });

    req.on("error", (e) => reject(new Error("網路錯誤")));
    req.setTimeout(mode === "deep" ? 20000 : 10000, () => { 
      req.destroy(); 
      reject(new Error("超時")); 
    });
    req.write(data);
    req.end();
  });
}
