/**
 * MetaMind AI Bazi
 * - Quick: <= 8s, max_tokens 300
 * - Deep : <= 15s, max_tokens 800
 * - 超時/錯誤：回 fallback summary，不讓前端爆掉
 *
 * Netlify 環境變數必須設定：
 * OPENAI_API_KEY = 你的 OpenAI Key
 */
const QUICK = { model: "gpt-4o-mini", max_tokens: 300, timeout_ms: 8000 };
const DEEP = { model: "gpt-4o", max_tokens: 800, timeout_ms: 15000 };

const corsHeaders = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };

function json(statusCode, obj){
  return { statusCode, headers: corsHeaders, body: JSON.stringify(obj) };
}

function safeParse(body){
  try { return JSON.parse(body || "{}"); }
  catch(e){ return null; }
}

function buildSystemPrompt(mode){
  const base = `
你是「高階八字命理顧問」，語氣要像資深老師：精煉，直接、帶判斷，不要廢話。
你會用八字的術語（用神、喜忌，十神、格局、旺衰，流年、運勢節點）來說明，但不要堆滿名詞。
重要：你不知道使用者真實生活事件，不可編造具體事件（例如「你上週跟誰吵架」）。只能用「高概率傾向」+「可驗證提問」來呈現專業感。
輸出格式：
- opening：一段 120~220 字，像算命師第一句開口（先抓主軸：性格/近期卡點/身體壓力方向）
- answer：回答使用者問題（若沒有問題，給 3 個最可能想問的方向）
- followups：3 個可追問的問題（短句）
`;
  if(mode === "deep"){
    return base + `
Deep 模式要求：
- 更結構化：先結論→再理由→再建議
- 至少給：1) 用神/喜忌方向（用語要保守）
  2) 近一年注意點（健康/情緒/關係/金錢）
- 字數可到 500~900 字，但不要無限膨脹
`;
  }
  return base + `
Quick 模式要求：
- 以「一刀切重點」為主，總字數 220~380 字
- 不做長篇論證，先給方向與建議
`;
}

function buildUserPrompt(profile, question){
  const p = `
使用者資料：
- 姓名：${profile.name}
- 生日：${profile.year}-${profile.month}-${profile.day}
- 時辰：${profile.hourBranch}時

限制：
- 若八字排盤細節不足，你可以用「以日主與五行平衡的通用判讀」給方向，並在 followups 提問補齊（例如：出生地/是否跨日/是否確定時辰）。
`;
  if(question && question.trim()){
    return p + "\n使用者問題：" + question + "\n請直接回答。";
  }
  return p + "\n使用者沒有問問題：請用 opening 先抓主軸，answer 給 3 個最可能想問的方向。";
}

async function callOpenAI({apiKey, model, max_tokens, timeout_ms, systemPrompt, userPrompt}){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout_ms);
  try{
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens,
        temperature: 0.7
      })
    });
    const data = await resp.json();
    if(!resp.ok){
      return { ok:false, error:"OpenAI error " + resp.status, raw:data };
    }
    const text = data?.choices?.[0]?.message?.content || "";
    return { ok:true, text };
  }
  catch(e){
    const msg = (e && e.name === "AbortError") ? "timeout" : (e.message || "unknown_error");
    return { ok:false, error: msg };
  }
  finally { clearTimeout(t); }
}

function parseStructuredText(text){
  const out = { opening:"", answer:"", followups:[] };
  const norm = (text || "").trim();
  if(!norm){ out.answer = ""; return out; }

  const openingMatch = norm.match(/opening\s*[:：]\s*([\s\S]*?)(\n{2,}|answer\s*[:：])/i);
  const answerMatch = norm.match(/answer\s*[:：]\s*([\s\S]*?)(\n{2,}|followups\s*[:：]|$)/i);
  const followMatch = norm.match(/followups\s*[:：]\s*([\s\S]*?)$/i);

  if(openingMatch) out.opening = openingMatch[1].trim();
  if(answerMatch) out.answer = answerMatch[1].trim();
  if(followMatch){
    const lines = followMatch[1]
      .split("\n")
      .map(s => s.replace(/^\s*[-•\d.]+\s*/,"").trim())
      .filter(Boolean);
    out.followups = lines.slice(0,3);
  }

  if(!out.opening && !out.answer){ out.answer = norm; }
  return out;
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS") return json(200, { ok:true });
  if(event.httpMethod !== "POST") return json(405, { ok:false, error:"Method Not Allowed" });

  const body = safeParse(event.body);
  if(!body) return json(400, { ok:false, error:"bad_json" });

  const name = (body.name || "").trim();
  const year = Number(body.year);
  const month = Number(body.month);
  const day = Number(body.day);
  const hourBranch = (body.hourBranch || body.hourZhi || "").trim();
  const mode = (body.mode === "deep") ? "deep" : "quick";
  const question = (body.question || "").trim();

  if(!name || !year || !month || !day || !hourBranch){
    return json(400, { ok:false, error:"missing_fields", message:"需要 name/year/month/day/hourBranch" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    return json(500, { ok:false, error:"missing_api_key", message:"Netlify 未設定 OPENAI_API_KEY" });
  }

  const cfg = (mode === "deep") ? DEEP : QUICK;
  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt({name, year, month, day, hourBranch}, question);

  const r = await callOpenAI({ apiKey, model: cfg.model, max_tokens: cfg.max_tokens, timeout_ms: cfg.timeout_ms, systemPrompt, userPrompt });

  if(!r.ok){
    const fallback = {
      ok:true,
      fallback:true,
      mode,
      opening: "莊嚴地說一句：你今天會點進來，不是「好奇」，而是你心裡其實已經在找一個方向。先把你最卡的一題丟出來：是錢、是人、還是身體？（目前系統連線不穩，我先給你能落地的方向。）",
      answer: "系統連線暫時不穩（" + r.error + "）。你先用這三題自我定位：\n1) 最近最耗你的是「關係」還是「責任」？\n2) 睡眠/腸胃/肩頸哪個最明顯？\n3) 你要的是「翻身」還是「止血」？\n你回我一題，我會用 Deep 模式補完整結論。",
      followups: ["你最近最卡的是錢，人、還是身體？", "你的時辰有多確定？是否可能跨日？", "你希望我優先看事業還是感情？"]
    };
    return json(200, fallback);
  }

  const parsed = parseStructuredText(r.text);

  if(!parsed.opening){
    parsed.opening = "你好。我先不跟你客氣：你進來通常只有兩種人——一種是想驗證自己，另一種是已經被現實逼到要做取捨。你是哪一種？你先丟一題最想問的，我直接切重點。";
  }

  return json(200, { ok:true, fallback:false, mode, opening: parsed.opening, answer: parsed.answer, followups: parsed.followups });
};
