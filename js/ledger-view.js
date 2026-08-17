// Pure ledger presentation logic (v1.1 piece 3): person filter + day
// grouping, extracted for Node tests. Expenses arrive newest-first
// (the fetch order); groups preserve that order.

export function ledgerView(expenses, person = "all", categoryId = "all") {
  const filtered = expenses.filter(
    (e) =>
      (person === "all" || e.paid_by === person) &&
      (categoryId === "all" || e.category_id === Number(categoryId)),
  );
  const groups = [];
  for (const expense of filtered) {
    const last = groups.at(-1);
    if (last?.date === expense.date) last.items.push(expense);
    else groups.push({ date: expense.date, items: [expense] });
  }
  return groups;
}

// Day total for the header (v1.10 — Claire: "see daily spending"):
// counted spending only — categories flagged excluded_from_totals
// (e.g. Blessing) are listed but never summed, matching the
// dashboard's definition of "spent". null when nothing counts, so the
// header can omit the figure instead of showing a misleading $0.
export function dayTotal(items) {
  let total = null;
  for (const e of items) {
    if (e.categories?.excluded_from_totals) continue;
    total = (total ?? 0) + Number(e.amount);
  }
  return total;
}

// The FYI glance on the newest day header (v1.10 — Shawn: total beside
// the date frees the right side for "the previous 2 days"): totals for
// the calendar days immediately before the anchor, zero-filled — a
// quiet day is a fact worth showing, not a gap. Calendar days, not
// logged days: "past 2 days" means yesterday and the day before.
export function recentDayTotals(groups, anchorDate, days = 2) {
  const byDate = new Map(groups.map((g) => [g.date, dayTotal(g.items)]));
  const out = [];
  const d = new Date(anchorDate + "T00:00:00");
  for (let i = 0; i < days; i++) {
    d.setDate(d.getDate() - 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: iso, total: byDate.get(iso) ?? 0 });
  }
  return out;
}
