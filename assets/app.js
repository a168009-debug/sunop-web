/* MetaMind Build: LUX_003 */
// Global error handler
window.onerror = function(msg, url, line){ console.log("ERROR:", msg, "line:", line); };
// HTML corruption check
(function(){
  if (!document.documentElement || !document.documentElement.innerHTML || !document.documentElement.innerHTML.includes("METAMIND_HTML_OK")) {
    document.body.innerHTML = "<div style='padding:20px;text-align:center;color:red;'>HTML corrupted. Please redeploy.</div>";
  }
})();

(function(){
const $ = (id) => document.getElementById(id);
const FUNCTION_NAME = "bazi_ai";
const HISTORY_KEY = "metamind_qa_history";

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

// ========== Share Functions ==========
function getAnswerText(){
  const el = $("answer");
  if(!el) return "";
  return (el.innerText || el.textContent || "").trim();
}

function buildShareText(answerText){
  const url = "https://stunning-gecko-4a2c8b.netlify.app";
  return "【MetaMind 智慧命理】\n\n" + answerText + "\n\n🔗 了解更多：" + url;
}

let toastTimer = null;
function showToast(message){
  const toast = $("toast");
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

async function copyToClipboard(text){
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  }catch(e){}
  try{
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }catch(e){
    return false;
  }
}

async function shareAnswer(){
  const answerText = getAnswerText();
  if(!answerText){
    showToast("目前沒有可分享的內容");
    return;
  }
  const shareText = buildShareText(answerText);
  
  if(navigator.share){
    try{
      await navigator.share({text: shareText});
      return;
    }catch(err){}
  }
  const ok = await copyToClipboard(shareText);
  showToast(ok ? "已複製到剪貼簿！" : "複製失敗");
}
window.shareAnswer = shareAnswer;

// ========== History Functions ==========
function addHistoryEntry(question, answer){
  try{
    let h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    h.unshift({ts:Date.now(), question:question, answer:answer});
    if(h.length > 50) h = h.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }catch(e){}
}

function formatTime(ts){
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"});
  if(dateOnly.getTime() === today.getTime()) return "今天 " + time;
  if(dateOnly.getTime() === yesterday.getTime()) return "昨天 " + time;
  return d.toLocaleDateString("zh-TW", {month:"numeric", day:"numeric"}) + " " + time;
}

function renderHistory(){
  const list = $("qaHistoryList");
  const empty = $("qaHistoryEmpty");
  if(!list || !empty) return;
  try{
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if(h.length === 0){
      empty.style.display = "block";
      list.innerHTML = "";
      return;
    }
    empty.style.display = "none";
    list.innerHTML = h.map((item, i) => {
      const preview = item.answer.substring(0, 50) + (item.answer.length > 50 ? "..." : "");
      return '<div class="qa-card" data-index="'+i+'">'+
        '<div class="qa-head"><span class="qa-time">'+formatTime(item.ts)+'</span>'+
        '<button class="qa-toggle" onclick="toggleHistory('+i+')">'+(i===0?'收起':'展開')+'</button></div>'+
        '<div class="qa-q">'+item.question+'</div>'+
        '<div class="qa-a-preview">'+preview+'</div>'+
        '<div class="qa-a" style="display:none;">'+item.answer+'</div>'+
      '</div>';
    }).join("");
  }catch(e){}
}

function toggleHistory(i){
  const cards = document.querySelectorAll(".qa-card");
  const card = cards[i];
  if(!card) return;
  const a = card.querySelector(".qa-a");
  const preview = card.querySelector(".qa-a-preview");
  const btn = card.querySelector(".qa-toggle");
  if(a.style.display === "none"){
    a.style.display = "block";
    preview.style.display = "none";
    btn.textContent = "收起";
  }else{
    a.style.display = "none";
    preview.style.display = "block";
    btn.textContent = "展開";
  }
}
window.toggleHistory = toggleHistory;

function clearHistory(){
  if(confirm("確定要清空所有問答紀錄嗎？")){
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
}

function initHistoryUI(){
  renderHistory();
  const clearBtn = $("qaHistoryClear");
  if(clearBtn) clearBtn.addEventListener("click", clearHistory);
  const shareBtn = $("shareBtn");
  if(shareBtn) shareBtn.addEventListener("click", shareAnswer);
}

// ========== Daily Luck - Safe Version ==========
function calculateDailyLuck(profile){
  try{
    if(!profile || !profile.year || !profile.month || !profile.day) return null;
    if(typeof Solar === "undefined") return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayTs = today.getTime();
    
    try{
      const cached = JSON.parse(localStorage.getItem("metamind_daily"));
      if(cached && cached.profileTs === profile.ts && cached.date === todayTs) return cached;
    }catch(e){}
    
    const y=parseInt(profile.year), m=parseInt(profile.month), d=parseInt(profile.day);
    let h = 12;
    const hbMap = {子:23, 丑:1, 寅:3, 卯:5, 辰:7, 巳:9, 午:11, 未:13, 申:15, 酉:17, 戌:19, 亥:21};
    h = hbMap[profile.hourBranch] || 12;
    
    let solar = Solar.fromYmdHms(y, m, d, h, 0, 0);
    let lunar = solar.getLunar();
    
    const dayGan = lunar.getDayGan();
    const dayZhi = lunar.getDayZhi();
    const ganColors = {甲:"青/綠", 乙:"青/綠", 丙:"紅/紫", 丁:"紅/紫", 戊:"黃/咖", 己:"黃/咖", 庚:"白/金", 辛:"白/金", 壬:"黑/藍", 癸:"黑/藍"};
    const zhiNums = {子:1, 丑:2, 寅:3, 卯:4, 辰:5, 巳:6, 午:7, 未:8, 申:9, 酉:10, 戌:11, 亥:12};
    const zhiDirs = {子:"北", 丑:"東北", 寅:"東北", 卯:"東", 辰:"東南", 巳:"東南", 午:"南", 未:"西南", 申:"西南", 酉:"西", 戌:"西北", 亥:"西北"};
    const ganStrength = {甲:4, 乙:3, 丙:5, 丁:4, 戊:4, 己:3, 庚:5, 辛:4, 壬:4, 癸:3};
    const aspects = {
      甲:{love:"戀愛運不錯", career:"事業有衝勁", health:"多喝水"},
      乙:{love:"感情細膩", career:"貴人幫忙", health:"注意腸胃"},
      丙:{love:"桃花朵朵", career:"聲勢上漲", health:"小心火氣"},
      丁:{love:"異性緣佳", career:"談判順利", health:"心血管"},
      戊:{love:"穩定發展", career:"財運亨通", health:"脾胃"},
      己:{love:"務實", career:"積少成多", health:"少熬夜"},
      庚:{love:"果斷出擊", career:"業務強勁", health:"呼吸系統"},
      辛:{love:"有魅力", career:"事業上升", health:"肺部"},
      壬:{love:"理性", career:"財源廣進", health:"多喝水"},
      癸:{love:"柔情", career:"後勁強", health:"腎臟"}
    };
    
    const result = {
      date: todayTs, profileTs: profile.ts,
      stars: ganStrength[dayGan]||3,
      love: aspects[dayGan]?.love||"",
      career: aspects[dayGan]?.career||"",
      health: aspects[dayGan]?.health||"",
      luckyColor: ganColors[dayGan]||"白",
      luckyNum: zhiNums[dayZhi]||1,
      luckyDir: zhiDirs[dayZhi]||"北",
      updatedAt: new Date().toLocaleTimeString("zh-TW", {hour:"2-digit", minute:"2-digit"})
    };
    localStorage.setItem("metamind_daily", JSON.stringify(result));
    return result;
  }catch(e){
    console.log("Daily luck error:", e);
    return null;
  }
}

function renderDailyLuck(data){
  const el = $("dailyLuck");
  if(!el || !data) return;
  try{
    el.style.display = "block";
    const timeEl = el.querySelector(".daily-time");
    const starsEl = el.querySelector(".luck-stars");
    const aspectsEl = el.querySelector(".luck-aspects");
    const tagsEl = el.querySelector(".luck-tags");
    if(timeEl) timeEl.textContent = "更新於 " + data.updatedAt;
    if(starsEl) starsEl.innerHTML = "整體運勢 " + "★".repeat(data.stars) + "☆".repeat(5-data.stars);
    if(aspectsEl) aspectsEl.innerHTML = "<div>💕 愛情："+data.love+"</div><div>💼 事業："+data.career+"</div><div>🏥 健康："+data.health+"</div>";
    if(tagsEl) tagsEl.innerHTML = '<span class="tag">幸運色 '+data.luckyColor+'</span><span class="tag">幸運數 '+data.luckyNum+'</span><span class="tag">幸運方 '+data.luckyDir+'</span>';
  }catch(e){}
}

// Init daily luck after page loads
setTimeout(function(){
  try{
    const profile = loadProfile();
    if(profile){
      const data = calculateDailyLuck(profile);
      if(data) renderDailyLuck(data);
    }
  }catch(e){}
}, 100);

// ========== Main Page ==========
const form = $("baziForm");
if(form){
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const profile = {
      name: ($("name")?.value||"").trim(),
      year: ($("year")?.value||"").trim(),
      month: ($("month")?.value||"").trim(),
      day: ($("day")?.value||"").trim(),
      hourBranch: ($("hourBranch")?.value||"").trim(),
      ts: Date.now()
    };
    if(!profile.name || !profile.year || !profile.month || !profile.day){
      alert("請填寫姓名與出生年月日"); return;
    }
    saveProfile(profile);
    const data = calculateDailyLuck(profile);
    if(data) renderDailyLuck(data);
    window.location.href = "./explore.html";
  });
  return;
}

// ========== Explore Page ==========
initHistoryUI();

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
    const hb = profile.hourBranch ? profile.hourBranch+"時" : "時辰未知（概略盤）";
    profileLine.textContent = "已讀取命盤資料："+(profile.name||"未填姓名")+"｜"+profile.year+"-"+profile.month+"-"+profile.day+"｜"+hb+"。你可以直接在下方問 AI。";
    generateQuickReading(profile).catch(() => { quickReading.textContent = "（目前無法生成，請稍後再試）"; });
  }
}

