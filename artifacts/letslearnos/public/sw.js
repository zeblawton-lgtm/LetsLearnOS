// LetsLearnOS service worker — offline-first app shell + asset caching.
//
// Strategy:
//  - Navigations: network-first, fall back to cached index.html (SPA shell).
//  - Same-origin GET assets (JS/CSS/sprites/audio/fonts): cache-first, then
//    network; successful responses are cached so the kiosk works fully offline
//    after the first run.
// The kiosk has no internet during gameplay, so once assets are cached the app
// is entirely self-contained.

// Increment when non-hashed shell assets change. The activate handler removes
// caches created by earlier public builds.
const CACHE = "letslearnos-1";
const SCOPE = new URL(self.registration.scope);
const SHELL = [SCOPE.pathname, SCOPE.pathname + "manifest.webmanifest", SCOPE.pathname + "sprites/fallback.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin
  if (url.pathname.startsWith(SCOPE.pathname + "api/")) return; // never cache API

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(SCOPE.pathname).then((r) => r || caches.match(SCOPE.pathname + "index.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
