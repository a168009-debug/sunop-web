const LS_KEY = "metamind_profile";

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  
  const name = document.getElementById("name").value.trim();
  const year = Number(document.getElementById("year").value);
  const month = Number(document.getElementById("month").value);
  const day = Number(document.getElementById("day").value);
  const shichen = document.getElementById("shichen").value;
  
  if (!name || !year || !month || !day) {
    msg.textContent = "請填寫姓名與出生年月日";
    return;
  }
  
  const profile = { name, year, month, day };
  if (shichen) profile.hourBranch = shichen;
  
  localStorage.setItem(LS_KEY, JSON.stringify(profile));
  window.location.href = "./explore.html";
});

// Load saved data
window.addEventListener("DOMContentLoaded", () => {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY));
    if (p) {
      document.getElementById("name").value = p.name || "";
      document.getElementById("year").value = p.year || "";
      document.getElementById("month").value = p.month || "";
      document.getElementById("day").value = p.day || "";
      if (p.hourBranch) document.getElementById("shichen").value = p.hourBranch;
    }
  } catch (e) {}
});
