// netlify/functions/bazi_ai.js
// Node 18+ on Netlify supports global fetch
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
  const name = (body.name || "").toString().trim();
  const year = Number(body.year);
  const month = Number(body.month);
  const day = Number(body.day);
  const hourBranch = (body.hourBranch || body.hourZhi || body.hour || "").toString().trim();
  return { name, year, month, day, hourBranch };
}
function validateProfile(p) {
  if (!p.name) return "缺少 name";
  if (!p.year || !p.month || !p.day) return "缺少 year/month/day";
  if (!p.hourBranch) return "缺少 hourBranch";
  return null;
}
function buildSystemPrompt(mode) {
  const base = `你是一位資深八字命理顧問（偏實戰、直指核心，不灌雞湯）。
你要用「高階命理口吻」回覆：先一句命中式判語（讓人覺得準），再用條列拆解。
語氣：沉穩、精準、略帶江湖師傅感，但不要玄到空泛。
禁忌：不要要求使用者重新提供已給的出生資料；不要說你看不到資料。`;
  if (mode === "deep") {
    return base + `
深度模式要求：
- 先給 1 句「命中判語」
- 再給 4 段：①近況總覽（情緒/身體/壓力）②工作財務節奏 ③感情人際 ④3 個可執行的破局動作
- 最後給 3 個追問問題（讓他更覺得你抓到點）
字數控制：800 tokens 內，避免超時。`;
  }
  return base + `
快速模式要求：
- 先給 1 句命中判語（<=22字）
- 再給 3 個重點（每點<=40字）
- 最後給 2 個追問問題
字數控制：300 tokens 內，避免超時。`;
}
function buildUserPrompt(profile, question) {
  const { name, year, month, day, hourBranch } = profile;
  if (question === "__INTRO__") {
    return `
使用者：${name}
出生：${year}-${month}-${day}（時辰：${hourBranch}）
請直接對他「開口」：
1) 用命理顧問口吻先打招呼，像是你知道他為什麼來
2) 先切入他最可能正在糾結的：心緒/睡眠/身體火氣 或 工作壓力/財務節奏
3) 給他一句「你今天來問的，其實是______」的判語
4) 給 2 個你建議他馬上可以問 AI 的問題（作為引導）`;
  }
  return `
使用者：${name}
出生：${year}-${month}-${day}（時辰：${hourBranch}）
他的問題：
${question}
請用命理顧問口吻直接回答，重點要落地、可執行，不要泛泛而談。`;
}
async function callOpenAI({ apiKey, model, max_tokens, timeoutMs, systemPrompt, userPrompt }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
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
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return { ok: false, error: "openai_error", detail: data };
    }
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    return { ok: true, text };
  }
  catch (e) {
    return { ok: false, error: "timeout_or_network", detail: String(e && e.message ? e.message : e) };
  }
  finally { clearTimeout(t); }
}
function fallbackReply(profile, question) {
  const name = profile?.name || "朋友";
  if (question === "__INTRO__") {
    return {
      opening: "你好，" + name + "。你今天來，不是想聽大道理，你要的是「一句話把你最近卡住的點說穿」。先別急，先從『睡眠/火氣/壓力』或『錢與決策』挑一個我就能切進去。",
      text: "（系統忙碌中）你先回我：最近更像「睡不沉、火氣上」還是「腦子停不下來、一直算」？我會直接給你破局法。",
      suggested_questions: [
        "我最近睡眠、火氣、腸胃哪個最該先處理？",
        "我這三個月工作/財務節奏該怎麼安排？"
      ],
      fallback: true
    };
  }
  return {
    text: "我先給你一句短判：你這題要的是「結論與取捨」，不是更多資訊。你補一句：你最在意的是感情、錢、還是身體？我會用最短路徑回答你。",
    fallback: true
  };
}
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const body = safeParse(event.body);
  if (!body) return json(400, { error: "bad_json", message: "JSON 解析失敗" });
  const profile = normalizeProfile(body);
  const err = validateProfile(profile);
  if (err) return json(400, { error: "missing_input", message: err });
  const mode = (body.mode === "deep") ? "deep" : "quick";
  const question = (body.question || "__INTRO__").toString().trim();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fb = fallbackReply(profile, question);
    return json(200, { ok: true, mode, reply: fb, note: "OPENAI_API_KEY not set", fallback: true });
  }
  const cfg = (mode === "deep") ? DEEP : QUICK;
  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt(profile, question);
  const r = await callOpenAI({ apiKey, model: cfg.model, max_tokens: cfg.max_tokens, timeoutMs: cfg.timeoutMs, systemPrompt, userPrompt });
  if (!r.ok || !r.text) {
    const fb = fallbackReply(profile, question);
    return json(200, { ok: true, mode, reply: fb, error: r.error, detail: r.detail, fallback: true });
  }
  if (question === "__INTRO__") {
    return json(200, { ok: true, mode, reply: { opening: r.text, text: r.text } });
  }
  return json(200, { ok: true, mode, reply: { text: r.text } });
};
