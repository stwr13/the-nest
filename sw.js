// Strategy: network-first for our own files (staleness impossible while
// online; cache is the offline fallback) and NO caching for Supabase —
// data failures must stay visible, never masked by a stale cache
// (SPEC: no offline entry). The esm.sh branch is gone: the Supabase
// client is vendored and precached with the rest of the shell.
const CACHE = "nest-v2";
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
  "js/amount-expr.js",
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
    event.respondWith(networkFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}
