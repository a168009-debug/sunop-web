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
    const { message, context: ctx, history, baziData } = JSON.parse(event.body || "{}");
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "請在 Netlify 設定 OPENAI_API_KEY" }) };
    }

    if (!message) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "缺少 message" }) };
    }

    const systemPrompt = getContextPrompt(ctx, baziData);
    const safeHistory = Array.isArray(history) ? history : [];
    const trimmedHistory = safeHistory
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8);

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
    const errorMsg = err.message || String(err);
    let statusCode = 500;
    
    // Detect quota errors
    if (errorMsg.includes("quota") || errorMsg.includes("exceeded") || errorMsg.includes("billing")) {
      statusCode = 402;
    } else if (errorMsg.includes("timeout") || errorMsg.includes("timeout")) {
      statusCode = 504;
    }
    
    return { statusCode, headers: corsHeaders, body: JSON.stringify({ error: errorMsg }) };
  }
};

function getContextPrompt(ctx, baziData) {
  const prompts = {
    "命理分析": `你是八字命理專家。用繁體中文詳細回答。

請按照以下結構分析：
1. 命盤結構分析：說明年、月、日、時四柱的天干地支組合
2. 用神分析：根據日主五行，分析哪些五行能夠幫助命主
3. 十神解讀：說明主要十神的含義與影響
4. 大運流年：根據目前年齡說明近幾年運勢
5. 事業建議：適合的職業方向與發展建議
6. 健康建議：需要注意的身體部位與保健方式

請用詳細、專業但淺顯易懂的方式解釋，盡量用列表呈現。`,
    
    "姓名分析": `你是姓名學專家。用繁體中文回答。

請分析：
1. 姓名格局：總格、天格、人格、地格、外格的影響
2. 五行配置：姓名筆畫對應的五行是否平衡
3. 音義分析：名字的發音與含義
4. 補運建議：可以如何透過姓名調整運勢
5. 適配建議：適合的職業與發展方向

請詳細說明，用列表呈現。`,
    
    "智慧卡": `你是塔羅/智慧卡解讀專家。用繁體中文回答。

請給出：
1. 牌義解說：這張牌的核心含義
2. 正位/逆位解釋（如適用）
3. 對問者的建議：具體可行的行動建議
4. 能量提示：這張牌給予的提醒

請溫和但具體，避免過度神祕化。`,
    
    "測字": `你是測字解讀專家。用繁體中文回答。

請分析：
1. 字形拆解：这个字可以如何分解
2. 意象解讀：每個部分的象徵意義
3. 對應情境：這個字與問事內容的關聯
4. 建議指引：具體可行的建議

請用簡單明白的方式解釋。`,
    
    "情緒曲線": `你是情緒管理顧問。用繁體中文回答。

請根據對方的情緒狀態：
1. 分析可能的原因
2. 提供情緒調節建議
3. 建議適合的活動或方法
4. 長期建議

請溫和且實用。`,
    
    "AI畫像": `你是五行能量解讀專家。用繁體中文回答。

請解讀：
1. 五行能量分析：這個人主要的五行特質
2. 性格特點：詳細說明優勢與特質
3. 幸運元素：幸運色、幸運數字、幸運方位
4. 發展建議：如何在生活中平衡五行

請用淺顯易懂的方式解釋。`
  };
  
  return prompts[ctx] || prompts["命理分析"];
}

function callOpenAI(apiKey, messages) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 1500,
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
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body || "{}");
          
          // Check for OpenAI errors
          if (json.error) {
            return reject(new Error(json.error.message));
          }
          
          if (!res.statusCode || res.statusCode >= 400) {
            const msg = json?.error?.message || `HTTP ${res.statusCode}: ${body}`;
            return reject(new Error(msg));
          }
          
          const content = json?.choices?.[0]?.message?.content;
          if (!content) return reject(new Error("OpenAI 回傳空內容"));
          resolve(content);
        } catch (e) {
          reject(new Error("解析回應失敗: " + e.message));
        }
      });
    });

    req.on("error", (e) => reject(new Error("網路錯誤: " + e.message)));
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("請求超時（15秒）"));
    });
    req.write(data);
    req.end();
  });
}
