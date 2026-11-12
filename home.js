// Главная: рекомендации, свой план на неделю, отметки (с минутами) и итог прошлой недели.
// Всё хранится только в этом телефоне (localStorage): wt_log — отметки, wt_plan — план, wt_seen — какой итог уже показан.
"use strict";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const H = window.HOME;   // {order:[key...], apps:{key:{name, color, min, goal}}}
let weekShift = 0;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const readLog = () => store.get("wt_log", []);
const writeLog = (v) => store.set("wt_log", v);
// Расписание (schedule.js): если оно заполнено, недельный план считается из него.
const SLOTS = [["m", "Morning"], ["d", "Day"], ["e", "Evening"]];
const sched = () => store.get("wt_sched", {});
function schedCounts() {
  const s = sched(), c = {}; let any = false;
  for (const k of H.order) c[k] = 0;
  for (const d of Object.values(s)) for (const [sk] of SLOTS) for (const k of (d[sk] || [])) { if (k !== "warmup") c[k]++; any = true; }   // разминка — перед каждой, не цель
  return any ? c : null;
}
function plan() {
  const sc = schedCounts();
  if (sc) return sc;
  const p = store.get("wt_plan", {}), out = {};
  for (const k of H.order) out[k] = Number.isInteger(p[k]) ? p[k] : H.apps[k].min;
  return out;
}

// «Today» и «Tomorrow» из расписания; ✓ — если за сегодня есть отметка этой тренировки (по одной на пункт).
function renderToday() {
  const box = document.getElementById("today"), s = sched(), di = (new Date().getDay() + 6) % 7;
  if (!schedCounts()) {
    box.innerHTML = `<div class="tday tmini"><b>Today</b> · no schedule yet · <a href="schedule.html">🗓 make one</a></div>`;
    return;
  }
  const left = readLog().filter((x) => x.d === ymd(new Date())).map((x) => x.t);
  const line = (d, mark) => SLOTS.filter(([sk]) => (d[sk] || []).length).map(([sk, sn]) =>
    `<div class="tslot"><span class="tsn">${sn}</span><span class="chips">` + d[sk].map((k) => {
      let done = false;
      if (mark) { const j = left.indexOf(k); if (j >= 0) { left.splice(j, 1); done = true; } }
      return `<a class="chip${done ? " done" : ""}" style="background:${H.apps[k].color}" href="${k}.html">${done ? "✓ " : ""}${H.apps[k].short}</a>`;
    }).join("") + "</span></div>").join("") || '<p class="note">Rest day.</p>';
  const nd = (di + 1) % 7;
  const tmr = SLOTS.flatMap(([sk]) => (s[nd] || {})[sk] || []).map((k) => H.apps[k].short).join(", ") || "rest";
  box.innerHTML = `<div class="tday"><div class="thead"><b>Today · ${DAYS[di]}</b><a href="schedule.html">🗓 schedule</a></div>
    ${line(s[di] || {}, true)}<div class="tmr">Tomorrow · ${DAYS[nd]}: ${tmr}</div></div>`;
}
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function monday(shift) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7 * shift); return d;
}
function weekDates(shift) { const m = monday(shift); return [...Array(7)].map((_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; }); }
const f = (d) => d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0");
const mins = (xs) => xs.reduce((a, x) => a + (x.m || 0), 0);

function weekStats(shift) {
  const keys = weekDates(shift).map(ymd), inWeek = readLog().filter((x) => keys.includes(x.d)), p = plan();
  const per = {};
  for (const k of H.order) { const xs = inWeek.filter((x) => x.t === k); per[k] = { n: xs.length, m: mins(xs), plan: p[k] }; }
  const planned = H.order.filter((k) => p[k] > 0);
  return { inWeek, per, planned, met: planned.filter((k) => per[k].n >= p[k]).length,
           total: inWeek.filter((x) => x.t !== "warmup").length, minutes: mins(inWeek) };
}

