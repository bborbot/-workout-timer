// Интервальная тренировка: работа / отдых под музыку, отсчёт 3-2-1 перед каждой сменой.
// Вся тренировка собирается в одну дорожку (WAV) и играет через обычный <audio>,
// чтобы пики не плыли и звук шёл при выключенном экране.
"use strict";

const TYPE = document.body.dataset.type;
const PRESETS = {
  jumps:    { name: "Прыжки",       work: 30,  rest: 30, total: 15 },
  bag:      { name: "Груша",        work: 120, rest: 60, total: 20 },
  animal:   { name: "Animal moves", work: 45,  rest: 15, total: 20 },
  strength: { name: "Силовые",      work: 40,  rest: 20, total: 30 },
};
const SR = 22050;          // частота дорожки: моно 22 кГц хватает для музыки в наушниках
const LEAD = 6;            // секунд до первого раунда (спокойная музыка + отсчёт)
const FADE = 0.25;         // плавность на стыках, с
const MUSIC_UNDER_BEEP = 0.45;

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

let lib = null;
let settings = Object.assign({}, PRESETS[TYPE], store.get("wt_" + TYPE, {}));
let schedule = [];         // [{kind:'lead'|'work'|'rest', t0, t1, round}]
let audioUrl = null;

// ---------- настройки ----------
function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}
function renderSettings() {
  $("work").textContent = fmt(settings.work);
  $("rest").textContent = fmt(settings.rest);
  $("total").textContent = settings.total + " мин";
  const rounds = Math.floor(settings.total * 60 / (settings.work + settings.rest));
  $("rounds").textContent = "≈ " + rounds + " раундов";
  store.set("wt_" + TYPE, { work: settings.work, rest: settings.rest, total: settings.total });
}
function step(key, dir) {
  if (key === "total") {
    settings.total = Math.min(60, Math.max(1, settings.total + dir));
  } else {
    const v = settings[key];
    const st = v < 60 || (v === 60 && dir < 0) ? 5 : 15;
    settings[key] = Math.min(600, Math.max(5, v + dir * st));
  }
  invalidate();
  renderSettings();
}
document.querySelectorAll("[data-step]").forEach((b) => {
  b.addEventListener("click", () => step(b.dataset.step, Number(b.dataset.dir)));
});

// ---------- расписание ----------
function buildSchedule() {
  const s = [{ kind: "lead", t0: 0, t1: LEAD, round: 0 }];
  let t = LEAD, round = 0;
  const end = LEAD + settings.total * 60;
  while (t < end - 0.5) {
    round++;
    const w1 = Math.min(end, t + settings.work);
    s.push({ kind: "work", t0: t, t1: w1, round });
    t = w1;
    if (t >= end - 0.5) break;
    const r1 = Math.min(end, t + settings.rest);
    s.push({ kind: "rest", t0: t, t1: r1, round });
    t = r1;
  }
  return s;
}

