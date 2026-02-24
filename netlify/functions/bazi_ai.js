const https = require("https");

// ============ Layer 0: Bazi Calculator (Deterministic) ============
function calculateBazi(year, month, day, hour) {
  const 天干 = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const 地支 = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const 地支五行 = { "子":"水","亥":"水","寅":"木","卯":"木","巳":"火","午":"火","申":"金","酉":"金","丑":"土","辰":"土","未":"土","戌":"土" };
  
  // Calculate pillars
  const 年柱 = 天干[(year - 4) % 10] + 地支[(year - 4) % 12];
  const 年干索引 = 天干.indexOf(年柱[0]);
  const 起始索引 = [2,4,6,8,0][Math.floor(年干索引 / 2)] || 0;
  const 月柱 = 天干[(起始索引 + month - 1) % 10] + ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"][month - 1];
  
  // Day pillar calculation
  const 基準日 = new Date(1900, 1, 15);
  const 天數差 = Math.floor((new Date(year, month - 1, day) - 基準日) / (1000 * 60 * 60 * 24));
  const 日柱 = 天干[(天數差 % 10 + 10) % 10] + 地支[(天數差 % 12 + 12) % 12];
  const 日干索引 = 天干.indexOf(日柱[0]);
  
  // Hour pillar
  const 時干索引 = [0, 2, 4, 6, 8][Math.floor(日干索引 / 2)] || 0;
  const 時柱 = 天干[(時干索引 + 地支.indexOf(hour)) % 10] + hour;
  
  // Calculate Five Elements distribution
  const allPillars = 年柱 + 月柱 + 日柱 + 時柱;
  const 五行統計 = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  for (let char of allPillars) {
    const elem = 地支五行[char];
    if (elem) 五行統計[elem]++;
  }
  
  // Day Master (日主)
  const 日主五行 = 地支五行[日柱[1]];
  
  // Strength analysis
  const 五行分佈 = Object.entries(五行統計).map(([k,v]) => ({五行:k, count:v}));
  const 日主Strength = 五行統計[日主五行] || 0;
  const strengthLevel = 日主Strength >= 3 ? "強" : 日主Strength >= 2 ? "中等" : "弱";
  
  // Useful God
  const 用神候選 = [];
  if (strengthLevel === "弱") {
    const 生扶 = { "木":"水", "火":"木", "土":"火", "金":"土", "水":"金" };
    用神候選.push({五行:生扶[日主五行],理由:日主五行+"弱需"+生扶[日主五行]+"生扶"});
  } else {
    const 剋洩 = { "木":"金", "火":"水", "土":"木", "金":"火", "水":"土" };
    用神候選.push({五行:剋洩[日主五行],理由:日主五行+"旺需"+剋洩[日主五行]+"剋洩"});
  }
  
  return {
    name: "", // to be filled
    birth: { year, month, day, hourBranch: hour },
    pillars: { 
      year: { stem: 年柱[0], branch: 年柱[1] }, 
      month: { stem: 月柱[0], branch: 月柱[1] }, 
      day: { stem: 日柱[0], branch: 日柱[1] }, 
      hour: { stem: 時柱[0], branch: 時柱[1] } 
    },
    dayMaster: { stem: 日柱[0], element: 日主五行 },
    fiveElements: { 木:五行統計.木, 火:五行統計.火, 土:五行統計.土, 金:五行統計.金, 水:五行統計.水 },
    usefulGod: { candidates: 用神候選.map(x => x.五行), reasoning: 用神候選.map(x => x.理由).join("、") },
    disclaimers: ["此為程式計算結果，AI 推論必須以此為準"]
  };
}

// ============ Main Handler ============
exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  const json = (status, obj) => ({ statusCode: status, headers: corsHeaders, body: JSON.stringify(obj) });

  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const { name, year, month, day, hourBranch, mode = "quick", question = "", dryRun = false } = JSON.parse(event.body || "{}");

    if (!year || !month || !day || !hourBranch) {
      return json(400, { error: "missing_input", message: "name/year/month/day/hourBranch required" });
    }

    // Layer 0: Build profile
    const baziProfile = calculateBazi(year, month, day, hourBranch);
    baziProfile.name = name || "訪客";
    
    if (dryRun) {
      return json(200, { ok: true, mode, baziProfile });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { error: "missing_server_key", message: "OPENAI_API_KEY not set on Netlify" });
    }

    // Build prompts
    const systemPrompt = [
      "你是專業八字命理顧問（偏現代、可落地），嚴格遵守：只能依據 baziProfile 推論。",
      "不可捏造不存在的四柱、十神、大運資訊；不確定要說「以目前資料推估」。",
      "輸出必須是 JSON，不要有多餘文字。"
    ].join("\n");

    const userPrompt = mode === "quick" 
      ? buildQuickPrompt(baziProfile) 
      : buildDeepPrompt(baziProfile, question);

    // Call OpenAI
    const reply = await callOpenAI(apiKey, systemPrompt, userPrompt, mode);
    
    return json(200, { ok: true, mode, baziProfile, result: reply });

  } catch (err) {
    console.error("Error:", err.message);
    let errorCode = "server_exception";
    if (err.message.includes("quota") || err.message.includes("exceeded")) errorCode = "quota_exceeded";
    return json(500, { error: errorCode, message: String(err.message || err) });
  }
};

function buildQuickPrompt(b) {
  return `請根據以下 baziProfile 產生「快速模式」JSON，欄位必須包含：
opening (2~4句、算命師口吻、先抓情緒/健康/壓力方向)
highlights (3~5點)
risk_flags (0~3個，像：消化/睡眠/焦慮/壓力/火氣…)
suggested_questions (3個可追問問題)

baziProfile: ${JSON.stringify(b, null, 2)}

輸出嚴格 JSON：
{ "opening": "...", "highlights": ["..."], "risk_flags": ["..."], "suggested_questions": ["...","...","..."] }
`.trim();
}

function buildDeepPrompt(b, question) {
  return `請根據 baziProfile 產生「深度模式」JSON，欄位必須包含：
sections: [ {title, summary, bullets} ]
action_plan: (3~7條可執行建議)
next_questions: (3個建議問題)

若使用者有提問，請優先回答：${question || "(無指定問題，請做完整深度解析)"}

baziProfile: ${JSON.stringify(b, null, 2)}

輸出嚴格 JSON：
{ "sections": [{"title":"...","summary":"...","bullets":["..."]}], "action_plan": ["..."], "next_questions": ["...","...","..."] }
`.trim();
}

function callOpenAI(apiKey, system, user, mode) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: mode === "quick" ? 900 : 1600,
      temperature: 0.6
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
      timeout: mode === "quick" ? 10000 : 20000,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body || "{}");
          if (json.error) reject(new Error(json.error.message));
          if (!res.statusCode || res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}`));
          const content = json?.choices?.[0]?.message?.content;
          if (!content) reject(new Error("回應為空"));
          
          // Try parse JSON
          try {
            resolve(JSON.parse(content));
          } catch(e) {
            // Return as text if not JSON
            resolve({ text: content });
          }
        } catch (e) {
          reject(new Error("解析失敗"));
        }
      });
    });

    req.on("error", (e) => reject(new Error("網路錯誤")));
    req.setTimeout(mode === "quick" ? 10000 : 20000, () => { req.destroy(); reject(new Error("超時")); });
    req.write(data);
    req.end();
  });
}
