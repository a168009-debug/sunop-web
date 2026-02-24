const STORAGE_KEY = "bazi_profile";
const FN_URL = "/.netlify/functions/bazi_ai";
function $(id){ return document.getElementById(id); }
function readProfile(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function saveProfile(profile){ localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
function formatProfile(p){
  const y = String(p.year).padStart(4,"0");
  const m = String(p.month).padStart(2,"0");
  const d = String(p.day).padStart(2,"0");
  const t = p.shichen ? p.shichen + "時" : "時辰不確定";
  return p.name + "｜" + y + "-" + m + "-" + d + "｜" + t;
}
function buildOpeningPrompt(profile){
  return `
你是一位高深莫測、但不油不玄的風水師/命理師，語氣沉穩、點到為止、留三分玄機。
請根據使用者提供的出生資料，做「開場觀局」：用 6~10 行短段落，格式像古師點評，但內容要實用。
要求：
- 先一句「觀局總論」（不超過 20 字）
- 再 3 點：近期心境/人際/財務或事業的阻力與起因
- 再給 2 個「破局建議」：一內（心法/節奏），一外（行動/取捨）
- 最後留一句「收尾箴言」
出生資料： ${formatProfile(profile)}
`.trim();
}
async function callBaziAI({ mode, profile, question }){
  const payload = { mode, ...profile, question: question || null };
  const res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) { const msg = data?.error || "HTTP " + res.status; throw new Error(msg); }
  return data?.reply?.text || data?.text || data?.reply || JSON.stringify(data);
}
(function initIndex(){
  const form = $("profileForm");
  if(!form) return;
  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    const msg = $("msg");
    const name = $("name").value.trim();
    const year = Number($("year").value);
    const month = Number($("month").value);
    const day = Number($("day").value);
    const shichen = $("shichen").value;
    if(!name || !year || !month || !day){ msg.textContent = "請把姓名/年月日填完整。"; return; }
    if(month < 1 || month > 12 || day < 1 || day > 31){ msg.textContent = "日期看起來怪怪的，檢查一下月份/日期。"; return; }
    const profile = { name, year, month, day, shichen: shichen || null };
    saveProfile(profile);
    location.href = "./explore.html";
  });
  const p = readProfile();
  if(p){ $("name").value = p.name || ""; $("year").value = p.year || ""; $("month").value = p.month || ""; $("day").value = p.day || ""; $("shichen").value = p.shichen || ""; }
})();
(async function initExplore(){
  const welcome = $("welcome");
  if(!welcome) return;
  const openingLoading = $("openingLoading");
  const openingText = $("openingText");
  const askBtn = $("askBtn");
  const question = $("question");
  const qaMsg = $("qaMsg");
  const answer = $("answer");
  const profile = readProfile();
  if(!profile){ welcome.textContent = "找不到資料，請回首頁重新輸入。"; return; }
  welcome.textContent = "已讀取命盤資料：" + formatProfile(profile) + "。你可以直接在下方問 AI。";
  try{
    const openingPrompt = buildOpeningPrompt(profile);
    const text = await callBaziAI({ mode: "opening", profile, question: openingPrompt });
    openingLoading.hidden = true;
    openingText.hidden = false;
    openingText.textContent = text;
  }catch(err){ openingLoading.textContent = "開場推演失敗：" + err.message; }
  askBtn.addEventListener("click", async ()=>{
    const q = question.value.trim();
    if(!q){ qaMsg.textContent = "先輸入問題。"; return; }
    qaMsg.textContent = "推演中…";
    answer.hidden = true;
    try{
      const text = await callBaziAI({ mode: "qa", profile, question: q });
      qaMsg.textContent = "";
      answer.hidden = false;
      answer.textContent = text;
    }catch(err){ qaMsg.textContent = "失敗：" + err.message; }
  });
})();