// ---------- звук ----------
let decodeCtx = null;
function getDecodeCtx() {
  if (!decodeCtx) {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    decodeCtx = new C(1, SR, SR);
  }
  return decodeCtx;
}
async function decode(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("нет файла " + url);
  const buf = await r.arrayBuffer();
  const ab = await new Promise((ok, bad) => getDecodeCtx().decodeAudioData(buf, ok, bad));
  return ab.getChannelData(0);
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Плейлист: треки по кругу в случайном порядке, позиция сохраняется между раундами.
function playlist(files) {
  return { order: shuffle(files), idx: 0, pos: 0, data: null };
}
async function take(pl, n) {
  const out = new Float32Array(n);
  let k = 0;
  while (k < n) {
    if (!pl.data) pl.data = await decode(pl.order[pl.idx % pl.order.length].file);
    const left = pl.data.length - pl.pos;
    const m = Math.min(left, n - k);
    out.set(pl.data.subarray(pl.pos, pl.pos + m), k);
    k += m; pl.pos += m;
    if (pl.pos >= pl.data.length) {          // трек кончился — следующий
      pl.idx++; pl.pos = 0; pl.data = null;
      if (pl.idx % pl.order.length === 0) pl.order = shuffle(pl.order);
    }
  }
  return out;
}
function tone(out, at, dur, freq, amp) {
  const i0 = Math.round(at * SR), n = Math.round(dur * SR), att = Math.round(0.01 * SR);
  for (let i = 0; i < n && i0 + i < out.length; i++) {
    if (i0 + i < 0) continue;
    const env = Math.min(1, i / att, (n - i) / att);
    out[i0 + i] += amp * env * Math.sin(2 * Math.PI * freq * i / SR);
  }
}
function duck(out, at, dur) {
  const i0 = Math.max(0, Math.round(at * SR)), i1 = Math.min(out.length, Math.round((at + dur) * SR));
  for (let i = i0; i < i1; i++) out[i] *= MUSIC_UNDER_BEEP;
}

async function render(progress) {
  schedule = buildSchedule();
  const total = schedule[schedule.length - 1].t1;
  const n = Math.round(total * SR);
  const pcm = new Int16Array(n);
  const work = playlist(lib[TYPE]), rest = playlist(lib.relax);
  const fadeN = Math.round(FADE * SR);
  const changes = [];                          // моменты смен и что начинается
  for (const seg of schedule) {
    const i0 = Math.round(seg.t0 * SR), i1 = Math.round(seg.t1 * SR);
    const chunk = await take(seg.kind === "work" ? work : rest, i1 - i0);
    const len = chunk.length;
    for (let i = 0; i < Math.min(fadeN, len); i++) { chunk[i] *= i / fadeN; chunk[len - 1 - i] *= i / fadeN; }
    const segStart = seg.t0;
    // отсчёт перед концом сегмента: 3-2-1, затем длинный сигнал на смене
    for (const b of [3, 2, 1]) {
      const at = seg.t1 - b - segStart;
      if (at > 0.2) { duck(chunk, at - 0.05, 0.3); tone(chunk, at, 0.15, 1000, 0.55); }
    }
    for (let i = 0; i < len; i++) {
      const v = Math.max(-1, Math.min(1, chunk[i]));
      pcm[i0 + i] = v * 32767;
    }
    if (seg.kind !== "lead") changes.push(seg);
    progress(seg.t1 / total);
    await new Promise((r) => setTimeout(r, 0));
  }
  // длинный сигнал в начале каждого сегмента (работа — выше, отдых — ниже) и в конце
  const sig = new Float32Array(Math.round(0.6 * SR));
  for (const seg of changes) addSignal(pcm, seg.t0, seg.kind === "work" ? 1500 : 700, sig.length);
  addSignal(pcm, total - 0.7, 700, sig.length);
  return wav(pcm);
}
function addSignal(pcm, at, freq, n) {
  const i0 = Math.round(at * SR), att = Math.round(0.01 * SR);
  for (let i = 0; i < n && i0 + i < pcm.length; i++) {
    const env = Math.min(1, i / att, (n - i) / att);
    const v = pcm[i0 + i] / 32767 * MUSIC_UNDER_BEEP + 0.6 * env * Math.sin(2 * Math.PI * freq * i / SR);
    pcm[i0 + i] = Math.max(-1, Math.min(1, v)) * 32767;
  }
}
function wav(pcm) {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
  h.setUint32(24, SR, true); h.setUint32(28, SR * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
  w(36, "data"); h.setUint32(40, pcm.length * 2, true);
  return new Blob([h, pcm], { type: "audio/wav" });
}

// ---------- воспроизведение ----------
const player = $("player");
function invalidate() {
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  player.removeAttribute("src");
  $("save").hidden = true;
  $("start").textContent = "Старт";
  $("phase").textContent = "";
  $("clock").textContent = "";
  document.body.className = "";
}
async function start() {
  if (audioUrl) { player.paused ? player.play() : player.pause(); return; }
  const btn = $("start");
  btn.disabled = true;
  try {
    const blob = await render((p) => { btn.textContent = "Собираю… " + Math.round(p * 100) + "%"; });
    audioUrl = URL.createObjectURL(blob);
    player.src = audioUrl;
    const a = $("save");
    a.href = audioUrl;
    a.download = `${PRESETS[TYPE].name} ${fmt(settings.work)}-${fmt(settings.rest)} ${settings.total}мин.wav`.replace(/:/g, ".");
    a.hidden = false;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${PRESETS[TYPE].name}: ${fmt(settings.work)} / ${fmt(settings.rest)}`,
        artist: `${settings.total} мин · музыка Kevin MacLeod`,
      });
    }
    await player.play();
  } catch (e) {
    $("phase").textContent = "Ошибка: " + e.message;
    invalidate();
  } finally {
    btn.disabled = false;
  }
}
$("start").addEventListener("click", start);
player.addEventListener("play", () => { $("start").textContent = "Пауза"; });
player.addEventListener("pause", () => { if (audioUrl) $("start").textContent = "Продолжить"; });
player.addEventListener("ended", () => { $("phase").textContent = "Готово!"; $("start").textContent = "Ещё раз"; });

function tick() {
  if (audioUrl && schedule.length) {
    const t = player.currentTime;
    const seg = schedule.find((s) => t < s.t1) || schedule[schedule.length - 1];
    const label = { lead: "Приготовься", work: "РАБОТА", rest: "Отдых" }[seg.kind];
    $("phase").textContent = seg.round ? `${label} · раунд ${seg.round}` : label;
    $("clock").textContent = fmt(seg.t1 - t);
    document.body.className = player.ended ? "" : seg.kind;
    $("left").textContent = "осталось " + fmt(schedule[schedule.length - 1].t1 - t);
  }
  requestAnimationFrame(tick);
}

// ---------- офлайн ----------
async function cacheAll() {
  const b = $("offline");
  const files = [...lib[TYPE], ...lib.relax].map((x) => x.file);
  b.disabled = true;
  let done = 0;
  try {
    const c = await caches.open("wt-music-v1");
    for (const f of files) {
      if (!(await c.match(f))) await c.add(f);
      b.textContent = `Сохраняю музыку… ${++done}/${files.length}`;
    }
    b.textContent = "Музыка сохранена — работает без интернета ✓";
  } catch (e) {
    b.textContent = "Не удалось сохранить, нужен интернет";
    b.disabled = false;
  }
}
async function checkOffline() {
  try {
    const c = await caches.open("wt-music-v1");
    const files = [...lib[TYPE], ...lib.relax].map((x) => x.file);
    let have = 0;
    for (const f of files) if (await c.match(f)) have++;
    if (have === files.length) { $("offline").textContent = "Музыка сохранена — работает без интернета ✓"; $("offline").disabled = true; }
  } catch (e) {}
}
$("offline").addEventListener("click", cacheAll);

(async function init() {
  document.title = PRESETS[TYPE].name;
  $("title").textContent = PRESETS[TYPE].name;
  renderSettings();
  if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("sw.js"); } catch (e) {} }
  lib = await (await fetch("music/library.json")).json();
  checkOffline();
  requestAnimationFrame(tick);
})();