function render() {
  const dates = weekDates(weekShift), keys = dates.map(ymd), today = ymd(new Date()), st = weekStats(weekShift);
  for (const k of H.order) {
    const card = document.querySelector(`.card[data-key="${k}"]`), s = st.per[k];
    card.querySelector(".n").textContent = s.plan ? `${s.n} / ${s.plan}` : String(s.n);
    card.classList.toggle("ok", s.plan > 0 && s.n >= s.plan);
    const fromSched = !!schedCounts();
    card.querySelector(".pv").textContent = (s.plan ? `${s.plan}× a week` : "no goal") + (fromSched ? " · from schedule" : "");
    card.querySelectorAll(".pm").forEach((b) => { b.hidden = fromSched; });
    card.querySelector(".pmin").textContent = s.m ? ` · ${s.m} min this week` : "";
  }
  document.getElementById("wk").textContent = weekShift === 0 ? "This week" : `${f(dates[0])} – ${f(dates[6])}`;
  document.getElementById("next").disabled = weekShift >= 0;
  const box = document.getElementById("days"); box.innerHTML = "";
  dates.forEach((d, i) => {
    const row = document.createElement("div"); row.className = "day" + (keys[i] === today ? " today" : "");
    row.innerHTML = `<span class="dn">${DAYS[i]} ${d.getDate()}</span>`;
    const chips = document.createElement("span"); chips.className = "chips";
    const items = st.inWeek.filter((x) => x.d === keys[i]);
    if (!items.length) chips.innerHTML = '<span class="none">—</span>';
    items.forEach((x) => {
      const c = document.createElement("button"); c.className = "chip"; c.style.background = H.apps[x.t].color;
      c.textContent = H.apps[x.t].name + (x.m ? ` ${x.m}′` : "");
      c.addEventListener("click", () => {
        if (!confirm(`Remove “${H.apps[x.t].name}” on ${DAYS[i]} ${d.getDate()}?`)) return;
        const l = readLog(), j = l.findIndex((y) => y.id === x.id && y.d === x.d && y.t === x.t);
        if (j >= 0) { l.splice(j, 1); writeLog(l); render(); renderToday(); }
      });
      chips.appendChild(c);
    });
    row.appendChild(chips); box.appendChild(row);
  });
  document.getElementById("sum").textContent =
    `Workouts: ${st.total} · ${st.minutes} min · plan met: ${st.met} of ${st.planned.length}`;
}

// Итог прошлой недели: показывается сам при первом открытии на новой неделе, до нажатия «OK».
function report() {
  const box = document.getElementById("report"), cur = ymd(monday(0));
  if (store.get("wt_seen", "") === cur) { box.innerHTML = ""; return; }
  const st = weekStats(-1), d = weekDates(-1);
  if (!st.inWeek.length && !readLog().length) { store.set("wt_seen", cur); return; }   // первый запуск — нечего показывать
  const rows = H.order.filter((k) => st.per[k].plan > 0 || st.per[k].n > 0).map((k) => {
    const s = st.per[k], ok = s.plan > 0 && s.n >= s.plan;
    const mark = s.plan ? (ok ? '<b class="yes">✓</b>' : '<b class="no">✗</b>') : '<b class="na">·</b>';
    return `<tr><td>${mark}</td><td>${H.apps[k].name}</td><td>${s.n}${s.plan ? " of " + s.plan : ""}</td><td>${s.m} min</td></tr>`;
  }).join("");
  box.innerHTML = `<div class="rep"><h2>Last week · ${f(d[0])} – ${f(d[6])}</h2>
    <p class="sum">Plan met: ${st.met} of ${st.planned.length} · ${st.total} workouts · ${st.minutes} min</p>
    <table>${rows}</table><button class="sub" id="repok">OK</button></div>`;
  document.getElementById("repok").addEventListener("click", () => { store.set("wt_seen", cur); report(); });
}

document.querySelectorAll(".card .plus").forEach((b) => b.addEventListener("click", () => {
  const k = b.closest(".card").dataset.key;
  const ans = prompt(`${H.apps[k].name} today. Minutes (leave empty if unknown):`, "");
  if (ans === null) return;
  const m = parseInt(ans, 10), l = readLog();
  l.push({ d: ymd(new Date()), t: k, m: Number.isFinite(m) && m > 0 ? Math.min(m, 600) : 0, id: Date.now() });
  writeLog(l); weekShift = 0; render(); renderToday();
}));
document.querySelectorAll(".card .pm").forEach((b) => b.addEventListener("click", () => {
  const k = b.closest(".card").dataset.key, p = store.get("wt_plan", {}), cur = plan()[k];
  p[k] = Math.max(0, Math.min(14, cur + Number(b.dataset.d))); store.set("wt_plan", p); render();
}));
document.getElementById("prev").addEventListener("click", () => { weekShift--; render(); });
document.getElementById("next").addEventListener("click", () => { if (weekShift < 0) { weekShift++; render(); } });
render(); report(); renderToday();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
