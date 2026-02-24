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
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(500, { ok: false, error: "Missing OPENAI_API_KEY" });

    const payload = JSON.parse(event.body || "{}");
    const name = (payload.name || "").trim();
    const y = Number(payload.year);
    const m = Number(payload.month);
    const d = Number(payload.day);
    const hourBranch = payload.hourBranch;
    
    if (!name || !y || !m || !d) return json(400, { ok: false, error: "Missing required fields" });

    let hh = 12;
    let hasHour = false;
    if (hourBranch && hourBranch !== "") {
      const hourMap = { "子": 23, "丑": 1, "寅": 3, "卯": 5, "辰": 7, "巳": 9, "午": 11, "未": 13, "申": 15, "酉": 17, "戌": 19, "亥": 21 };
      hh = hourMap[hourBranch] || 12;
      hasHour = true;
    }

    const solar = Solar.fromYmdHms(y, m, d, hh, 0, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    const yearPillar = ec.getYear();
    const monthPillar = ec.getMonth();
    const dayPillar = ec.getDay();
    const timePillar = hasHour ? ec.getTime() : "未知";
    
    const dayGan = dayPillar.charAt(0);
    const dayZhi = dayPillar.charAt(1);

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

    const yearGan = yearPillar.charAt(0);
    const monthGan = monthPillar.charAt(0);
    const hourGan = hasHour ? timePillar.charAt(0) : "未知";

    const bazi = {
      name,
      pillars: { year: yearPillar, month: monthPillar, day: dayPillar, time: timePillar },
      dayMaster: { gan: dayGan, zhi: dayZhi },
      tenGod: {
        year: getTenGod(dayGan, yearGan),
        month: getTenGod(dayGan, monthGan),
        day: getTenGod(dayGan, dayGan),
        time: hasHour ? getTenGod(dayGan, hourGan) : "未知"
      },
      wuxing: {
        year: wuxingMap[yearGan],
        month: wuxingMap[monthGan],
        day: wuxingMap[dayGan],
        time: hasHour ? wuxingMap[hourGan] : "未知"
      },
      hasHour: hasHour
    };

    // 師傅口吻 Prompt
    const system = `你是「現場算命師/命理師傅」，不是心理諮商師。
【口吻】
- 開場要像師傅：一句招呼 + 一句點題（兄弟/老闆/你這盤…）
- 允許提金木水火土，但必須翻譯成現象（火旺→急、講話衝、睡眠淺）
- 禁止長篇堆術語
- 禁止雞湯與空話
- 禁止猜測使用者人生事件

【輸出格式（硬性）】
1) 開場（1句，不超過18字）
2) 你這盤最像的三個特徵（3條，每條12~20字）
3) 你最容易出事的雷點（2條，每條12~20字）
4) 一句命中（1句，<=20字，犀利）
5) 破局建議（3條，每條要具體可做）

總長度控制在 120~220 字內。

【若時辰未知】
- 明講：「你沒給時辰，我先做概略盤」
- 給的結論要加一句：「補時辰會更精準在___」

【回傳】
只回傳以上內容，不要前言、不要解釋流程。`;

    const user = `八字資料：${JSON.stringify(bazi)}

請用師傅口吻輸出，直接講，不要列點。`;

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.7 })
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
