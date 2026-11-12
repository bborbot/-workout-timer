// Расписание на неделю: день недели (Пн=0 … Вс=6) → части дня (m утро, d день, e вечер) → тренировки.
// Повторяется каждую неделю. Хранится в этом телефоне: wt_sched = {"0":{"m":[...],"d":[...],"e":[...]}, ...}.
"use strict";
const H = window.HOME;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOTS = [["m", "Morning"], ["d", "Day"], ["e", "Evening"]];
const EXAMPLE = {
  0: { m: ["warmup", "bag"], e: ["warmup", "strength", "stretch"] },
  1: { e: ["warmup", "jumps", "animal"] },
  2: { m: ["warmup", "bag"] },
  3: { m: ["warmup", "bag"], e: ["warmup", "strength", "stretch"] },
  4: { e: ["warmup", "speed", "animal", "stretch"] },
  5: { m: ["warmup", "bag"] },
};
const load = () => { try { return JSON.parse(localStorage.getItem("wt_sched") || "{}"); } catch (e) { return {}; } };
const save = (v) => { try { localStorage.setItem("wt_sched", JSON.stringify(v)); } catch (e) {} };
const today = (new Date().getDay() + 6) % 7;
let day = today;

function render() {
  const s = load();
  const tabs = document.getElementById("days"); tabs.innerHTML = "";
  DAYS.forEach((n, i) => {
    const b = document.createElement("button"), cnt = SLOTS.reduce((a, [k]) => a + ((s[i] || {})[k] || []).length, 0);
    b.className = "dtab" + (i === day ? " on" : "") + (i === today ? " today" : "");
    b.innerHTML = `${n}${cnt ? `<small>${cnt}</small>` : ""}`;
    b.addEventListener("click", () => { day = i; render(); });
    tabs.appendChild(b);
  });
  document.getElementById("dname").textContent = FULL[day] + (day === today ? " · today" : "");
  const box = document.getElementById("slots"); box.innerHTML = "";
  for (const [sk, sname] of SLOTS) {
    const picked = ((s[day] || {})[sk]) || [];
    const sec = document.createElement("div"); sec.className = "slot";
    sec.innerHTML = `<h3>${sname}</h3>`;
    const chips = document.createElement("div"); chips.className = "chips";
    H.order.forEach((k) => {
      const on = picked.includes(k), b = document.createElement("button");
      b.className = "chip toggle" + (on ? " on" : ""); b.textContent = (on ? "✓ " : "") + H.apps[k].short;
      if (on) b.style.background = H.apps[k].color;
      b.addEventListener("click", () => {
        const cur = load(), d = cur[day] || {}, list = d[sk] || [];
        const next = list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
        d[sk] = H.order.filter((x) => next.includes(x)); cur[day] = d; save(cur); render();
      });
      chips.appendChild(b);
    });
    sec.appendChild(chips); box.appendChild(sec);
  }
}
document.getElementById("example").addEventListener("click", () => {
  if (Object.keys(load()).length && !confirm("Replace your schedule with the example week?")) return;
  save(EXAMPLE); render();
});
document.getElementById("clear").addEventListener("click", () => {
  if (confirm("Clear the whole weekly schedule?")) { save({}); render(); }
});
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
