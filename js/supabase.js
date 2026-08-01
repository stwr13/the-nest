import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// The client is vendored (js/vendor/, loaded by index.html) rather than
// imported from a CDN: esm.sh served it as 16 chained cross-origin
// requests that didn't finish until ~1.3s — most of the 2-3s cold open
// Shawn reported (2026-08-01). One same-origin file instead, precached
// by the service worker. Upgrade = drop in a new pinned file, update
// index.html + sw.js.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