const features = [
  {key:"bazi",name:"八字命盤",desc:"抓重點、快狠準"},
  {key:"name",name:"姓名分析",desc:"用字氣勢與避雷"},
  {key:"love",name:"婚姻配對",desc:"適配度與相處雷點"},
  {key:"word",name:"測字",desc:"一句字看當下局"},
  {key:"career",name:"事業財運",desc:"今年/近期策略"},
  {key:"fengshui",name:"風水建議",desc:"場域與動線"},
];

if(featureGrid){
  featureGrid.innerHTML = features.map(f => '<div class="feature" data-key="'+f.key+'"><div><div class="name">'+f.name+'</div><div class="desc">'+f.desc+'</div></div><div>›</div></div>').join("");
  featureGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".feature");
    if(!card) return;
    const key = card.getAttribute("data-key");
    const prompts = {
      bazi:"用一句話說穿我現在的狀態，並給我三個最重要的提醒。",
      name:"我的名字氣場強弱在哪？會不會卡運？怎麼修？",
      love:"我感情/婚姻的雷點是什麼？我適合什麼類型？",
      word:"我想測字『泰』，你用師傅口吻直接給結論與建議。",
      career:"我最近事業財務卡點在哪？怎麼破？用短句。",
      fengshui:"我住/辦公室怎麼佈局能穩住財氣與人和？",
    };
    if(question) question.value = prompts[key] || "";
    question?.focus();
  });
}

