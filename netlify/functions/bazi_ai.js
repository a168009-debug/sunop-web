const https = require("https");

// ============ Layer 0: Bazi Calculator (Deterministic) ============
function calculateBazi(year, month, day, hour) {
  const 天干 = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const 地支 = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
  const 地支五行 = { "子":"水","亥":"水","寅":"木","卯":"木","巳":"火","午":"火","申":"金","酉":"金","丑":"土","辰":"土","未":"土","戌":"土" };
  
  // Calculate pillars
  const 年柱 = 天干[(year - 4) % 10] + 地支[(year - 4) % 12];
  const 年干索引 = 天干.indexOf(年柱[0]);
  const 起始索引 = [2,4,6,8,0][Math.floor(年干索引 / 2)] || 0;
  const 月柱 = 天干[(起始索引 + month - 1) % 10] + ["寅","卯","辰","巳","午","未","申","酉","戌","亥","子","丑"][month - 1];
  
  // Day pillar calculation
  const 基準日 = new Date(1900, 1, 15);
  const 天數差 = Math.floor((new Date(year, month - 1, day) - 基準日) / (1000 * 60 * 60 * 24));
  const 日柱 = 天干[(天數差 % 10 + 10) % 10] + 地支[(天數差 % 12 + 12) % 12];
  const 日干索引 = 天干.indexOf(日柱[0]);
  
  // Hour pillar
  const 時干索引 = [0, 2, 4, 6, 8][Math.floor(日干索引 / 2)] || 0;
  const 時柱 = 天干[(時干索引 + 地支.indexOf(hour)) % 10] + hour;
  
  // Calculate Five Elements distribution
  const allPillars = 年柱 + 月柱 + 日柱 + 時柱;
  const 五行統計 = { 木:0, 火:0, 土:0, 金:0, 水:0 };
  for (let char of allPillars) {
    const elem = 地支五行[char];
    if (elem) 五行統計[elem]++;
  }
  
  // Day Master (日主)
  const 日主五行 = 地支五行[日柱[1]];
  
  // Ten Gods (十神) - simplified
  const 日干 = 日柱[0];
  const 十神表 = {
    "甲":{"甲":"比肩","乙":"劫財","丙":"食神","丁":"傷官","戊":"偏財","己":"正財","庚":"七殺","辛":"正官","壬":"偏印","癸":"正印"},
    "乙":{"甲":"劫財","乙":"比肩","丙":"傷官","丁":"食神","戊":"正財","己":"偏財","庚":"正官","辛":"七殺","壬":"正印","癸":"偏印"},
    "丙":{"甲":"偏印","乙":"正印","丙":"比肩","丁":"劫財","戊":"偏神","己":"傷官","庚":"偏財","辛":"正財","壬":"七殺","癸":"正官"},
    "丁":{"甲":"正印","乙":"偏印","丁":"比肩","戊":"傷官","己":"食神","庚":"正財","辛":"偏財","壬":"正官","癸":"七殺"},
    "戊":{"甲":"七殺","乙":"正官","丙":"偏印","丁":"正印","戊":"比肩","己":"劫財","庚":"食神","辛":"傷官","壬":"偏財","癸":"正財"},
    "己":{"甲":"正官","乙":"七殺","丙":"正印","丁":"偏印","戊":"劫財","己":"比肩","庚":"傷官","辛":"食神","壬":"正財","癸":"偏財"},
    "庚":{"甲":"偏財","乙":"正財","丙":"七殺","丁":"正官","戊":"偏印","己":"正印","庚":"比肩","辛":"劫財","壬":"食神","癸":"傷官"},
    "辛":{"甲":"正財","乙":"偏財","丙":"正官","丁":"七殺","戊":"正印","己":"偏印","庚":"劫財","辛":"比肩","壬":"傷官","癸":"食神"},
    "壬":{"甲":"食神","乙":"傷官","丙":"偏財","丁":"正財","戊":"七殺","己":"正官","庚":"偏印","辛":"正印","壬":"比肩","癸":"劫財"},
    "癸":{"甲":"傷官","乙":"食神","丙":"正財","丁":"偏財","戊":"正官","己":"七殺","庚":"正印","辛":"偏印","壬":"劫財","癸":"比肩"}
  };
  
  const 日主十神 = 十神表[日干];
  
  // Strength analysis (simplified)
  const 五行分佈 = Object.entries(五行統計).map(([k,v]) => ({五行:k, count:v}));
  const 日主Strength = 五行統計[日主五行] || 0;
  const strengthLevel = 日主Strength >= 3 ? "強" : 日主Strength >= 2 ? "中等" : "弱";
  
  // Useful God (用神) - simplified logic
  const 用神候選 = [];
  if (strengthLevel === "弱") {
    if (日主五行 === "木") 用神候選.push({五行:"水",理由:"水生木"});
    else if (日主五行 === "火") 用神候選.push({五行:"木",理由:"木生火"});
    else if (日主五行 === "土") 用神候選.push({五行:"火",理由:"火生土"});
    else if (日主五行 === "金") 用神候選.push({五行:"土",理由:"土生金"});
    else if (日主五行 === "水") 用神候選.push({五行:"金",理由:"金生水"});
  } else {
    if (日主五行 === "木") 用神候選.push({五行:"金",理由:"金克木"});
    else if (日主五行 === "火") 用神候選.push({五行:"水",理由:"水克火"});
    else if (日主五行 === "土") 用神候選.push({五行:"木",理由:"木克土"});
    else if (日主五行 === "金") 用神候選.push({五行:"火",理由:"火克金"});
    else if (日主五行 === "水") 用神候選.push({五行:"土",理由:"土克水"});
  }
  
  return {
    pillars: {年柱, 月柱, 日柱, 時柱},
    日主: {五行: 日主五行, 十神: 日主十神, 強弱: strengthLevel},
    五行分佈,
    用神候選,
    timestamp: Date.now()
  };
}

