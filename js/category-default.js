// Smart form defaults (v1.2.1, generalized v1.4): the form opens on
// the value YOU log most — counted from your own entries over the last
// 60 days, all time as the fallback, null with no history. Per-person
// by design (created_by, the logger, not paid_by): Shawn's habit
// shouldn't set Claire's default. Pure and Node-tested; deliberately
// never a hardcoded pick — a rename or a habit change must never
// break it.

export function defaultCategoryId(expenses, userId, todayIso) {
  return mostUsedId(expenses, userId, todayIso, (e) => e.category_id);
}

// v1.4: same habit logic picks the usual card; untagged (pre-v1.4)
// entries don't vote.
export function defaultCardId(expenses, userId, todayIso) {
  return mostUsedId(expenses, userId, todayIso, (e) => e.card_id);
}

function mostUsedId(expenses, userId, todayIso, key) {
  const mine = expenses.filter((e) => e.created_by === userId && key(e) != null);
  const recent = mine.filter((e) => e.date >= shiftDays(todayIso, -60));
  return mode(recent, key) ?? mode(mine, key);
}

// v1.7.1: full usage ranking for the card picker grid — the user's
// most-picked cards first (last 60 days, then all time as tiebreak),
// unused cards keep their given order after. Returns a comparator-
// ready rank Map(id -> rank); lower rank = shown earlier.
export function usageRank(expenses, userId, todayIso, key) {
  const mine = expenses.filter((e) => e.created_by === userId && key(e) != null);
  const recentCounts = new Map();
  const allCounts = new Map();
  const cutoff = shiftDays(todayIso, -60);
  for (const e of mine) {
    const k = key(e);
    allCounts.set(k, (allCounts.get(k) ?? 0) + 1);
    if (e.date >= cutoff) recentCounts.set(k, (recentCounts.get(k) ?? 0) + 1);
  }
  const ids = [...allCounts.keys()].sort(
    (a, b) =>
      (recentCounts.get(b) ?? 0) - (recentCounts.get(a) ?? 0) ||
      allCounts.get(b) - allCounts.get(a),
  );
  return new Map(ids.map((id, i) => [id, i]));
}

function mode(list, key) {
  if (list.length === 0) return null;
  const counts = new Map();
  for (const e of list) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
  // ties resolve to the value seen first in the list (newest-first
  // fetch order → the more recently used one wins)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function shiftDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}
