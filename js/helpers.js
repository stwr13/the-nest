// Small shared pieces (v1.22) that were copied between modules. Pure,
// Node-tested.

// Money as whole cents, so sums and comparisons are exact. Amounts come
// back from Postgres as strings ("12.30").
export const toCents = (value) => Math.round(Number(value) * 100);

// A local calendar date as YYYY-MM-DD. toISOString() would give the UTC
// date, which is yesterday for the first eight hours of a Singapore day.
export const isoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Whether a failed request means "no connection". Each browser words it
// differently: Chrome on a desktop says "Failed to fetch", Firefox
// "NetworkError when attempting to fetch resource", and WebKit (so every
// browser on the iPhone, Chrome included) says "Load failed". Older iOS
// versions said "The Internet connection appears to be offline." or "The
// network connection was lost."
export function isOffline(error) {
  const message = error?.message ?? String(error ?? "");
  return /fetch|load failed|internet connection appears to be offline|network connection was lost/i.test(message);
}
