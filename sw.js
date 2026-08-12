// Strategy (v1.2 piece 0): CACHE-FIRST for our own files — the shell
// opens instantly from cache (and offline), while a background fetch
// refreshes the cache so the NEXT launch is current. The accepted
// trade-off: an update lands one launch late; the version marker in the
// footer (js/version.js) is what makes that lag diagnosable instead of
// ambiguous. Supabase requests are never cached — data failures must
// stay visible, never masked by a stale cache (SPEC: no offline entry).
importScripts("js/version.js");
const CACHE = `nest-${self.APP_VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/main.js",
  "js/data.js",
  "js/supabase.js",
  "js/config.js",
  "js/identity.js",
  "js/dashboard-math.js",
  "js/ledger-view.js",
  "js/todos-view.js",
  "js/category-default.js",
  "js/amount-expr.js",
  "js/version.js",
  "js/vendor/supabase-js-2.111.0.js",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.hostname.endsWith("supabase.co")) return;
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  // Kick off the refresh either way; when we serve from cache it runs
  // in the background and only updates the copy the next launch reads.
  const refresh = fetch(request).then((fresh) => {
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  });
  if (cached) {
    refresh.catch(() => {}); // offline: the cached copy already answered
    return cached;
  }
  return refresh;
}
