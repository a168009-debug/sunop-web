const { Lunar, LunarUtil } = require("lunar-javascript");

const QUICK = { model: "gpt-4o-mini", max_tokens: 350, timeoutMs: 8000 };
const DEEP = { model: "gpt-4o", max_tokens: 900, timeoutMs: 15000 };
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

// 使用 lunar-javascript 計算八字
function calculateBazi(year, month, day, hourBranch) {
  const hourMap = { "子": 23, "丑": 1, "寅": 3, "卯": 5, "辰": 7, "巳": 9, "午": 11, "未": 13, "申": 15, "酉": 17, "戌": 19, "亥": 21 };
  const hour = hourMap[hourBranch] || 12;
  
  try {
    const lunar = Lunar.fromYmdHms(year, month, day, hour, 0, 0);
    const bazi = lunar.getBaZi();
    const tiangan = bazi.getTianGan();
    const dizhi = bazi.getDiZhi();
    
    const dayMaster = tiangan[1];
    const dayStem = tiangan[1];
    const dayZhi = dizhi[1];
    
    const tenGodMap = {
      "甲": { "甲": "比肩", "乙": "劫財", "丙": "食神", "丁": "傷官", "戊": "偏財", "己": "正財", "庚": "七殺", "辛": "正官", "壬": "偏印", "癸": "正印" },
      "乙": { "甲": "劫財", "乙": "比肩", "丙": "傷官", "丁": "食神", "戊": "正財", "己": "偏財", "庚": "正官", "辛": "七殺", "壬": "正印", "癸": "偏印" },
      "丙": { "甲": "偏印", "乙": "正印", "丙": "比肩", "丁": "劫財", "戊": "食神", "己": "傷官", "庚": "偏財", "辛": "正財", "壬": "七殺", "癸": "正官" },
      "丁": { "甲": "正印", "乙": "偏印", "丙": "劫財", "丁": "比肩", "戊": "傷官", "己": "食神", "庚": "正財", "辛": "偏財", "壬": "正官", "癸": "七殺" },
      "戊": { "甲": "七殺", "乙": "正官", "丙": "偏印", "丁": "正印", "戊": "比肩", "己": "劫財", "庚": "食神", "辛": "傷官", "壬": "偏財", "癸": "正財" },
      "己": { "甲": "正官", "乙": "七殺", "丙": "正印", "丁": "偏印", "戊": "劫財", "己": "比肩", "庚": "傷官", "辛": "食神", "壬": "正財", "癸": "偏財" },
      "庚": { "甲": "偏財", "乙": "正財", "丙": "七殺", "丁": "正官", "戊": "偏印", "己": "正印", "庚": "比肩", "辛": "劫財", "壬": "食神", "癸": "傷官" },
      "辛": { "甲": "正財", "乙": "偏財", "丙": "正官", "丁": "七殺", "戊": "正印", "己": "偏印", "庚": "劫財", "辛": "比肩", "壬": "傷官", "癸": "食神" },
      "壬": { "甲": "食神", "乙": "傷官", "丙": "偏財", "丁": "正財", "戊": "七殺", "己": "正官", "庚": "偏印", "辛": "正印", "壬": "比肩", "癸": "劫財" },
      "癸": { "甲": "傷官", "乙": "食神", "丙": "正財", "丁": "偏財", "戊": "正官", "己": "七殺", "庚": "正印", "辛": "偏印", "壬": "劫財", "癸": "比肩" }
    };
    const getTenGod = (dayG, otherG) => tenGodMap[dayG]?.[otherG] || "";
    
    const wuxingMap = { "甲": "木", "乙": "木", "丙": "火", "丁": "火", "戊": "土", "己": "土", "庚": "金", "辛": "金", "壬": "水", "癸": "水" };
    
    return {
      yearGan: tiangan[0], yearZhi: dizhi[0],
      monthGan: tiangan[1], monthZhi: dizhi[1],
      dayGan: dayStem, dayZhi: dayZhi,
      hourGan: tiangan[2], hourZhi: dizhi[2],
      dayMaster: dayMaster,
      yearWu: wuxingMap[tiangan[0]], monthWu: wuxingMap[tiangan[1]],
      dayWu: wuxingMap[dayStem], hourWu: wuxingMap[tiangan[2]],
      yearShi: getTenGod(dayMaster, tiangan[0]),
      monthShi: getTenGod(dayMaster, tiangan[1]),
      dayShi: getTenGod(dayMaster, dayStem),
      hourShi: getTenGod(dayMaster, tiangan[2])
    };
  } catch (e) {
    return null;
  }
}

function buildSystemPrompt(mode) {
  const base = `你是一位閱歷深厚的命理師，風格類似資深風水師或命理前輩。語氣要求：高深莫測、內斂、含蓄，帶有命理洞察，但不直白批評。`;
  if (mode === "deep") return base + `\n深度模式：一句判語 → 體用分析 → 近半年運勢 → 宜注意之事 → 建議方向`;
  return base + `\n快速模式：一句判語 → 日主特質 → 兩個建議方向`;
}

function buildUserPrompt(profile, bazi, question) {
  const { name, year, month, day, hourBranch } = profile;
  const b = bazi || {};
  const baziInfo = `八字：年 ${b.yearGan}${b.yearZhi} ${b.yearShi} | 月 ${b.monthGan}${b.monthZhi} ${b.monthShi} | 日 ${b.dayGan}${b.dayZhi} ${b.dayShi} | 時 ${b.hourGan}${b.hourZhi} ${b.hourShi}。日主${b.dayMaster}。`;
  if (question === "__INTRO__") return `姓名${name}，${year}-${month}-${day}（${hourBranch}時）。${baziInfo}請用命理師口吻：1.一句點醒判語 2.最近糾結方向 3.一個建議`;
  return `姓名${name}，${year}-${month}-${day}（${hourBranch}時）。${baziInfo}問題：${question}請用含蓄命理師口吻回答`;
}

async function callOpenAI(cfg, systemPrompt, userPrompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "no api key" };
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: cfg.max_tokens, temperature: 0.8 })
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d };
    return { ok: true, text: d?.choices?.[0]?.message?.content?.trim() || "" };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { clearTimeout(timeout); }
}

function fallbackReply(profile, question) {
  const name = profile?.name || "閣下";
  return { text: question === "__INTRO__" ? "「緣起而聚，氣隨心轉。」" + name + "，你今日到此，必有惑。" : "天機不可盡洩。你且說，最在意的是「財」還是「情」？" };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const body = safeParse(event.body);
  if (!body) return json(400, { error: "JSON 解析失敗" });
  const profile = normalizeProfile(body);
  const err = validateProfile(profile);
  if (err) return json(400, { error: err });
  const mode = body.mode === "deep" ? "deep" : "quick";
  const question = (body.question || "__INTRO__").toString().trim();
  const bazi = calculateBazi(profile.year, profile.month, profile.day, profile.hourBranch);
  const cfg = mode === "deep" ? DEEP : QUICK;
  const result = await callOpenAI(cfg, buildSystemPrompt(mode), buildUserPrompt(profile, bazi, question));
  if (!result.ok || !result.text) return json(200, { ok: true, mode, reply: fallbackReply(profile, question), fallback: true });
  return json(200, { ok: true, mode, reply: { text: result.text }, bazi });
};
