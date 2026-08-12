// Smart category default (v1.2.1): the form opens on the category YOU
// log most — counted from your own entries over the last 60 days, all
// time as the fallback, null with no history. Per-person by design
// (created_by, the logger, not paid_by): Shawn's habit shouldn't set
// Claire's default. Pure and Node-tested; deliberately not a hardcoded
// "Eating out" — a rename or a habit change must never break it.

export function defaultCategoryId(expenses, userId, todayIso) {
  const mine = expenses.filter((e) => e.created_by === userId);
  const recent = mine.filter((e) => e.date >= shiftDays(todayIso, -60));
  return modeCategory(recent) ?? modeCategory(mine);
}

function modeCategory(list) {
  if (list.length === 0) return null;
  const counts = new Map();
  for (const e of list) counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);
  // ties resolve to the category seen first in the list (newest-first
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
