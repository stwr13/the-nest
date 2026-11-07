import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyEntry,
  monthSplit,
  fullMonthsBefore,
  everydayComparison,
  ONE_OFF_CENTS,
} from "../js/overview-math.js";
import { summarize } from "../js/dashboard-math.js";
import { cardSummary } from "../js/cards-math.js";

const cat = (kind = "everyday", excluded = false) => ({
  name: "A category",
  icon: null,
  excluded_from_totals: excluded,
  kind,
});

const entry = (over = {}) => ({
  amount: "20.00",
  date: "2026-09-10",
  recurring_id: null,
  categories: cat(),
  ...over,
});

test("classify: giving and set aside win over a recurring link", () => {
  // the order is the whole point: a confirmed tithe has a recurring_id
  assert.equal(classifyEntry(entry({ categories: cat("give", true), recurring_id: 7 })), "giving");
  assert.equal(classifyEntry(entry({ categories: cat("invest", true), recurring_id: 7 })), "set-aside");
});

test("classify: a linked entry is a commitment, however big", () => {
  assert.equal(classifyEntry(entry({ recurring_id: 7, amount: "900.00" })), "commitment");
  assert.equal(classifyEntry(entry({ recurring_id: 7, categories: cat("lumpy") })), "commitment");
});

test("classify: lumpy categories and big entries are one-offs", () => {
  assert.equal(classifyEntry(entry({ categories: cat("lumpy"), amount: "15.00" })), "one-off");
  assert.equal(classifyEntry(entry({ amount: "300.00" })), "one-off");
  assert.equal(classifyEntry(entry({ amount: "299.99" })), "everyday");
  assert.equal(ONE_OFF_CENTS, 30000);
});

test("classify: giving and big amounts ignore the threshold order", () => {
  assert.equal(classifyEntry(entry({ categories: cat("give", true), amount: "800.00" })), "giving");
});

test("classify: an entry with no kind yet reads as everyday", () => {
  assert.equal(classifyEntry(entry({ categories: { name: "Old client row" } })), "everyday");
});

// The share rule. A group dinner charged in full and split afterwards
// counts at the household's part, in Everyday, and is not a one-off just
// because the card took a big number. Only the miles caps see that number.
test("spending is the share, never the card charge", () => {
  const dinner = entry({
    amount: "96.25",
    card_charged: "385.00",
    card_id: 4,
    date: "2026-09-10",
  });
  assert.equal(classifyEntry(dinner), "everyday");
  const split = monthSplit([dinner], "2026-09");
  assert.equal(split.everydayCents, 9625);
  assert.equal(split.oneOffCents, 0);
  assert.equal(summarize([dinner], new Date(2026, 8, 1)).thisCents, 9625);

  // and the one place that does count the full charge still does
  const [card] = cardSummary([dinner], [{ id: 4, cap: 1000 }], new Date(2026, 8, 1));
  assert.equal(card.spentCents, 38500);
});

test("only the cap maths reads the card charge", () => {
  for (const file of ["overview-math", "dashboard-math", "ledger-view", "recurring-view", "horizon-view"]) {
    const source = readFileSync(new URL(`../js/${file}.js`, import.meta.url), "utf8");
    assert.ok(!source.includes("card_charged"), `${file}.js must not read card_charged`);
  }
  const cards = readFileSync(new URL("../js/cards-math.js", import.meta.url), "utf8");
  assert.ok(cards.includes("card_charged"));
});

test("nothing classifies by a category name or a note", () => {
  const source = readFileSync(new URL("../js/overview-math.js", import.meta.url), "utf8");
  assert.ok(!/categories\??\.name/.test(source), "no matching on category names");
  assert.ok(!/\.note\b/.test(source), "no matching on note text");
});

