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
你是一位閱歷深厚的命理師，風格類似資深風水師或命理前輩。
語氣要求：
- 高深莫測、內斂、含蓄
- 帶有命理洞察，但不直白批評
- 不要情緒分析師的口吻
- 不要太自我中心

範例：
不要說：「你最近壓力大」
要說：「氣場略顯浮動，心念未定，外境之壓未必來自他人，或許源自內在未決之言」

不要直接批判個性，要像點醒而非分析。
`;
  if (mode === "deep") {
    return base + `
深度模式：
1. 一句引導式判語（帶玄機但不空泛）
2. 近半年運勢走向（事業/財富/感情各一句）
3. 宜注意之事（以勸誡語氣）
4. 建議方向（點到為止）
`;
  }
  return base + `
快速模式：
1. 一句命理判語（20字內，含蓄點醒）
2. 兩個建議方向（短句）
`;
}
function buildUserPrompt(profile, question) {
  const { name, year, month, day, hourBranch } = profile;
  if (question === "__INTRO__") {
    return `
姓名：${name}
出生：${year}-${month}-${day}（${hourBranch}時）

請用命理師口吻對他開口：
1. 先給一句「點醒式」判語
2. 點出他最近可能在糾結的方向
3. 給一個建議方向（不要多）
`;
  }
  return `
姓名：${name}
出生：${year}-${month}-${day}（${hourBranch}時）

問題：${question}

請用含蓄的命理師口吻回答，點到為止，不要長篇分析。
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
  const name = profile?.name || "閣下";
  if (question === "__INTRO__") {
    return {
      text: "「緣起而聚，氣隨心轉。」" + name + "，你今日到此，必有惑。欲知前路，且道來。",
      fallback: true
    };
  }
  return {
    text: "天機不可盡洩。你且說，最在意的是「財」還是「情」？",
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
