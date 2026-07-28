// Pure dashboard math, extracted from main.js for Node tests (v1.1
// piece 2a). Sums in integer cents: amounts are exact numeric in
// Postgres, but JS numbers are floats — 84.2 + 9.9 style drift would
// show on screen.

export function categoryLabel(cat) {
  return cat?.icon ? `${cat.icon} ${cat.name}` : (cat?.name ?? "");
}

// expenses arrive newest-first (ledger order). Categories flagged
// excluded_from_totals (e.g. Blessing) are logged but never counted —
// not in the headline, not in the bars, not in past-month sums; they
// surface separately in `excluded` for this month.
export function summarize(expenses, now) {
  const thisKey = monthKey(now);
  let thisCents = 0;
  const byCategory = new Map();
  const byMonth = new Map();
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
    } else {
      byMonth.set(key, (byMonth.get(key) ?? 0) + cents);
    }
  }

  // Past three calendar months, oldest first — but only from the month
  // history began; a wall of S$0 rows would be noise in the first weeks.
  const earliestKey = expenses.length
    ? expenses[expenses.length - 1].date.slice(0, 7)
    : null;
  const past = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    if (earliestKey !== null && key >= earliestKey) {
      past.push({ date: d, cents: byMonth.get(key) ?? 0 });
    }
  }

  return { thisCents, byCategory, past, excluded };
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