if(openSafariBtn){
  openSafariBtn.addEventListener("click", () => {
    window.open(window.location.href, "_blank");
    alert("若仍在內建瀏覽器，請點右上角「…」→ 用 Safari 開啟。");
  });
  if(isInAppBrowser()) openSafariBtn.style.display = "inline-block";
}

if(askBtn){
  askBtn.addEventListener("click", async () => {
    const profile = loadProfile();
    const q = (question?.value||"").trim();
    if(!profile){ answer.textContent = "你還沒輸入資料，請回首頁先輸入。"; return; }
    if(!q){ answer.textContent = "先輸入你想問的問題。"; return; }
    answer.textContent = "師傅正在看盤…";
    try{
      const text = await callBaziFunction(profile, q);
      const result = pickText(text);
      answer.textContent = result;
      addHistoryEntry(q, result);
      renderHistory();
    }catch(err){
      answer.textContent = "目前無法取得回覆：" + (err?.message||err);
    }
  });
}

async function generateQuickReading(profile){
  if(!quickReading) return;
  quickReading.textContent = "師傅看盤中…";
  try{
    const text = await callBaziFunction(profile, "先用『師傅口吻』給我一段 6 行內的總評：1句開場+3個重點+1句一針見血+1句建議。要人話、不要長篇術語。");
    quickReading.textContent = pickText(text);
  }catch(e){
    quickReading.textContent = "（目前無法生成）";
  }
}

async function callBaziFunction(profile, userQuestion){
  const payload = {...profile, question:userQuestion};
  const res = await fetch(functionUrl(), {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(!res.ok){
    const t = await res.text().catch(()=>"");
    throw new Error("HTTP "+res.status+" "+t);
  }
  const ct = res.headers.get("content-type")||"";
  if(ct.includes("application/json")){
    const j = await res.json();
    return j.reply || j.text || j;
  }
  return await res.text();
}
})();
