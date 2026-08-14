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
  "js/cards-math.js",
  "js/amount-expr.js",
  "js/version.js",
  "js/vendor/supabase-js-2.111.0.js",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache:"reload" bypasses the HTTP cache — without it, installing
      // within the CDN's max-age window bakes STALE files into the new
      // cache and the build arrives torn (v1.8 fix, caught in preview)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
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
  if (url.origin !== self.location.origin) return;

  const refresh = caches.open(CACHE).then((cache) =>
    // no-cache: revalidate with the server (etag makes this cheap) so
    // the background refresh can't be satisfied by a stale HTTP cache
    fetch(new Request(event.request, { cache: "no-cache" })).then((fresh) => {
      if (fresh.ok) return cache.put(event.request, fresh.clone()).then(() => fresh);
      return fresh;
    }),
  );
  // waitUntil keeps the worker alive until the refresh lands — without
  // it, a quickly-closed page lets the browser kill the SW mid-put and
  // the cache never advances (v1.8 fix, caught in preview testing)
  event.waitUntil(refresh.catch(() => {}));
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(event.request, { ignoreSearch: true }))
      .then((cached) => cached ?? refresh),
  );
});
