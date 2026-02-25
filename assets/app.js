/* MetaMind Black-Gold Theme - BLACK_GOLD_004 */

// System Prompts
const SYSTEM_PROMPTS = {
  default: "你是專業命理顧問，冷靜理性，不雞湯，不恐嚇，不保證結果。每次回答最後給2-3條可執行建議。",
  bazi: `你是八字命理專家，融合《滴天髓》《子平真詮》《三命通會》三本經典精髓。

【核心理論】
一、氣勢判斷（滴天髓）- 五行流通、強弱用神
二、格局成敗（子平真詮）- 官財印食、成破局
三、應事參考（三命通會）- 大運流年、性格事業

【輸出結構】
## 命盤概覽
## 氣勢診斷（滴天髓思路）
## 格局判斷（子平真詮思路）
## 性格特質（三命通會）
## 行動建議（3條可執行）

【風格】冷靜理性，用「可能、傾向」，避免絕對。`,
  ziwei: "你是紫微斗數大師。結構：1.星曜意義 2.組合解讀 3.建議。",
  lifescript: "你是生命靈數導師。結構：1.核心特質 2.優勢與盲點 3.策略。",
  name: "你是姓名學專家。結構：1.評估面向 2.優缺點 3.替代方案。",
  cards: "你是智慧卡占卜師。結構：1.牌義 2.情境解讀 3.三個可做行動。",
  zici: "你是測字大師。結構：1.拆字 2.象意 3.建議。"
};

const API_KEY_NAME = "metamind_openai_key";
const CHAT_HISTORY_KEY = "metamind_chat_history";
const PROFILE_KEY = "metamind_profile";
const MAX_HISTORY = 8;

const $ = id => document.getElementById(id);

function showToast(msg){
  const t = $("toast");
  if(t){ t.textContent = msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2000); }
}

function saveProfile(){
  const name = $("name")?.value?.trim();
  const year = $("year")?.value?.trim();
  const month = $("month")?.value?.trim();
  const day = $("day")?.value?.trim();
  const hour = $("hourBranch")?.value?.trim();
  if(!name || !year || !month || !day){ showToast("請填寫完整資料"); return false; }
  const profile = {name,year,month,day,hour,ts:Date.now()};
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  showToast("命盤已儲存");
  return true;
}

function loadProfile(){
  try{ const raw = localStorage.getItem(PROFILE_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}

function getApiKey(){ return localStorage.getItem(API_KEY_NAME) || ""; }
function setApiKey(key){
  if(key && key.startsWith("sk-")){
    localStorage.setItem(API_KEY_NAME, key);
    showToast("API Key 已儲存");
    if($("apiKeyInput"))$("apiKeyInput").value = "";
  }else{ showToast("請輸入有效的 API Key"); }
}
function clearApiKey(){ localStorage.removeItem(API_KEY_NAME); showToast("API Key 已清除"); }

function getHistory(){
  try{ return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || []; }catch(e){ return []; }
}
function saveHistory(history){
  if(history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
}
function addToHistory(role, content){
  const history = getHistory();
  history.push({role, content, ts: Date.now()});
  saveHistory(history);
}
function renderHistory(){
  const container = $("chatMessages");
  if(!container) return;
  const history = getHistory();
  if(history.length === 0) return;
  container.innerHTML = history.map(h => {
    const cls = h.role === "user" ? "user-msg" : "ai-msg";
    return `<div class="${cls}" style="margin:8px 0;padding:10px;border-radius:8px;${h.role==='user'?'background:rgba(212,175,55,0.1);text-align:right':'background:rgba(255,255,255,0.05)'}"><span style="color:var(--mm-text);font-size:13px;">${escapeHtml(h.content)}</span></div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
}
function escapeHtml(t){ return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

async function sendMessage(){
  const apiKey = getApiKey();
  if(!apiKey){ showToast("請先輸入 API Key"); return; }
  const input = $("chatInput");
  const msg = input?.value?.trim();
  if(!msg) return;
  addToHistory("user", msg);
  renderHistory();
  input.value = "";
  
  const container = $("chatMessages");
  if(container){
    container.innerHTML += `<div class="ai-msg" style="margin:8px 0;"><span style="color:var(--mm-gold-light);font-size:13px;">◈ 分析中...</span></div>`;
    container.scrollTop = container.scrollHeight;
  }
  
  try{
    const history = getHistory().map(h => ({role: h.role, content: h.content}));
    const systemPrompt = SYSTEM_PROMPTS[currentMode] || SYSTEM_PROMPTS.default;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{role: "system", content: systemPrompt}, ...history.slice(-6)],
        temperature: 0.7, max_tokens: 500
      })
    });
    
    if(!response.ok) throw new Error("API Error: " + response.status);
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "無法取得回應";
    addToHistory("assistant", reply);
    renderHistory();
  }catch(err){
    showToast("錯誤: " + err.message);
  }
}

let currentMode = "default";

document.addEventListener("DOMContentLoaded", () => {
  $("saveProfileBtn")?.addEventListener("click", saveProfile);
  
  $("aiBtn")?.addEventListener("click", () => {
    $("chatModal")?.classList.add("open");
    renderHistory();
  });
  
  $("closeChat")?.addEventListener("click", () => {
    $("chatModal")?.classList.remove("open");
  });
  
  $("apiKeyInput")?.addEventListener("keypress", (e) => {
    if(e.key === "Enter") setApiKey(e.target.value);
  });
  
  $("sendChatBtn")?.addEventListener("click", sendMessage);
  $("chatInput")?.addEventListener("keypress", (e) => {
    if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });
  
  document.querySelectorAll(".feature-card").forEach(card => {
    card.addEventListener("click", () => {
      const page = card.dataset.page;
      if(page){
        currentMode = page;
        showToast("已切換到" + {"bazi":"八字","ziwei":"紫微","lifescript":"靈數","name":"姓名","cards":"智慧卡","zici":"測字"}[page] + "模式");
        $("chatModal")?.classList.add("open");
      }
    });
  });
  
  if(getApiKey()){
    const hint = $("apiKeyInput")?.parentElement?.querySelector(".api-key-hint");
    if(hint) hint.textContent = "✓ API Key 已設定";
  }
});