test("the three boxes add up to the dashboard total", () => {
  const expenses = [
    entry({ amount: "40.10", date: "2026-09-02" }),
    entry({ amount: "1200.00", date: "2026-09-03", recurring_id: 3 }),
    entry({ amount: "650.00", date: "2026-09-04", categories: cat("lumpy") }),
    entry({ amount: "410.00", date: "2026-09-05" }),
    // outside the total: stays outside the boxes
    entry({ amount: "500.00", date: "2026-09-06", categories: cat("give", true), recurring_id: 8 }),
    entry({ amount: "900.00", date: "2026-09-06", categories: cat("invest", true), recurring_id: 9 }),
    entry({ amount: "30.00", date: "2026-09-06", categories: cat("everyday", true) }),
    // another month
    entry({ amount: "77.00", date: "2026-08-30" }),
    // a giving category someone chose to count still reaches a box
    entry({ amount: "12.00", date: "2026-09-07", categories: cat("give", false) }),
  ];
  const split = monthSplit(expenses, "2026-09");
  assert.deepEqual(split, { everydayCents: 5210, commitmentCents: 120000, oneOffCents: 106000 });
  const { thisCents } = summarize(expenses, new Date(2026, 8, 1));
  assert.equal(split.everydayCents + split.commitmentCents + split.oneOffCents, thisCents);
});

test("a part-month of history is never one of the full months", () => {
  const started = (date) => [entry({ date }), entry({ date: "2026-11-02" })];
  const keys = (rows, month) => fullMonthsBefore(rows, month).map((m) => m.key);

  // history began mid-July: November compares against August to October
  assert.deepEqual(keys(started("2026-07-14"), new Date(2026, 10, 1)), ["2026-08", "2026-09", "2026-10"]);
  // October only has two full months before it
  assert.deepEqual(keys(started("2026-07-14"), new Date(2026, 9, 1)), ["2026-08", "2026-09"]);
  // August has none, since July is the part-month
  assert.deepEqual(keys(started("2026-07-14"), new Date(2026, 7, 1)), []);
  // history that began on the 1st counts its first month
  assert.deepEqual(keys(started("2026-07-01"), new Date(2026, 7, 1)), ["2026-07"]);
  // no history at all
  assert.deepEqual(fullMonthsBefore([], new Date(2026, 7, 1)), []);
});

test("full months don't care what order the rows arrive in", () => {
  const newestFirst = [entry({ date: "2026-10-02" }), entry({ date: "2026-08-20" })];
  const oldestFirst = [...newestFirst].reverse();
  const month = new Date(2026, 10, 1);
  assert.deepEqual(
    fullMonthsBefore(newestFirst, month).map((m) => m.key),
    fullMonthsBefore(oldestFirst, month).map((m) => m.key),
  );
});

test("the comparison averages Everyday only, over up to three full months", () => {
  const expenses = [
    entry({ amount: "5.00", date: "2026-07-14" }), // part-month: left out
    entry({ amount: "100.00", date: "2026-08-10" }),
    entry({ amount: "200.00", date: "2026-09-10" }),
    entry({ amount: "400.00", date: "2026-09-11", recurring_id: 4 }), // commitment: left out
    entry({ amount: "900.00", date: "2026-09-12", categories: cat("lumpy") }), // one-off: left out
    entry({ amount: "300.00", date: "2026-10-10", categories: cat("everyday", true) }), // not counted
    entry({ amount: "30.00", date: "2026-11-02" }),
  ];
  const { months, averageCents } = everydayComparison(expenses, new Date(2026, 10, 1));
  assert.deepEqual(months.map((m) => [m.key, m.cents]), [
    ["2026-08", 10000],
    ["2026-09", 20000],
    ["2026-10", 0], // a whole month with nothing counted is still a month
  ]);
  assert.equal(averageCents, 10000);
});

test("the comparison rounds to whole cents and has nothing to say without a full month", () => {
  const expenses = [
    entry({ amount: "10.00", date: "2026-08-01" }),
    entry({ amount: "10.00", date: "2026-09-01" }),
    entry({ amount: "10.01", date: "2026-10-01" }),
  ];
  assert.equal(everydayComparison(expenses, new Date(2026, 10, 1)).averageCents, 1000);
  const none = everydayComparison([entry({ date: "2026-08-20" })], new Date(2026, 7, 1));
  assert.deepEqual(none, { months: [], averageCents: null });
});
