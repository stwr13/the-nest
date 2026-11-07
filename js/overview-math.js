// What a ledger entry IS, and what a month is made of (v1.19). Pure,
// Node-tested.
//
// The rule everything here serves: SPENDING IS THE SHARE. A group dinner
// paid in advance on the card counts at our part of it, because the rest
// comes back. So every sum in this module reads expenses.amount, and only
// js/cards-math.js ever reads the card's full charge, because a bank's
// miles cap counts the whole bill. A test holds this line.
//
// Nothing here matches on a category's name or a note's text: either of
// them can rename a category in the manager at any time. That is what
// categories.kind is for.

import { monthKey } from "./dashboard-math.js";

// A big entry outside a commitment is a one-off from this much up, in
// whole cents so it compares exactly.
export const ONE_OFF_CENTS = 30000;

const toCents = (value) => Math.round(Number(value) * 100);

// The order matters: a confirmed tithe or investment premium carries a
// recurring_id, and it must stay Giving or Set aside rather than become a
// commitment.
export function classifyEntry(expense) {
  const kind = expense.categories?.kind ?? "everyday";
  if (kind === "give") return "giving";
  if (kind === "invest") return "set-aside";
  if (expense.recurring_id != null) return "commitment";
  if (kind === "lumpy" || toCents(expense.amount) >= ONE_OFF_CENTS) return "one-off";
  return "everyday";
}

// The three boxes under the Money total. They use the same filter as the
// total (excluded_from_totals), so they always add up to it. A giving or
// investment category someone has chosen to count reads as Everyday,
// which keeps that promise rather than dropping the entry from the boxes.
export function monthSplit(expenses, key) {
  const split = { everydayCents: 0, commitmentCents: 0, oneOffCents: 0 };
  for (const expense of expenses) {
    if (!expense.date.startsWith(key) || expense.categories?.excluded_from_totals) continue;
    const cents = toCents(expense.amount);
    const kind = classifyEntry(expense);
    if (kind === "commitment") split.commitmentCents += cents;
    else if (kind === "one-off") split.oneOffCents += cents;
    else split.everydayCents += cents;
  }
  return split;
}

// The earliest date among the rows in hand. Works on any order, and on
// the capped ledger fetch too: once history outgrows the cap, the oldest
// month in hand is cut short for the same reason the first month was.
function firstDateIn(expenses) {
  let first = null;
  for (const expense of expenses) {
    if (first === null || expense.date < first) first = expense.date;
  }
  return first;
}

// Up to `limit` whole calendar months before the given month, oldest
// first. The month the rows begin in only counts if they begin on its 1st:
// the ledger opened mid-month, and averaging a part-month would drag every
// comparison down.
export function fullMonthsBefore(expenses, monthDate, limit = 3) {
  const first = firstDateIn(expenses);
  if (first === null) return [];
  const firstKey = first.slice(0, 7);
  const startsClean = first.endsWith("-01");
  const months = [];
  for (let back = limit; back >= 1; back -= 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - back, 1);
    const key = monthKey(date);
    if (key > firstKey || (key === firstKey && startsClean)) months.push({ date, key });
  }
  return months;
}

// Everyday against the earlier months, replacing the old comparison of
// totals: months from before the bills were being confirmed hold almost
// no commitments, so comparing totals stops being fair the moment they
// are. Returns the months too, so the average can be checked against them.
export function everydayComparison(expenses, monthDate) {
  const months = fullMonthsBefore(expenses, monthDate).map((month) => ({
    ...month,
    cents: monthSplit(expenses, month.key).everydayCents,
  }));
  const averageCents = months.length
    ? Math.round(months.reduce((sum, month) => sum + month.cents, 0) / months.length)
    : null;
  return { months, averageCents };
}
