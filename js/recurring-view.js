// Pure recurring-registry logic (v1.14), extracted for Node tests.
//
// The rule the whole module serves: the registry PREDICTS, the ledger
// RECORDS. Nothing here writes an expense — it only works out what is
// due, what a commitment costs per month, and how much of a finite
// commitment is left. Confirming is a server call (confirm_recurring),
// because the due strip is shared and two phones must not be able to
// log the same charge twice.

const CADENCE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Mirrors public.recurring_next_due in the migration. Re-anchors every
// step instead of adding a month to the last due date: an item anchored
// on the 31st must land on the 28th in February and RETURN to the 31st
// in March. Stepping from the previous due date would drift to the 28th
// permanently — the bug this function exists to prevent.
export function nextDue(fromDue, cadence, anchorDay) {
  const from = new Date(fromDue + "T00:00:00");
  const target = new Date(from.getFullYear(), from.getMonth() + CADENCE_MONTHS[cadence], 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, daysInMonth));
  return iso(target);
}

// What the due strip shows: everything already owed, oldest first.
// Confirming late is normal (nobody opens the app on the 1st), so a
// backlog is an expected state, not an error — it is the visible form
// of "we haven't logged these yet", which is the whole point.
export function dueItems(registry, todayIso) {
  return registry
    .filter((r) => r.active && r.next_due && r.next_due <= todayIso)
    .sort((a, b) => a.next_due.localeCompare(b.next_due));
}

// The next few not yet owed — a quiet heads-up under the strip.
export function upcomingItems(registry, todayIso, limit = 2) {
  return registry
    .filter((r) => r.active && r.next_due && r.next_due > todayIso)
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .slice(0, limit);
}

// Amortisation lives HERE and nowhere else: a yearly premium shows as a
// monthly figure in the registry so "what are we committed to" is one
// honest number. The ledger never sees this — it records the single
// real charge on its real date.
export function monthlyEquivalentCents(item) {
  const cents = Math.round(Number(item.amount) * 100);
  return Math.round(cents / CADENCE_MONTHS[item.cadence]);
}

// Split by the category's excluded_from_totals flag, the same flag the
// dashboard already honours. A $2,000 investment premium is money that
// left the account — it belongs in the ledger — but it is not spending,
// and letting it sit in the same total as groceries would swamp the
// household number and teach both of them to distrust it.
export function commitmentTotals(registry) {
  let spending = 0;
  let excluded = 0;
  for (const item of registry) {
    if (!item.active) continue;
    const cents = monthlyEquivalentCents(item);
    if (item.categories?.excluded_from_totals) excluded += cents;
    else spending += cents;
  }
  return { spendingCents: spending, excludedCents: excluded, totalCents: spending + excluded };
}

// For a commitment with an end date: how many payments are left and
// what they add up to. This is the "$X until age Y" note turned into a
// number the app can derive instead of a fact someone has to remember.
// Counts the payment already due as one of them.
export function remaining(item) {
  if (!item.active || !item.next_due || !item.end_date) return null;
  let count = 0;
  let cursor = item.next_due;
  // a commitment is finite by definition; the guard is only against a
  // mistyped end date decades out
  while (cursor <= item.end_date && count < 1200) {
    count += 1;
    cursor = nextDue(cursor, item.cadence, item.anchor_day);
  }
  const cents = Math.round(Number(item.amount) * 100) * count;
  return { payments: count, cents };
}

// How late something is, in whole days — the strip's badge.
export function daysLate(dueIso, todayIso) {
  const due = new Date(dueIso + "T00:00:00");
  const today = new Date(todayIso + "T00:00:00");
  return Math.round((today - due) / 86400000);
}
