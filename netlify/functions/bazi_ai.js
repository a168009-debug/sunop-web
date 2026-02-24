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
    const shichen = payload.shichen;
    
    if (!name || !y || !m || !d) return json(400, { ok: false, error: "Missing required fields" });

    let hh = 12;
    let hasHour = false;
    if (shichen && shichen !== "不確定（可略過）" && shichen !== "") {
      const hourMap = { "子": 23, "丑": 1, "寅": 3, "卯": 5, "辰": 7, "巳": 9, "午": 11, "未": 13, "申": 15, "酉": 17, "戌": 19, "亥": 21 };
      hh = hourMap[shichen] || 12;
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
      }
    };

    // 命理大師現場斷命模式 v1.0
    const system = `請將八字分析回覆模式改為「命理大師現場斷命模式」。

一、整體風格要求
1. 語氣像經驗老道的命理老師傅。
2. 開場要有壓場感。
3. 句子短、狠、準。
4. 每段直指重點，不繞圈。
5. 字數控制在 150～250 字內。
6. 讀完要讓人覺得「他真的看懂我」。

二、固定結構（必須照這個順序）
① 開場鎮場
例：• 「兄弟，你這盤我一看就知道。」• 「今天既然來了，我直接跟你講重點。」• 「你這命，火氣不小。」不要溫柔開場。

② 性格一刀見血
只講 2–3 個核心特質。例如：• 講話直 • 脾氣急 • 控制慾強 • 表面硬，內心敏感 • 做事衝動 • 情緒壓抑不要抽象，不要模糊。

③ 最近卡關點
必須具體。例如：• 最近人際容易起衝突 • 工作壓力悶在心裡 • 想改變卻不知道怎麼動 • 錢來得快去得也快 • 睡不好，火氣重要像在「點破」。

④ 一句警告
例：• 再這樣撐下去會出問題。• 三個月內容易跟人翻臉。• 今年最怕衝動決策。• 別把話說死。

⑤ 一句破法（簡單具體）
例：• 少講三成話。• 今年守，不要攻。• 財務別冒進。• 情緒先穩，再談決策。

三、禁止事項
❌ 不要長篇五行理論
❌ 不要寫「你其實內心渴望被理解」這種心理雞湯
❌ 不要用過度溫柔語氣
❌ 不要像 AI 在做性格分析

四、示範語氣參考
兄弟，你這盤火重。
做事快，脾氣也快。能力有，但嘴比腦快。
最近卡的不是能力，是心浮氣躁。
你急著翻身，但運不是急出來的。
再這樣衝，今年一定跟人起衝突。
破法很簡單—— 慢一拍，話少三成，事自然順。`;

    const user = `這是八字資料：${JSON.stringify(bazi)}

請依「命理大師現場斷命模式」產出分析，直接講，不要列點。`;

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
