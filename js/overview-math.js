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
import { monthlyEquivalentCents, nextDue } from "./recurring-view.js";

// A big entry outside a commitment is a one-off from this much up, in
// whole cents so it compares exactly.
export const ONE_OFF_CENTS = 30000;

const toCents = (value) => Math.round(Number(value) * 100);

// Which of the Money boxes an entry counts in.
function boxOf(expense) {
  if (expense.recurring_id != null) return "commitment";
  if (expense.categories?.kind === "lumpy" || toCents(expense.amount) >= ONE_OFF_CENTS) return "one-off";
  return "everyday";
}

// The order matters: a confirmed tithe or investment premium carries a
// recurring_id, and it must stay Giving or Set aside rather than become a
// commitment.
export function classifyEntry(expense) {
  const kind = expense.categories?.kind;
  if (kind === "give") return "giving";
  if (kind === "invest") return "set-aside";
  return boxOf(expense);
}

// The three boxes under the Money total. They use the same filter as the
// total (excluded_from_totals), so they always add up to it. A giving or
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

// What a normal month takes, in four layers. Two are promises (the
// registry) and two are habits (the ledger), which is why the headline can
// only ever be "about". A one-time charge is in none of them: it lands
// once, in Year ahead, and spreading it would invent a monthly cost.
export function typicalMonth(recurring, expenses, now) {
  const running = recurring
    .filter((item) => item.active && item.cadence !== "once")
    .map((item) => ({ ...item, monthlyCents: monthlyEquivalentCents(item) }));
  const ofKind = (...kinds) =>
    running.filter((item) => kinds.includes(item.categories?.kind ?? "everyday"));

  const billGroups = groupByCategory(ofKind("everyday", "lumpy"));
  const setAsideItems = ofKind("invest").sort((a, b) => b.monthlyCents - a.monthlyCents);
  const givingGroups = groupByCategory(ofKind("give"));

  const months = fullMonthsBefore(expenses, now);
  const held = new Set(months.map((month) => month.key));
  const everydayByLabel = new Map();
  let everydaySum = 0;
  let otherGivingSum = 0;
  for (const expense of expenses) {
    if (!held.has(expense.date.slice(0, 7))) continue;
    const cents = toCents(expense.amount);
    if (expense.categories?.excluded_from_totals) {
      // a linked tithe is already in the registry's figure: counting it
      // again here is the double count the links exist to prevent
      if (classifyEntry(expense) === "giving" && expense.recurring_id == null) otherGivingSum += cents;
    } else if (boxOf(expense) === "everyday") {
      const label = categoryLabel(expense.categories);
      everydayByLabel.set(label, (everydayByLabel.get(label) ?? 0) + cents);
      everydaySum += cents;
    }
  }
  const average = (sum) => (months.length ? Math.round(sum / months.length) : 0);

  const billsCents = billGroups.reduce((sum, group) => sum + group.cents, 0);
  const everydayCents = average(everydaySum);
  const setAsideCents = setAsideItems.reduce((sum, item) => sum + item.monthlyCents, 0);
  const otherGivingCents = average(otherGivingSum);
  const givingCents = givingGroups.reduce((sum, group) => sum + group.cents, otherGivingCents);
  const totalCents = billsCents + everydayCents + setAsideCents + givingCents;

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
    giving: { cents: givingCents, groups: givingGroups, otherCents: otherGivingCents },
  };
}

// ── year ahead (v1.20) ───────────────────────────────────────────────

const monthIndex = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

// Every date an item lands on inside the window, honouring its end date.
function landings(item, firstIndex, lastIndex) {
  const dates = [];
  let cursor = item.next_due;
  while (cursor && monthIndex(cursor) <= lastIndex && (!item.end_date || cursor <= item.end_date)) {
    if (monthIndex(cursor) >= firstIndex) dates.push(cursor);
    if (item.cadence === "once") break;
    cursor = nextDue(cursor, item.cadence, item.anchor_day);
  }
  return dates;
}

// Twelve months from the current one: when the big charges land, against
// the usual monthly commitments. Everyday spending isn't in it, because
// this is what's already promised.
//
// A monthly item counts in full for the current month even once it has
// been charged and moved on, or this month's bar would shrink with every
// confirm. A rarer item confirmed this month counts for the same reason.
export function yearAhead(recurring, now) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstIndex = first.getFullYear() * 12 + first.getMonth();
  const lastIndex = firstIndex + 11;
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(first.getFullYear(), first.getMonth() + i, 1);
    months.push({ key: monthKey(date), date, regularCents: 0, regularCount: 0, lumpCents: 0, lumps: [] });
  }
  const at = (index) => months[index - firstIndex];
  const addLump = (index, item) => {
    const cents = toCents(item.amount);
    at(index).lumpCents += cents;
    at(index).lumps.push({ name: item.name, cents });
  };

  for (const item of recurring) {
    if (item.cadence !== "monthly" && item.last_confirmed && monthIndex(item.last_confirmed) === firstIndex) {
      addLump(firstIndex, item);
    }
    if (!item.active) continue;
    const indexes = landings(item, firstIndex, lastIndex).map(monthIndex);
    if (item.cadence === "monthly") {
      if (item.next_due && monthIndex(item.next_due) === firstIndex + 1) indexes.unshift(firstIndex);
      for (const index of indexes) {
        at(index).regularCents += toCents(item.amount);
        at(index).regularCount += 1;
      }
    } else {
      for (const index of indexes) addLump(index, item);
    }
  }

  let heaviest = null;
  for (const month of months) {
    month.lumps.sort(byCentsDown);
    month.totalCents = month.regularCents + month.lumpCents;
    if (heaviest === null || month.totalCents > heaviest.totalCents) heaviest = month;
  }
  return { months, heaviest };
}

// ── big one-offs (v1.20) ─────────────────────────────────────────────

// How far back the list goes, as a date the query can use.
export function oneOffsSince(todayIso) {
  const [year, month, day] = todayIso.split("-").map(Number);
  const since = new Date(year - 1, month - 1, day);
  return `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
}

// A list and a total, and deliberately no monthly average: these are rare,
// and averaging them would turn a few trips into a standing cost.
export function oneOffs(expenses) {
  const items = expenses
    .filter((expense) => !expense.categories?.excluded_from_totals && classifyEntry(expense) === "one-off")
    .sort((a, b) => toCents(b.amount) - toCents(a.amount));
  return { items, totalCents: items.reduce((sum, expense) => sum + toCents(expense.amount), 0) };
}
