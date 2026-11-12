import os
p = "app.js"; s = open(p, encoding="utf-8").read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a
    s = s.replace(a, b)
rep('const MUSIC_UNDER_BEEP = 0.45;\n', '''const MUSIC_UNDER_BEEP = 0.45;
const MUSIC_CACHE = "wt-music-v2";
''')
rep('''async function decode(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("нет файла " + url);
  const buf = await r.arrayBuffer();''', '''async function decode(item) {
  let buf;
  if (item.blob) buf = await item.blob.arrayBuffer();
  else {
    const r = await fetch(item.file);
    if (!r.ok) throw new Error("нет файла " + item.file);
    buf = await r.arrayBuffer();
  }''')
rep('if (!pl.data) pl.data = await decode(pl.order[pl.idx % pl.order.length].file);',
    'if (!pl.data) pl.data = await decode(pl.order[pl.idx % pl.order.length]);')
rep('const work = playlist(lib[TYPE]), rest = playlist(lib.relax);',
    'const work = playlist(my.work.length ? my.work : lib[TYPE]), rest = playlist(my.rest.length ? my.rest : lib.relax);')
rep('''        artist: `${settings.total} мин · музыка Kevin MacLeod`,''',
    '''        artist: `${settings.total} мин`,''')
rep('const c = await caches.open("wt-music-v1");\n    for (const f of files) {', 'const c = await caches.open(MUSIC_CACHE);\n    for (const f of files) {')
rep('const c = await caches.open("wt-music-v1");\n    const files', 'const c = await caches.open(MUSIC_CACHE);\n    const files')
rep('''$("offline").addEventListener("click", cacheAll);''', '''$("offline").addEventListener("click", cacheAll);

// ---------- мои треки: хранятся только в телефоне (IndexedDB), в интернет не уходят ----------
const my = { work: [], rest: [] };
function idb() {
  return new Promise((ok, bad) => {
    const r = indexedDB.open("wt-my", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("tracks", { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
}
async function loadMy() {
  my.work = []; my.rest = [];
  try {
    const db = await idb();
    const all = await new Promise((ok, bad) => {
      const q = db.transaction("tracks").objectStore("tracks").getAll();
      q.onsuccess = () => ok(q.result); q.onerror = () => bad(q.error);
    });
    for (const t of all) if (t.type === TYPE) my[t.role].push(t);
  } catch (e) {}
  for (const role of ["work", "rest"]) {
    const n = my[role].length;
    $("my" + role + "n").textContent = n ? `своих треков: ${n}` : "играет встроенная музыка";
    $("clr" + role).hidden = !n;
  }
}
async function addMy(role, files) {
  try {
    const db = await idb();
    await new Promise((ok, bad) => {
      const tx = db.transaction("tracks", "readwrite");
      for (const f of files) tx.objectStore("tracks").add({ type: TYPE, role, name: f.name, blob: f });
      tx.oncomplete = ok; tx.onerror = () => bad(tx.error);
    });
  } catch (e) { alert("Не удалось сохранить треки: " + e.message); }
  invalidate(); loadMy();
}
async function clearMy(role) {
  if (!confirm("Убрать свои треки и вернуть встроенную музыку?")) return;
  try {
    const db = await idb();
    await new Promise((ok, bad) => {
      const tx = db.transaction("tracks", "readwrite");
      for (const t of my[role]) tx.objectStore("tracks").delete(t.id);
      tx.oncomplete = ok; tx.onerror = () => bad(tx.error);
    });
  } catch (e) {}
  invalidate(); loadMy();
}
for (const role of ["work", "rest"]) {
  $("my" + role).addEventListener("change", (e) => { if (e.target.files.length) addMy(role, [...e.target.files]); e.target.value = ""; });
  $("clr" + role).addEventListener("click", () => clearMy(role));
}''')
rep('  checkOffline();\n', '  checkOffline();\n  loadMy();\n  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});\n')
open(p + ".tmp", "w", encoding="utf-8").write(s); os.replace(p + ".tmp", p)

g = "_src/gen.py"; s = open(g, encoding="utf-8").read()
a = '<button class="sub" id="offline">Сохранить музыку для работы без интернета</button>\n'
assert s.count(a) == 1
s = s.replace(a, a + '''<h2>Моя музыка</h2>
<p class="note">Свои песни (MP3, M4A) из «Файлов». Хранятся только в этом телефоне.</p>
<label class="sub">+ Мои треки для работы<input type="file" id="mywork" accept="audio/*" multiple hidden></label>
<div class="note" id="myworkn"></div><button class="sub" id="clrwork" hidden>Убрать мои треки для работы</button>
<label class="sub">+ Мои треки для отдыха<input type="file" id="myrest" accept="audio/*" multiple hidden></label>
<div class="note" id="myrestn"></div><button class="sub" id="clrrest" hidden>Убрать мои треки для отдыха</button>
''')
s = s.replace("Музыка: Kevin MacLeod, <a href=\"credits.html\">список треков</a>.", "Встроенная музыка: Kevin MacLeod, <a href=\"credits.html\">список треков</a>.")
open(g, "w", encoding="utf-8").write(s)

w = "sw.js"; s = open(w, encoding="utf-8").read()
s = s.replace('const VERSION = "wt-shell-v1";', 'const VERSION = "wt-shell-v2";\nconst MUSIC = "wt-music-v2";')
s = s.replace('''ks.filter((k) => k.startsWith("wt-shell-") && k !== VERSION)''', '''ks.filter((k) => k !== VERSION && k !== MUSIC)''')
s = s.replace('caches.open(isMusic ? "wt-music-v1" : VERSION)', 'caches.open(isMusic ? MUSIC : VERSION)')
s = s.replace('const hit = await caches.match(e.request, { ignoreSearch: true });', 'const hit = await (await caches.open(isMusic ? MUSIC : VERSION)).match(e.request, { ignoreSearch: true });')
open(w, "w", encoding="utf-8").write(s)
print("patched")
