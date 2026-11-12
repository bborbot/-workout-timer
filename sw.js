// Офлайн: оболочка приложения кэшируется при установке, музыка — при первом использовании
// или по кнопке «Сохранить музыку». Новая версия — поменять VERSION.
const VERSION = "wt-shell-v16";
const MUSIC = "wt-music-v3";
const SHELL = ["./", "index.html", "home.js", "schedule.html", "schedule.js", "guides.html", "home.webmanifest", "warmup.html", "speed.html", "jumps.html", "bag.html", "animal.html", "strength.html", "stretch.html", "credits.html", "warmup-guide.html", "jumps-guide.html", "speed-guide.html", "bag-guide.html", "animal-guide.html", "strength-guide.html", "stretch-guide.html",
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
    const cache = await caches.open(isMusic ? MUSIC : VERSION);
    if (isMusic) {   // музыка: сначала из телефона — она большая и меняется раз в месяц
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    }
    // страницы и код: есть интернет — свежие (ждём до 3 с), нет — сохранённая копия
    try {
      const r = await Promise.race([fetch(e.request, { cache: "no-cache" }),
        new Promise((_, no) => setTimeout(() => no(new Error("slow")), 3000))]);
      if (r.ok) cache.put(e.request, r.clone());
      return r;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      return fetch(e.request);
    }
  })());
});
