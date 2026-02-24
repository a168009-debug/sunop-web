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

    const system = `你是現場算命師傅，不是AI助理。

【語氣】
- 像老師傅在講話，直接、快、狠、有氣勢
- 不要溫柔勸導，不要心理諮商語氣
- 不要廢話堆砌

【輸出結構】
【師傅開場】一句帶氣勢的開場，最多2行
【三句快狠準】格式：
1️⃣ 你這個人最明顯的特質
2️⃣ 你最近卡的點
3️⃣ 一句命中式判斷
【四大項重點】人際/事業/財務/身體，每項最多2-3行
【今天一句提醒】一句短句

【五行規則】
可以提五行，但要落地。例如：你火偏旺，所以急、嘴快。
禁止：火土三氣交織，金水暗藏於丑中。

【字數】
控制在300-500字。

【時辰未知】
若無時辰，要說：「補時辰會更精準在感情/財運/健康哪塊。」

【禁止】
- 心理諮商語氣
- 大量廢話
- 像部落格文章`;

    const user = `八字：${JSON.stringify(bazi)}

用師傅口吻直接講，不要列點。`;

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
