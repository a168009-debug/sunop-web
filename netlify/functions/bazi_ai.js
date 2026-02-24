// netlify/functions/bazi_ai.js
const QUICK = { model: "gpt-4o-mini", max_tokens: 300, timeoutMs: 8000 };
const DEEP = { model: "gpt-4o", max_tokens: 800, timeoutMs: 15000 };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};
function json(statusCode, obj) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(obj) };
}
function safeParse(body) {
  try { return JSON.parse(body || "{}"); }
  catch { return null; }
}
function normalizeProfile(body) {
  return {
    name: (body.name || "").toString().trim(),
    year: Number(body.year),
    month: Number(body.month),
    day: Number(body.day),
    hourBranch: (body.hourBranch || "").toString().trim(),
  };
}
function validateProfile(p) {
  if (!p.name) return "缺少 name";
  if (!p.year || !p.month || !p.day) return "缺少 year/month/day";
  if (!p.hourBranch) return "缺少 hourBranch";
  return null;
}
function buildSystemPrompt(mode) {
  const base = `
你是一位資深八字命理顧問。
語氣沉穩、精準、直接。
先給一句命中式判語，再用條列式拆解。
不要灌雞湯。
不要要求使用者重複提供出生資料。
`;
  if (mode === "deep") {
    return base + `
深度模式：
1. 一句命中判語
2. 近況（情緒/壓力）
3. 財務與工作
4. 感情與人際
5. 三個可執行建議
`;
  }
  return base + `
快速模式：
1. 一句命中判語（20字內）
2. 三個重點
3. 兩個追問問題
`;
}
function buildUserPrompt(profile, question) {
  const { name, year, month, day, hourBranch } = profile;
  if (question === "__INTRO__") {
    return `
姓名：${name}
出生：${year}-${month}-${day}（${hourBranch}時）
請直接開口：
1. 告訴他為什麼他會來
2. 先猜他最近的核心困擾
3. 給一句命中式判語
`;
  }
  return `
姓名：${name}
出生：${year}-${month}-${day}（${hourBranch}時）
問題：
${question}
請用命理口吻回答，務實可執行。
`;
}
async function callOpenAI({ apiKey, model, max_tokens, timeoutMs, systemPrompt, userPrompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens,
        temperature: 0.8,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data };
    }
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    return { ok: true, text };
  }
  catch (e) {
    return { ok: false, error: e.message };
  }
  finally { clearTimeout(timeout); }
}
function fallbackReply(profile, question) {
  const name = profile?.name || "朋友";
  if (question === "__INTRO__") {
    return {
      opening: "你好，" + name + "。你今天來，不是為了聽好聽的話，你是來確認一個答案。",
      text: "你現在糾結的是方向，而不是能力。",
      fallback: true
    };
  }
  return {
    text: "這題你要的是結論，而不是分析。你再補一句：你最在意的是錢、感情、還是身體？",
    fallback: true
  };
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }
  const body = safeParse(event.body);
  if (!body) {
    return json(400, { error: "JSON 解析失敗" });
  }
  const profile = normalizeProfile(body);
  const err = validateProfile(profile);
  if (err) {
    return json(400, { error: err });
  }
  const mode = body.mode === "deep" ? "deep" : "quick";
  const question = (body.question || "__INTRO__").toString().trim();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fb = fallbackReply(profile, question);
    return json(200, { ok: true, mode, reply: fb, fallback: true });
  }
  const cfg = mode === "deep" ? DEEP : QUICK;
  const result = await callOpenAI({
    apiKey,
    model: cfg.model,
    max_tokens: cfg.max_tokens,
    timeoutMs: cfg.timeoutMs,
    systemPrompt: buildSystemPrompt(mode),
    userPrompt: buildUserPrompt(profile, question),
  });
  if (!result.ok || !result.text) {
    const fb = fallbackReply(profile, question);
    return json(200, { ok: true, mode, reply: fb, fallback: true });
  }
  return json(200, { ok: true, mode, reply: { text: result.text } });
};
