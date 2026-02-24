const https = require("https");

const QUICK_CONFIG = { model: "gpt-4o-mini", max_tokens: 300, timeout: 8000 };
const DEEP_CONFIG = { model: "gpt-4o", max_tokens: 800, timeout: 15000 };

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)
  ]);
}

function calculateBazi(year, month, day, hourBranch) {
  const 天干 = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const 地支 = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const 地支五行 = { "子":"水","亥":"水","寅":"木","卯":"木","巳":"火","午":"火","申":"金","酉":"金","丑":"土","辰":"土","未":"土","戌":"土" };
  
  const 年柱 = 天干[(year - 4) % 10] + 地支[(year - 4) % 12];
  const 年干索引 = 天干.indexOf(年柱[0]);
  const 起始索引 = [2,4,6,8,0][Math.floor(年干索引 / 2)] || 0;
  const 月柱 = 天干[(起始索引 + month - 1) % 10] + ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"][month - 1];
  
  const 基準日 = new Date(1900, 1, 15);
  const 天數差 = Math.floor((new Date(year, month - 1, day) - 基準日) / (1000 * 60 * 60 * 24));
  const 日柱 = 天干[(天數差 % 10 + 10) % 10] + 地支[(天數差 % 12 + 12) % 12];
  const 日干索引 = 天干.indexOf(日柱[0]);
  const 時柱Index = 地支.indexOf(hourBranch);
  const 時柱 = 天干[([0,2,4,6,8][Math.floor(日干索引 / 2)] || 0) + 時柱Index] + hourBranch;
  
  const allPillars = 年柱 + 月柱 + 日柱 + 時柱;
  const 五行統計 = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  for (let char of allPillars) {
    const elem = 地支五行[char];
    if (elem) 五行統計[elem]++;
  }
  
  const 日主五行 = 地支五行[日柱[1]];
  const 日主Strength = 五行統計[日主五行] || 0;
  const strengthLevel = 日主Strength >= 3 ? "強" : 日主Strength >= 2 ? "中等" : "弱";
  
  const 用神候選 = [];
  if (strengthLevel === "弱") {
    const 生扶 = { "木":"水", "火":"木", "土":"火", "金":"土", "水":"金" };
    用神候選.push({五行:生扶[日主五行],理由:日主五行+"弱需"+生扶[日主五行]});
  } else {
    const 剋洩 = { "木":"金", "火":"水", "土":"木", "金":"火", "水":"土" };
    用神候選.push({五行:剋洩[日主五行],理由:日主五行+"旺需"+剋洩[日主五行]});
  }
  
  return {
    name: "",
    birth: { year, month, day, hourBranch },
    pillars: { year: { stem: 年柱[0], branch: 年柱[1] }, month: { stem: 月柱[0], branch: 月柱[1] }, day: { stem: 日柱[0], branch: 日柱[1] }, hour: { stem: 時柱[0], branch: 時柱[1] } },
    dayMaster: { stem: 日柱[0], element: 日主五行 },
    strength: strengthLevel,
    fiveElements: { 木:五行統計.木, 火:五行統計.火, 土:五行統計.土, 金:五行統計.金, 水:五行統計.水 },
    usefulGod: { candidates: 用神候選.map(x => x.五行), reasoning: 用神候選.map(x => x.理由).join("、") }
  };
}

exports.handler = async (event) => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json; charset=utf-8" };
  const json = (status, obj) => ({ statusCode: status, headers: corsHeaders, body: JSON.stringify(obj) });

  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const body = JSON.parse(event.body || "{}");
    let { name, year, month, day, hourBranch, mode = "quick", question = "", dryRun = false } = body;
    if (!hourBranch && body.hour) hourBranch = body.hour;
    if (!year || !month || !day || !hourBranch) return json(400, { error: "missing_input", message: "name/year/month/day/hourBranch required" });

    const baziProfile = calculateBazi(year, month, day, hourBranch);
    baziProfile.name = name || "訪客";
    
    if (dryRun) return json(200, { ok: true, mode, baziProfile });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { error: "missing_server_key", message: "OPENAI_API_KEY not set" });

    const config = mode === "deep" ? DEEP_CONFIG : QUICK_CONFIG;
    const systemPrompt = getSystemPrompt(mode, baziProfile);
    const userPrompt = getUserPrompt(mode, baziProfile, question);

    const aiResponse = await withTimeout(callOpenAI(apiKey, systemPrompt, userPrompt, config), config.timeout);
    return json(200, { ok: true, mode, baziProfile, result: aiResponse });

  } catch (err) {
    const errorMsg = err.message || String(err);
    console.error("Error:", errorMsg);
    
    if (errorMsg === "timeout") {
      return json(200, { fallback: true, summary: "目前能量場顯示近期壓力偏高，建議先從作息與情緒穩定開始調整。", suggestions: ["最近是否睡眠品質下降？", "是否工作決策壓力增加？", "是否有家庭責任壓力？"] });
    }
    
    return json(500, { error: errorMsg.includes("quota") ? "quota_exceeded" : "server_exception", message: errorMsg });
  }
};

function getSystemPrompt(mode, profile) {
  const base = "你是專業八字命理顧問（高階命理語氣）。嚴格遵守：只能依據 baziProfile 推論。不可捏造資訊。";
  if (mode === "deep") return base + "\n\n【深度模式】請給出結構化分析：sections(標題/摘要/要點)、action_plan(3-7條建議)、next_questions(3個問題)。";
  return base + "\n\n【快速模式】請簡短回覆：opening(2-4句)、highlights(3-5點)、risk_flags、suggested_questions(3個)。";
}

function getUserPrompt(mode, profile, question) {
  const pj = JSON.stringify(profile, null, 2);
  if (mode === "deep") return `根據以下八字資料${question ? "回答：「" + question + "」" : "做完整深度解析"}：\n\n${pj}\n\n輸出 JSON：{ sections: [{title, summary, bullets}], action_plan: [], next_questions: [] }`;
  return `根據以下八字資料產生快速解讀：\n\n${pj}\n\n輸出 JSON：{ opening, highlights, risk_flags, suggested_questions }`;
}

function callOpenAI(apiKey, system, user, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: config.max_tokens,
      temperature: 0.6
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "Content-Length": Buffer.byteLength(data) },
      timeout: config.timeout,
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
          try { resolve(JSON.parse(content)); } catch(e) { resolve({ opening: content }); }
        } catch (e) { reject(new Error("解析失敗")); }
      });
    });

    req.on("error", (e) => reject(new Error("網路錯誤")));
    req.setTimeout(config.timeout, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}
