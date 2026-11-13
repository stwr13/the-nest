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

import { categoryLabel, monthKey } from "./dashboard-math.js";
import { monthlyEquivalentCents } from "./recurring-view.js";
import { toCents, isoDate } from "./helpers.js";

// A big entry outside a commitment is a one-off from this much up, in
// whole cents so it compares exactly.
export const ONE_OFF_CENTS = 30000;

// Which of the Money boxes an entry counts in.
function boxOf(expense) {
  if (expense.recurring_id != null) return "commitment";
  if (expense.categories?.kind === "lumpy" || toCents(expense.amount) >= ONE_OFF_CENTS) return "one-off";
  return "everyday";
}

// The order matters: a confirmed investment or insurance premium carries
// a recurring_id, and it must stay Set aside rather than become a
// commitment.
//
// The database also allows kind 'give'. Since v1.20.1 every gift and
// tithe counts as spending, so nothing uses it, and it reads as everyday.
export function classifyEntry(expense) {
  if (expense.categories?.kind === "invest") return "set-aside";
  return boxOf(expense);
}

// The three boxes under the Money total. They use the same filter as the
// total (excluded_from_totals), so they always add up to it. An
// investment category someone has chosen to count falls to the same rules
// as anything else, which keeps that promise rather than dropping the
// entry from the boxes.
export function monthSplit(expenses, key) {
  const split = { everydayCents: 0, commitmentCents: 0, oneOffCents: 0 };
  for (const expense of expenses) {
    if (!expense.date.startsWith(key) || expense.categories?.excluded_from_totals) continue;
    const cents = toCents(expense.amount);
    const box = boxOf(expense);
    if (box === "commitment") split.commitmentCents += cents;
    else if (box === "one-off") split.oneOffCents += cents;
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

// ── a typical month (v1.20) ──────────────────────────────────────────

const byCentsDown = (a, b) => b.cents - a.cents;

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.category_id) ?? {
      id: item.category_id,
      name: item.categories?.name ?? "",
      label: categoryLabel(item.categories),
      cents: 0,
      items: [],
    };
    group.cents += item.monthlyCents;
    group.items.push(item);
    groups.set(item.category_id, group);
  }
  for (const group of groups.values()) group.items.sort((a, b) => b.monthlyCents - a.monthlyCents);
  return [...groups.values()].sort(byCentsDown);
}

// What a normal month takes, in three layers. Two are promises (the
// registry) and one is habit (the ledger), which is why the headline can
// only ever be "about". A one-time charge is in none of them: it lands
// once, on its date, and spreading it would invent a monthly cost.
export function typicalMonth(recurring, expenses, now) {
  const running = recurring
    .filter((item) => item.active && item.cadence !== "once")
    .map((item) => ({ ...item, monthlyCents: monthlyEquivalentCents(item) }));
  const isSetAside = (item) => item.categories?.kind === "invest";

  // everything that isn't set aside is a bill, whatever its kind, so a
  // kind nothing expects can't drop an item out of every layer
  const billGroups = groupByCategory(running.filter((item) => !isSetAside(item)));
  const setAsideItems = running.filter(isSetAside).sort((a, b) => b.monthlyCents - a.monthlyCents);

  const months = fullMonthsBefore(expenses, now);
  const held = new Set(months.map((month) => month.key));
  const everydayByLabel = new Map();
  let everydaySum = 0;
  for (const expense of expenses) {
    if (!held.has(expense.date.slice(0, 7)) || expense.categories?.excluded_from_totals) continue;
    if (boxOf(expense) !== "everyday") continue;
    const cents = toCents(expense.amount);
    const label = categoryLabel(expense.categories);
    everydayByLabel.set(label, (everydayByLabel.get(label) ?? 0) + cents);
    everydaySum += cents;
  }
  const average = (sum) => (months.length ? Math.round(sum / months.length) : 0);

  const billsCents = billGroups.reduce((sum, group) => sum + group.cents, 0);
  const everydayCents = average(everydaySum);
  const setAsideCents = setAsideItems.reduce((sum, item) => sum + item.monthlyCents, 0);
  const totalCents = billsCents + everydayCents + setAsideCents;

  return {
    months,
    totalCents,
    // to the nearest hundred dollars: two of the four layers are averages,
    // and a figure to the cent would claim a precision it doesn't have
    headlineDollars: Math.round(totalCents / 10000) * 100,
    bills: { cents: billsCents, groups: billGroups },
    everyday: {
      cents: everydayCents,
      groups: [...everydayByLabel]
        .map(([label, sum]) => ({ label, cents: average(sum) }))
        .sort(byCentsDown),
    },
    setAside: { cents: setAsideCents, items: setAsideItems },
  };
}

// ── month by month (v1.27) ───────────────────────────────────────────

// How many full months sit before the current one. Shawn, 2026-11-14:
// "I like the bar so that it allows me to look at the past in
// comparison". It replaced Year ahead, a twelve-month look forward at
// charges already promised.
export const PAST_MONTHS = 6;

// The last PAST_MONTHS months and this one, oldest first, each with
// Money's three boxes for that month, so a bar is always the same figure
// as Money's total. This month is actual so far, never an estimate of
// where it ends. A month before the ledger's first full month has no
// split: its bar would read as a light month rather than a missing one.
export function monthByMonth(expenses, now, count = PAST_MONTHS) {
  const full = new Set(fullMonthsBefore(expenses, now, count).map((month) => month.key));
  const months = [];
  for (let back = count; back >= 0; back -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = monthKey(date);
    const current = back === 0;
    const split = current || full.has(key) ? monthSplit(expenses, key) : null;
    const totalCents = split ? split.everydayCents + split.commitmentCents + split.oneOffCents : 0;
    months.push({ key, date, current, split, totalCents });
  }
  return months;
}

// ── big one-offs (v1.20) ─────────────────────────────────────────────

// How far back the list goes, as a date the query can use.
export function oneOffsSince(todayIso) {
  const [year, month, day] = todayIso.split("-").map(Number);
  return isoDate(new Date(year - 1, month - 1, day));
}

// A list and a total, and deliberately no monthly average: these are rare,
// and averaging them would turn a few trips into a standing cost.
export function oneOffs(expenses) {
  const items = expenses
    .filter((expense) => !expense.categories?.excluded_from_totals && classifyEntry(expense) === "one-off")
    .sort((a, b) => toCents(b.amount) - toCents(a.amount));
  return { items, totalCents: items.reduce((sum, expense) => sum + toCents(expense.amount), 0) };
}
