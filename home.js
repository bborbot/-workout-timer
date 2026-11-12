// Главная: рекомендации на неделю, отметки сделанных тренировок (только в этом телефоне), сводка по неделе.
"use strict";
const LOG_KEY = "wt_log";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const H = window.HOME;   // {order:[key...], apps:{key:{name, short, rec, min}}}
let weekShift = 0;

function readLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch (e) { return []; } }
function writeLog(v) { try { localStorage.setItem(LOG_KEY, JSON.stringify(v)); } catch (e) {} }
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function monday(shift) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * shift); return d;
}
function weekDates(shift) { const m = monday(shift); return [...Array(7)].map((_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; }); }

function render() {
  const log = readLog(), dates = weekDates(weekShift), keys = dates.map(ymd), today = ymd(new Date());
  const inWeek = log.filter((x) => keys.includes(x.d));
  for (const k of H.order) {
    const n = inWeek.filter((x) => x.t === k).length, a = H.apps[k];
    const card = document.querySelector(`.card[data-key="${k}"]`);
    card.querySelector(".n").textContent = a.min ? `${n} / ${a.goal}` : String(n);
    card.classList.toggle("ok", a.min > 0 && n >= a.min);
  }
  const f = (d) => d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0");
  document.getElementById("wk").textContent = weekShift === 0 ? "This week" :
    `${f(dates[0])} – ${f(dates[6])}`;
  document.getElementById("next").disabled = weekShift >= 0;
  const box = document.getElementById("days"); box.innerHTML = "";
  dates.forEach((d, i) => {
    const row = document.createElement("div"); row.className = "day" + (keys[i] === today ? " today" : "");
    const items = inWeek.filter((x) => x.d === keys[i]);
    row.innerHTML = `<span class="dn">${DAYS[i]} ${d.getDate()}</span>`;
    const chips = document.createElement("span"); chips.className = "chips";
    if (!items.length) chips.innerHTML = '<span class="none">—</span>';
    items.forEach((x) => {
      const c = document.createElement("button"); c.className = "chip"; c.style.background = H.apps[x.t].color;
      c.textContent = H.apps[x.t].name;
      c.addEventListener("click", () => {
        if (!confirm(`Remove “${H.apps[x.t].name}” on ${DAYS[i]} ${d.getDate()}?`)) return;
        const l = readLog(), j = l.findIndex((y) => y.d === x.d && y.t === x.t);
        if (j >= 0) { l.splice(j, 1); writeLog(l); render(); }
      });
      chips.appendChild(c);
    });
    row.appendChild(chips); box.appendChild(row);
  });
  const total = inWeek.filter((x) => x.t !== "warmup").length;
  const done = H.order.filter((k) => H.apps[k].min && inWeek.filter((x) => x.t === k).length >= H.apps[k].min).length;
  const need = H.order.filter((k) => H.apps[k].min).length;
  document.getElementById("sum").textContent = `Workouts: ${total} · weekly goals met: ${done} of ${need}`;
}

document.querySelectorAll(".card .plus").forEach((b) => b.addEventListener("click", () => {
  const k = b.closest(".card").dataset.key, l = readLog();
  l.push({ d: ymd(new Date()), t: k }); writeLog(l); weekShift = 0; render();
  b.textContent = "✓"; setTimeout(() => { b.textContent = "+"; }, 900);
}));
document.getElementById("prev").addEventListener("click", () => { weekShift--; render(); });
document.getElementById("next").addEventListener("click", () => { if (weekShift < 0) { weekShift++; render(); } });
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
