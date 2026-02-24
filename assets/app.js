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
      answer.textContent = text;
    }catch(err){
      answer.textContent = "目前無法取得回覆：" + (err?.message || err);
    }
  });
}
async function generateQuickReading(profile){
  if(!quickReading) return;
  quickReading.textContent = "師傅看盤中…";
  const q = "先用『師傅口吻』給我一段 6 行內的總評：1句開場+3個重點+1句一針見血+1句建議。要人話、不要長篇術語。";
  const text = await callBaziFunction(profile, q);
  quickReading.textContent = text;
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
    return (j.reply || j.text || JSON.stringify(j)).toString();
  }
  return await res.text();
}
})();
