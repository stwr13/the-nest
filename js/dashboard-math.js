// Pure dashboard math, extracted from main.js for Node tests (v1.1
// piece 2a). Sums in integer cents: amounts are exact numeric in
// Postgres, but JS numbers are floats — 84.2 + 9.9 style drift would
// show on screen.

export function categoryLabel(cat) {
  return cat?.icon ? `${cat.icon} ${cat.name}` : (cat?.name ?? "");
}

// expenses arrive newest-first (ledger order). Categories flagged
// excluded_from_totals (e.g. Blessing) are logged but never counted —
// not in the headline, not in the bars; they surface separately in
// `excluded` for this month.
export function summarize(expenses, now) {
  const thisKey = monthKey(now);
  // the month before the one on screen — its per-category totals are
  // what the bars compare against (v1.13.0). Computed in the same pass:
  // the data was always here, only the delta was missing.
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  let thisCents = 0;
  const byCategory = new Map();
  const prevByCategory = new Map();
  const excluded = new Map();

  for (const expense of expenses) {
    const key = expense.date.slice(0, 7);
    const cents = Math.round(Number(expense.amount) * 100);
    const label = categoryLabel(expense.categories);
    if (expense.categories?.excluded_from_totals) {
      if (key === thisKey) excluded.set(label, (excluded.get(label) ?? 0) + cents);
      continue;
    }
    if (key === thisKey) {
      thisCents += cents;
      byCategory.set(label, (byCategory.get(label) ?? 0) + cents);
    } else if (key === prevKey) {
      prevByCategory.set(label, (prevByCategory.get(label) ?? 0) + cents);
    }
  }

  return { thisCents, byCategory, prevByCategory, excluded };
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
