(function(){
const $ = (id) => document.getElementById(id);
const FUNCTION_NAME = "bazi_ai";
function getSiteOrigin(){ return window.location.origin; }
function functionUrl(){ return getSiteOrigin() + "/.netlify/functions/" + FUNCTION_NAME; }
function isInAppBrowser(){
  const ua = navigator.userAgent || "";
  return /Telegram|Line|FBAN|FBAV|Instagram|WebView|wv/i.test(ua);
}
function loadProfile(){
  try{
    const raw = localStorage.getItem("metamind_profile");
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function saveProfile(profile){
  localStorage.setItem("metamind_profile", JSON.stringify(profile));
}
function pickText(v){
  if(v == null) return "";
  if(typeof v === "string") return v;
  if(typeof v === "object"){
    return v.text || v.message || v.content || v.reply || JSON.stringify(v);
  }
  return String(v);
}

// 今日運勢計算
function calculateDailyLuck(profile){
  if(!profile || !profile.year || !profile.month || !profile.day) return null;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTs = today.getTime();
  
  // 檢查緩存
  try{
    const cached = JSON.parse(localStorage.getItem("metamind_daily"));
    if(cached && cached.profileTs === profile.ts && cached.date === todayTs){
      return cached;
    }
  }catch(e){}
  
  // 計算八字
  const y = parseInt(profile.year), m = parseInt(profile.month), d = parseInt(profile.day);
  let h = 12; // 預設午時
  const hb = profile.hourBranch;
  if(hb){
    const hbMap = {子:23, 丑:1, 寅:3, 卯:5, 辰:7, 巳:9, 午:11, 未:13, 申:15, 酉:17, 戌:19, 亥:21};
    h = hbMap[hb] || 12;
  }
  
  let solar, lunar;
  try{
    solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
    lunar = solar.getLunar();
  }catch(e){
    return null;
  }
  
  const dayGan = lunar.getDayGan(); // 日干
  const dayZhi = lunar.getDayZhi(); // 日支
  
  // 幸運色
  const ganColors = {
    甲:"青/綠", 乙:"青/綠", 丙:"紅/紫", 丁:"紅/紫",
    戊:"黃/咖", 己:"黃/咖", 庚:"白/金", 辛:"白/金",
    壬:"黑/藍", 癸:"黑/藍"
  };
  
  // 幸運數字
  const zhiNums = {
    子:1, 丑:2, 寅:3, 卯:4, 辰:5, 巳:6, 午:7, 未:8, 申:9, 酉:10, 戌:11, 亥:12
  };
  
  // 幸運方位
  const zhiDirs = {
    子:"北", 丑:"東北", 寅:"東北", 卯:"東", 辰:"東南", 巳:"東南",
    午:"南", 未:"西南", 申:"西南", 酉:"西", 戌:"西北", 亥:"西北"
  };
  
  // 整體運勢（根據日干強弱）
  const ganStrength = {甲:4, 乙:3, 丙:5, 丁:4, 戊:4, 己:3, 庚:5, 辛:4, 壬:4, 癸:3};
  const stars = ganStrength[dayGan] || 3;
  
  // 運勢評語
  const aspects = {
    甲:{love:"戀愛運不錯，身邊有貴人", career:"事業有衝勁，適合主動出擊", health:"肝火旺，多喝水休息"},
    乙:{love:"感情細膩，適合慢火燉煮", career:"彈性好，貴人暗中幫忙", health:"注意腸胃消化"},
    丙:{love:"魅力全開，桃花朵朵", career:"事業火紅，聲勢上漲", health:"小心火氣，多吃蔬果"},
    丁:{love:"溫柔體貼，異性緣佳", career:"頭腦清晰，談判順利", health:"注意心血管"},
    戊:{love:"穩定發展，適合長期關係", career:"財運亨通，地盤穩固", health:"注意脾胃"},
    己:{love:"務實平凡才是真", career:"按部就班，積少成多", health:"少熬夜"},
    庚:{love:"果斷出擊，別猶豫", career:"大刀闊斧，業務強勁", health:"注意呼吸系統"},
    辛:{love:"有魅力但別太計較", career:"精打細算，事業上升", health:"肺部呼吸"},
    壬:{love:"智慧取勝，理性看感情", career:"靈活變通，財源廣進", health:"多喝水"},
    癸:{love:"柔情似水，適合培育", career:"耐力驚人，後勁強", health:"注意腎臟"}
  };
  
  const a = aspects[dayGan] || aspects["甲"];
  
  const result = {
    date: todayTs,
    profileTs: profile.ts,
    stars: stars,
    love: a.love,
    career: a.career,
    health: a.health,
    luckyColor: ganColors[dayGan] || "白",
    luckyNum: zhiNums[dayZhi] || 1,
    luckyDir: zhiDirs[dayZhi] || "北",
    updatedAt: new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})
  };
  
  // 儲存
  localStorage.setItem("metamind_daily", JSON.stringify(result));
  return result;
}

function renderDailyLuck(data){
  const el = $("dailyLuck");
  if(!el || !data) return;
  
  el.style.display = "block";
  el.querySelector(".daily-time").textContent = "更新於 " + data.updatedAt;
  el.querySelector(".luck-stars").innerHTML = "整體運勢 " + "★".repeat(data.stars) + "☆".repeat(5-data.stars);
  el.querySelector(".luck-aspects").innerHTML = `
    <div>💕 愛情：${data.love}</div>
    <div>💼 事業：${data.career}</div>
    <div>🏥 健康：${data.health}</div>
  `;
  el.querySelector(".luck-tags").innerHTML = `
    <span class="tag">幸運色 ${data.luckyColor}</span>
    <span class="tag">幸運數 ${data.luckyNum}</span>
    <span class="tag">幸運方 ${data.luckyDir}</span>
  `;
}

// 自動載入今日運勢
(function initDailyLuck(){
  const profile = loadProfile();
  if(profile){
    const data = calculateDailyLuck(profile);
    if(data) renderDailyLuck(data);
  }
})();

const form = $("baziForm");
if(form){
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const profile = {
      name: ($("name")?.value || "").trim(),
      year: ($("year")?.value || "").trim(),
      month: ($("month")?.value || "").trim(),
      day: ($("day")?.value || "").trim(),
      hourBranch: ($("hourBranch")?.value || "").trim(),
      ts: Date.now()
    };
    if(!profile.name || !profile.year || !profile.month || !profile.day){
      alert("請填寫姓名與出生年月日");
      return;
    }
    saveProfile(profile);
    // 重新計算今日運勢
    const data = calculateDailyLuck(profile);
    if(data) renderDailyLuck(data);
    window.location.href = "./explore.html";
  });
  return;
}