// ============ Main Handler ============
exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { year, month, day, hour, mode, dryRun } = JSON.parse(event.body || "{}");
    const apiKey = process.env.OPENAI_API_KEY;

    // Validation
    if (!year || !month || !day || !hour) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "缺少必要參數: year, month, day, hour" }) };
    }

    // Layer 0: Calculate Bazi Profile
    const baziProfile = calculateBazi(year, month, day, hour);
    
    // Dry run mode - return only profile
    if (dryRun) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ profile: baziProfile }) };
    }

    // No API key = error
    if (!apiKey) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "請在 Netlify 設定 OPENAI_API_KEY" }) };
    }

    // Determine mode
    const isDeep = mode === "deep";
    const maxTokens = isDeep ? 1500 : 700;
    const temperature = isDeep ? 0.6 : 0.7;

    // Generate prompt based on mode
    const systemPrompt = isDeep ? getDeepPrompt(baziProfile) : getQuickPrompt(baziProfile);
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: isDeep ? "請給我深度八字分析" : "請給我快速八字解讀" }
    ];

    const reply = await callOpenAI(apiKey, messages, maxTokens, temperature, isDeep ? 20000 : 10000);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        profile: baziProfile,
        reply,
        mode: isDeep ? "deep" : "quick"
      }),
    };
  } catch (err) {
    const errorMsg = err.message || String(err);
    console.error("Error:", errorMsg);
    
    let statusCode = 500;
    if (errorMsg.includes("quota") || errorMsg.includes("exceeded") || errorMsg.includes("insufficient")) {
      statusCode = 402;
    } else if (errorMsg.includes("timeout") || errorMsg.includes("超時")) {
      statusCode = 504;
    }
    
    return { 
      statusCode, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        error: errorMsg,
        error_code: errorMsg.includes("quota") ? "QUOTA_EXCEEDED" : "UNKNOWN_ERROR"
      }) 
    };
  }
};

// ============ Quick Mode Prompt ============
function getQuickPrompt(profile) {
  const p = profile.pillars;
  const d = profile.日主;
  const y = profile.五行分佈;
  const yong = profile.用神候選;
  
  return `你是專業八字命理師。用繁體中文回答。

【使用者八字資料】（務必引用）
- 年柱：${p.年柱}
- 月柱：${p.月柱}
- 日柱：${p.日柱}
- 時柱：${p.時柱}
- 日主：${d.五行}（${d.強弱}）
- 五行分佈：${y.map(x => x.五行 + x.count).join('、')}
- 建議用神：${yong.map(x => x.五行 + '（' + x.理由 + '）').join('、')}

【輸出格式】（嚴格 JSON）
{
  "opening": "2-4句算命師口吻開場白，稱呼對方姓名",
  "highlights": ["重點1", "重點2", "重點3"],
  "risk_flags": [{"類型": "健康/情緒/財務", "內容": "具體說明"}],
  "suggested_questions": ["問題1", "問題2", "問題3"]
}

請嚴格輸出 JSON，不要有額外文字。`;
}

// ============ Deep Mode Prompt ============
function getDeepPrompt(profile) {
  const p = profile.pillars;
  const d = profile.日主;
  const y = profile.五行分佈;
  const yong = profile.用神候選;
  
  return `你是專業八字命理大師。用繁體中文詳細回答。

【使用者八字資料】（務必引用）
- 年柱：${p.年柱}
- 月柱：${p.月柱}
- 日柱：${p.日柱}
- 時柱：${p.時柱}
- 日主：${d.五行}（${d.強弱}），${d.十神}
- 五行分佈：${y.map(x => x.五行 + x.count).join('、')}
- 建議用神：${yong.map(x => x.五行 + '（' + x.理由 + '）').join('、')}

【輸出格式】（分段標題）
1. 命格結構與性格核心
2. 健康與情緒五行分析
3. 事業財運用神取向
4. 感情關係模式
5. 近一年運勢建議

請用專業但淺顯易懂的方式解釋，用列表呈現。`;
}

// ============ OpenAI API Call ============
function callOpenAI(apiKey, messages, maxTokens, temperature, timeout) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
      timeout,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body || "{}");
          if (json.error) {
            return reject(new Error(json.error.message));
          }
          if (!res.statusCode || res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
          const content = json?.choices?.[0]?.message?.content;
          if (!content) return reject(new Error("回應為空"));
          resolve(content);
        } catch (e) {
          reject(new Error("解析失敗"));
        }
      });
    });

    req.on("error", (e) => reject(new Error("網路錯誤")));
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("超時")); });
    req.write(data);
    req.end();
  });
}
