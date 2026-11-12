// Офлайн: оболочка приложения кэшируется при установке, музыка — при первом использовании
// или по кнопке «Сохранить музыку». Новая версия — поменять VERSION.
const VERSION = "wt-shell-v5";
const MUSIC = "wt-music-v3";
const SHELL = ["./", "index.html", "warmup.html", "speed.html", "jumps.html", "bag.html", "animal.html", "strength.html", "stretch.html", "credits.html",
  "app.js", "style.css", "music/library.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== MUSIC)
    .map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isMusic = url.pathname.includes("/music/") && url.pathname.endsWith(".mp3");
  e.respondWith((async () => {
    const hit = await (await caches.open(isMusic ? MUSIC : VERSION)).match(e.request, { ignoreSearch: true });
    if (hit) {
      if (!isMusic) fetch(e.request).then((r) => r.ok && caches.open(VERSION).then((c) => c.put(e.request, r))).catch(() => {});
      return hit;
    }
    const r = await fetch(e.request);
    if (r.ok) {
      const copy = r.clone();
      caches.open(isMusic ? MUSIC : VERSION).then((c) => c.put(e.request, copy));
    }
    return r;
  })());
});
