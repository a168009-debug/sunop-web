/* MetaMind Black-Gold Theme - BLACK_GOLD_001 */

// System Prompt for AI
const SYSTEM_PROMPTS = {
  default: "你是專業命理顧問，冷靜理性，不雞湯，不恐嚇，不保證結果。每次回答最後給2-3條可執行建議。",
  bazi: "你是八字命理專家。結構：1.核心解析 2.判斷依據 3.行動建議。避免絕對預言，用「可能、傾向」。",
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

// DOM Elements
const $ = id => document.getElementById(id);

// Toast function
function showToast(msg){
  const t = $("toast");
  if(t){ t.textContent = msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2000); }
}

// Save profile
function saveProfile(){
  const name = $("name")?.value?.trim();
  const year = $("year")?.value?.trim();
  const month = $("month")?.value?.trim();
  const day = $("day")?.value?.trim();
  const hour = $("hourBranch")?.value?.trim();
  
  if(!name || !year || !month || !day){
    showToast("請填寫完整資料");
    return false;
  }
  
  const profile = {name,year,month,day,hour,ts:Date.now()};
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  showToast("命盤已儲存");
  return true;
}

// Load profile
function loadProfile(){
  try{
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

// Get API key
function getApiKey(){
  return localStorage.getItem(API_KEY_NAME) || "";
}

// Set API key
function setApiKey(key){
  if(key && key.startsWith("sk-")){
    localStorage.setItem(API_KEY_NAME, key);
    showToast("API Key 已儲存");
    $("apiKeyInput").value = "";
  }else{
    showToast("請輸入有效的 API Key");
  }
}

// Clear API key
function clearApiKey(){
  localStorage.removeItem(API_KEY_NAME);
  showToast("API Key 已清除");
}

// Chat functions
function getHistory(){
  try{
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || [];
  }catch(e){ return []; }
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

function escapeHtml(t){
  return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Send message to AI
async function sendMessage(){
  const apiKey = getApiKey();
  if(!apiKey){
    showToast("請先輸入 API Key");
    return;
  }
  
  const input = $("chatInput");
  const msg = input?.value?.trim();
  if(!msg) return;
  
  // Add user message
  addToHistory("user", msg);
  renderHistory();
  input.value = "";
  
  // Show loading
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
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {role: "system", content: systemPrompt},
          ...history.slice(-6)
        ],
        temperature: 0.7,
        max_tokens: 500
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Save profile button
  $("saveProfileBtn")?.addEventListener("click", saveProfile);
  
  // Chat modal
  $("aiBtn")?.addEventListener("click", () => {
    $("chatModal")?.classList.add("open");
    renderHistory();
  });
  
  $("closeChat")?.addEventListener("click", () => {
    $("chatModal")?.classList.remove("open");
  });
  
  // API Key
  $("apiKeyInput")?.addEventListener("keypress", (e) => {
    if(e.key === "Enter") setApiKey(e.target.value);
  });
  
  // Send chat
  $("sendChatBtn")?.addEventListener("click", sendMessage);
  $("chatInput")?.addEventListener("keypress", (e) => {
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Feature cards - switch mode
  document.querySelectorAll(".feature-card").forEach(card => {
    card.addEventListener("click", () => {
      const page = card.dataset.page;
      if(page){
        currentMode = page;
        showToast("已切換到" + page + "模式");
        $("chatModal")?.classList.add("open");
      }
    });
  });
  
  // Check for existing API key
  if(getApiKey()){
    const hint = $("apiKeyInput")?.parentElement?.querySelector(".api-key-hint");
    if(hint) hint.textContent = "✓ API Key 已設定";
  }
});