const profileLine = $("profileLine");
const quickReading = $("quickReading");
const featureGrid = $("featureGrid");
const askBtn = $("askBtn");
const question = $("question");
const answer = $("answer");
const openSafariBtn = $("openSafariBtn");
if(profileLine){
  const profile = loadProfile();
  if(!profile){
    profileLine.textContent = "尚未輸入資料。請回首頁輸入後再進來。";
    if(quickReading) quickReading.textContent = "（未輸入資料，無法生成）";
  }else{
    const hb = profile.hourBranch ? profile.hourBranch + "時" : "時辰未知（概略盤）";
    profileLine.textContent = "已讀取命盤資料：" + (profile.name || "未填姓名") + "｜" + profile.year + "-" + profile.month + "-" + profile.day + "｜" + hb + "。你可以直接在下方問 AI。";
    generateQuickReading(profile).catch(() => {
      quickReading.textContent = "（目前無法生成，請稍後再試）";
    });
  }
}
const features = [
  { key:"bazi", name:"八字命盤", desc:"抓重點、快狠準" },
  { key:"name", name:"姓名分析", desc:"用字氣勢與避雷" },
  { key:"love", name:"婚姻配對", desc:"適配度與相處雷點" },
  { key:"word", name:"測字", desc:"一句字看當下局" },
  { key:"career", name:"事業財運", desc:"今年/近期策略" },
  { key:"fengshui", name:"風水建議", desc:"場域與動線" },
];
if(featureGrid){
  featureGrid.innerHTML = features.map(f => '<div class="feature" data-key="' + f.key + '"><div><div class="name">' + f.name + '</div><div class="desc">' + f.desc + '</div></div><div>›</div></div>').join("");
  featureGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".feature");
    if(!card) return;
    const key = card.getAttribute("data-key");
    const prompts = {
      bazi: "用一句話說穿我現在的狀態，並給我三個最重要的提醒。",
      name: "我的名字氣場強弱在哪？會不會卡運？怎麼修？",
      love: "我感情/婚姻的雷點是什麼？我適合什麼類型？",
      word: "我想測字『泰』，你用師傅口吻直接給結論與建議。",
      career: "我最近事業財務卡點在哪？怎麼破？用短句。",
      fengshui: "我住/辦公室怎麼佈局能穩住財氣與人和？",
    };
    if(question) question.value = prompts[key] || "";
    question?.focus();
  });
}
if(openSafariBtn){
  openSafariBtn.addEventListener("click", () => {
    const url = window.location.href;
    window.open(url, "_blank");
    alert("若仍在內建瀏覽器，請點右上角「…」→ 用 Safari 開啟。");
  });
  if(isInAppBrowser()){
    openSafariBtn.style.display = "inline-block";
  }
}
if(askBtn){
  askBtn.addEventListener("click", async () => {
    const profile = loadProfile();
    const q = (question?.value || "").trim();
    if(!profile){
      answer.textContent = "你還沒輸入資料，請回首頁先輸入。";
      return;
    }
    if(!q){
      answer.textContent = "先輸入你想問的問題。";
      return;
    }
    answer.textContent = "師傅正在看盤…";
    try{
      const text = await callBaziFunction(profile, q);
      answer.textContent = pickText(text);
      // 儲存歷史
      saveHistory(q, pickText(text));
    }catch(err){
      answer.textContent = "目前無法取得回覆：" + (err?.message || err);
    }
  });
}

// 歷史儲存
function saveHistory(q, a){
  try{
    let h = JSON.parse(localStorage.getItem("metamind_history") || "[]");
    h.unshift({ts:Date.now(), question:q, answer:a});
    if(h.length > 50) h = h.slice(0, 50);
    localStorage.setItem("metamind_history", JSON.stringify(h));
  }catch(e){}
}

async function generateQuickReading(profile){
  if(!quickReading) return;
  quickReading.textContent = "師傅看盤中…";
  const q = "先用『師傅口吻』給我一段 6 行內的總評：1句開場+3個重點+1句一針見血+1句建議。要人話、不要長篇術語。";
  const text = await callBaziFunction(profile, q);
  quickReading.textContent = pickText(text);
}
async function callBaziFunction(profile, userQuestion){
  const payload = { ...profile, question: userQuestion };
  const res = await fetch(functionUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if(!res.ok){
    const t = await res.text().catch(()=>"");
    throw new Error("HTTP " + res.status + " " + t);
  }
  const ct = res.headers.get("content-type") || "";
  if(ct.includes("application/json")){
    const j = await res.json();
    return j.reply || j.text || j;
  }
  return await res.text();
}
})();
