// Strategy: network-first for our own files (staleness impossible while
// online; cache is the offline fallback), stale-while-revalidate for the
// esm.sh CDN, and NO caching for Supabase — data failures must stay
// visible, never masked by a stale cache (SPEC: no offline entry).
const CACHE = "nest-v1";
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "js/main.js",
  "js/data.js",
  "js/supabase.js",
  "js/config.js",
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
  } else if (url.hostname === "esm.sh") {
    event.respondWith(staleWhileRevalidate(event.request));
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => cached);
  return cached ?? refresh;
}
