// netlify/functions/bazi_ai.js
const { Solar } = require("lunar-javascript");

function json(statusCode, body) {
  return { 
    statusCode, 
    headers: { 
      "Content-Type": "application/json; charset=utf-8", 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Headers": "Content-Type", 
      "Access-Control-Allow-Methods": "POST, OPTIONS" 
    }, 
    body: JSON.stringify(body) 
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  
  // only allow POST
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { ok: false, error: "Missing OPENAI_API_KEY" });

    const payload = JSON.parse(event.body || "{}");
    const name = (payload.name || "").trim();
    const y = Number(payload.year);
    const m = Number(payload.month);
    const d = Number(payload.day);
    const hourBranch = payload.hourBranch || "子";
    
    // 轉換時辰為小時
    const hourMap = { "子": 23, "丑": 1, "寅": 3, "卯": 5, "辰": 7, "巳": 9, "午": 11, "未": 13, "申": 15, "酉": 17, "戌": 19, "亥": 21 };
    const hh = hourMap[hourBranch] || 12;
    const mm = 0;
    const ss = 0;

    if (!name || !y || !m || !d) {
      return json(400, { ok: false, error: "Missing required fields: name/year/month/day" });
    }

    // 用 solar(陽曆)轉 lunar 再取八字
    const solar = Solar.fromYmdHms(y, m, d, hh, mm, ss);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    // 四柱
    const pillars = { 
      year: ec.getYear(), 
      month: ec.getMonth(), 
      day: ec.getDay(), 
      time: ec.getTime() 
    };

    // 十神（以日主為基準）
    const tenGod = { 
      year: ec.getYearTenGod(), 
      month: ec.getMonthTenGod(), 
      day: ec.getDayTenGod(), 
      time: ec.getTimeTenGod() 
    };

    // 五行（天干/地支五行）
    const wuxing = { 
      year: ec.getYearWuXing(), 
      month: ec.getMonthWuXing(), 
      day: ec.getDayWuXing(), 
      time: ec.getTimeWuXing() 
    };

    // 日主（天干）
    const dayGan = pillars.day?.slice(0, 1) || "";
    const dayZhi = pillars.day?.slice(1, 2) || "";

    // 藏干（地支藏干）
    const hideGan = { 
      year: ec.getYearHideGan(), 
      month: ec.getMonthHideGan(), 
      day: ec.getDayHideGan(), 
      time: ec.getTimeHideGan() 
    };

    const bazi = { 
      name, 
      solar: { y, m, d, hh, mm, ss }, 
      lunar: { ymd: lunar.toString(), ganZhiYear: lunar.getYearInGanZhiExact() }, 
      pillars, 
      dayMaster: { gan: dayGan, zhi: dayZhi }, 
      tenGod, 
      wuxing, 
      hideGan 
    };

    // 高深莫測風水師口吻
    const system = `你是一位老派但精準的命理師兼風水師，講話克制、深沉、像在點破天機。
規則：
1) 必須以「八字結構化數據」為依據，不能胡編具體事件。
2) 不要指責當事人自私，不要情緒勒索，用"點到為止"的語氣。
3) 輸出用繁體中文。
4) 結構固定：①命局骨架 ②五行偏頗與用神傾向 ③人際/事業/財務/健康四項提醒（各2-3句）④一句"點醒"的斷語（短句）。`;

    const user = `以下是當事人的八字計算結果（結構化）：
${JSON.stringify(bazi, null, 2)}
請按規則輸出。`;

    // Call OpenAI
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { 
        "Authorization": "Bearer " + apiKey, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json(500, { ok: false, error: "OpenAI API error", detail: t });
    }

    const data = await resp.json();
    const text = data.output_text || (data.output?.[0]?.content?.[0]?.text) || "";

    return json(200, { ok: true, bazi, reply: { text } });

  } catch (e) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
};
