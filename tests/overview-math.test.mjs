import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyEntry,
  monthSplit,
  fullMonthsBefore,
  everydayComparison,
  typicalMonth,
  yearAhead,
  oneOffs,
  oneOffsSince,
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

test("classify: set aside wins over a recurring link", () => {
  // the order is the whole point: a confirmed premium has a recurring_id
  assert.equal(classifyEntry(entry({ categories: cat("invest", true), recurring_id: 7 })), "set-aside");
});

test("classify: the unused 'give' kind reads as everyday", () => {
  // since v1.20.1 every gift and tithe counts as spending
  assert.equal(classifyEntry(entry({ categories: cat("give", true), recurring_id: 7 })), "commitment");
  assert.equal(classifyEntry(entry({ categories: cat("give") })), "everyday");
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

test("classify: set aside ignores the one-off threshold", () => {
  assert.equal(classifyEntry(entry({ categories: cat("invest", true), amount: "800.00" })), "set-aside");
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

// Either of them can rename a category at any time, so the words on it
// must change nothing.
test("nothing classifies by a category name or a note", () => {
  const renamed = (name, kind) => ({ ...cat(kind), name });
  assert.equal(classifyEntry(entry({ categories: renamed("Travel", "everyday"), note: "flight" })), "everyday");
  assert.equal(classifyEntry(entry({ categories: renamed("Tithes", "everyday"), note: "tithe" })), "everyday");
  assert.equal(classifyEntry(entry({ categories: renamed("Holidays", "lumpy") })), "one-off");
  assert.equal(classifyEntry(entry({ categories: renamed("Insurance", "invest") })), "set-aside");
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

// ── a typical month ──────────────────────────────────────────────────

const NOW = new Date(2026, 10, 7); // 7 November 2026

const named = (id, name, kind = "everyday", excluded = false) => ({
  id,
  name,
  icon: null,
  excluded_from_totals: excluded,
  kind,
});
const HOME = named(1, "Home");
const TRIPS = named(2, "Trips", "lumpy");
const SAVINGS = named(3, "Savings", "invest", true);
const GIVING = named(4, "Giving", "give", true); // a kind nothing uses since v1.20.1
const FOOD = named(5, "Food");
const LEFT_OUT = named(6, "Left out", "everyday", true);

const item = (over = {}) => ({
  id: 1,
  name: "An item",
  amount: "100.00",
  cadence: "monthly",
  anchor_day: 10,
  next_due: "2026-11-10",
  end_date: null,
  last_confirmed: null,
  active: true,
  category_id: 1,
  categories: HOME,
  ...over,
});

const inCat = (category) => ({ category_id: category.id, categories: category });

test("a typical month has three layers from the right sources", () => {
  const registry = [
    item({ id: 1, amount: "1000.00" }),
    item({ id: 2, amount: "600.00", cadence: "quarterly", ...inCat(HOME) }),
    item({ id: 3, amount: "240.00", cadence: "yearly", ...inCat(TRIPS) }),
    item({ id: 4, amount: "500.00", ...inCat(SAVINGS) }),
    item({ id: 5, amount: "300.00", ...inCat(GIVING) }),
    item({ id: 6, amount: "150.00", ...inCat(GIVING) }),
    // none of these belong in a typical month
    item({ id: 7, amount: "9000.00", cadence: "once", end_date: "2027-01-10", ...inCat(SAVINGS) }),
    item({ id: 8, amount: "700.00", active: false, next_due: null }),
  ];
  const ledger = [
    entry({ amount: "5.00", date: "2026-07-14", ...inCat(FOOD) }), // part-month: left out
    entry({ amount: "90.00", date: "2026-08-10", ...inCat(FOOD) }),
    entry({ amount: "60.00", date: "2026-09-10", ...inCat(FOOD) }),
    entry({ amount: "30.00", date: "2026-10-10", ...inCat(HOME) }),
    entry({ amount: "1000.00", date: "2026-10-11", ...inCat(FOOD) }), // big: a one-off
    entry({ amount: "40.00", date: "2026-10-12", ...inCat(TRIPS) }), // lumpy: a one-off
    entry({ amount: "1000.00", date: "2026-10-13", recurring_id: 1, ...inCat(HOME) }), // commitment
    entry({ amount: "12.00", date: "2026-10-14", ...inCat(LEFT_OUT) }), // not in the totals
    entry({ amount: "300.00", date: "2026-10-15", recurring_id: 5, ...inCat(GIVING) }), // commitment
    entry({ amount: "77.00", date: "2026-11-02", ...inCat(FOOD) }), // this month: left out
  ];
  const typical = typicalMonth(registry, ledger, NOW);

  assert.deepEqual(typical.months.map((m) => m.key), ["2026-08", "2026-09", "2026-10"]);
  // the two items in the unused 'give' kind are bills like any other
  assert.equal(typical.bills.cents, 100000 + 20000 + 2000 + 30000 + 15000);
  assert.equal(typical.everyday.cents, 6000); // (90 + 60 + 30) / 3
  assert.equal(typical.setAside.cents, 50000);
  assert.equal(typical.totalCents, 167000 + 6000 + 50000);
  assert.equal(typical.headlineDollars, 2200, "nearest hundred dollars");
  assert.deepEqual(Object.keys(typical).sort(), [
    "bills", "everyday", "headlineDollars", "months", "setAside", "totalCents",
  ]);
});

test("the headline rounds to the nearest hundred", () => {
  const at = (amount) => typicalMonth([item({ amount })], [], NOW).headlineDollars;
  assert.equal(at("1249.99"), 1200);
  assert.equal(at("1250.00"), 1300);
});

test("bills group by category, biggest first, each with its items", () => {
  const registry = [
    item({ id: 1, name: "Small", amount: "10.00", ...inCat(FOOD) }),
    item({ id: 2, name: "Quarterly", amount: "600.00", cadence: "quarterly" }),
    item({ id: 3, name: "Monthly", amount: "300.00" }),
  ];
  const { groups } = typicalMonth(registry, [], NOW).bills;
  assert.deepEqual(groups.map((g) => [g.name, g.cents]), [
    ["Home", 50000],
    ["Food", 1000],
  ]);
  assert.deepEqual(groups[0].items.map((i) => [i.name, i.monthlyCents]), [
    ["Monthly", 30000],
    ["Quarterly", 20000],
  ]);
});

test("everyday breaks down by category over the same months", () => {
  const ledger = [
    entry({ amount: "90.00", date: "2026-09-10", ...inCat(FOOD) }),
    entry({ amount: "30.00", date: "2026-10-10", ...inCat(FOOD) }),
    entry({ amount: "10.00", date: "2026-10-11", ...inCat(HOME) }),
  ];
  const { everyday, months } = typicalMonth([], ledger, NOW);
  assert.equal(months.length, 1, "September is the part-month here, so only October is whole");
  assert.deepEqual(everyday.groups, [
    { label: "Food", cents: 3000 },
    { label: "Home", cents: 1000 },
  ]);
});

test("bills are one line per category, never per person", () => {
  const registry = [
    item({ id: 1, name: "One person's item", amount: "300.00", paid_by: "Shawn" }),
    item({ id: 2, name: "The other's item", amount: "150.00", paid_by: "Claire" }),
  ];
  const { groups } = typicalMonth(registry, [], NOW).bills;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "Home");
  assert.equal(groups[0].cents, 45000);
});

test("a category left out of the totals stays out of everyday", () => {
  const ledger = [
    entry({ amount: "1.00", date: "2026-08-01", ...inCat(FOOD) }),
    entry({ amount: "30.00", date: "2026-09-10", ...inCat(LEFT_OUT) }),
  ];
  const typical = typicalMonth([], ledger, new Date(2026, 9, 1));
  assert.equal(typical.everyday.cents, Math.round(100 / 2));
});

test("no full months yet: the averages are zero rather than broken", () => {
  const typical = typicalMonth([item()], [entry({ date: "2026-11-02" })], NOW);
  assert.equal(typical.everyday.cents, 0);
  assert.equal(typical.bills.cents, 10000);
  assert.deepEqual(typical.months, []);
});

// ── year ahead ───────────────────────────────────────────────────────

const monthOf = (year, key) => year.months.find((m) => m.key === key);

test("twelve months from the current one", () => {
  const { months } = yearAhead([], NOW);
  assert.equal(months.length, 12);
  assert.equal(months[0].key, "2026-11");
  assert.equal(months[11].key, "2027-10");
});

test("a monthly item counts in every month, including the current one once charged", () => {
  const charged = item({ next_due: "2026-12-10", last_confirmed: "2026-11-10" });
  const year = yearAhead([charged], NOW);
  for (const month of year.months) {
    assert.equal(month.regularCents, 10000, month.key);
    assert.equal(month.regularCount, 1, month.key);
    assert.equal(month.lumpCents, 0, month.key);
  }
});

test("an overdue monthly item isn't counted twice in the current month", () => {
  const overdue = item({ next_due: "2026-10-10" });
  assert.equal(monthOf(yearAhead([overdue], NOW), "2026-11").regularCents, 10000);
});

test("a monthly item that hasn't started yet doesn't count before it starts", () => {
  const later = item({ next_due: "2027-02-10" });
  const year = yearAhead([later], NOW);
  assert.equal(monthOf(year, "2026-11").regularCents, 0);
  assert.equal(monthOf(year, "2027-01").regularCents, 0);
  assert.equal(monthOf(year, "2027-02").regularCents, 10000);
});

test("a monthly item stops counting after its end date", () => {
  const ending = item({ next_due: "2026-11-10", end_date: "2027-01-15" });
  const year = yearAhead([ending], NOW);
  assert.equal(monthOf(year, "2027-01").regularCents, 10000);
  assert.equal(monthOf(year, "2027-02").regularCents, 0);
});

test("rarer items land on their own dates and nowhere else", () => {
  const year = yearAhead(
    [
      item({ name: "Quarterly", amount: "300.00", cadence: "quarterly", anchor_day: 4, next_due: "2027-01-04" }),
      item({ name: "Half-yearly", amount: "120.00", cadence: "half-yearly", anchor_day: 12, next_due: "2026-11-12" }),
      item({ name: "Yearly", amount: "900.00", cadence: "yearly", anchor_day: 7, next_due: "2027-08-07" }),
      item({ name: "One time", amount: "5000.00", cadence: "once", anchor_day: 3, next_due: "2027-08-03", end_date: "2027-08-03" }),
    ],
    NOW,
  );
  const lumps = (key) => monthOf(year, key).lumps.map((l) => l.name);
  assert.deepEqual(lumps("2026-11"), ["Half-yearly"]);
  assert.deepEqual(lumps("2027-01"), ["Quarterly"]);
  assert.deepEqual(lumps("2027-04"), ["Quarterly"]);
  assert.deepEqual(lumps("2027-05"), ["Half-yearly"]);
  assert.deepEqual(lumps("2027-08"), ["One time", "Yearly"], "biggest first");
  assert.deepEqual(lumps("2027-10"), ["Quarterly"]);
  assert.deepEqual(lumps("2027-09"), []);
  assert.equal(year.months.reduce((n, m) => n + m.lumps.filter((l) => l.name === "One time").length, 0), 1);
});

test("a rare item confirmed this month still counts this month", () => {
  const paid = item({ amount: "240.00", cadence: "yearly", next_due: "2027-11-10", last_confirmed: "2026-11-10" });
  assert.equal(monthOf(yearAhead([paid], NOW), "2026-11").lumpCents, 24000);

  const lastPayment = item({ amount: "240.00", cadence: "once", active: false, next_due: null, end_date: "2026-11-10", last_confirmed: "2026-11-10" });
  assert.equal(monthOf(yearAhead([lastPayment], NOW), "2026-11").lumpCents, 24000);
});

test("stopped items don't land", () => {
  const stopped = item({ active: false, next_due: null, last_confirmed: "2026-10-10" });
  for (const month of yearAhead([stopped], NOW).months) assert.equal(month.totalCents, 0);
});

test("the heaviest month is the biggest total, the earliest on a tie", () => {
  const year = yearAhead(
    [
      item({ amount: "100.00" }),
      item({ name: "A", amount: "500.00", cadence: "yearly", next_due: "2027-03-10" }),
      item({ name: "B", amount: "500.00", cadence: "yearly", next_due: "2027-06-10" }),
    ],
    NOW,
  );
  assert.equal(year.heaviest.key, "2027-03");
  assert.equal(year.heaviest.lumpCents, 50000);
  assert.equal(year.heaviest.regularCents, 10000);
});

// ── big one-offs ─────────────────────────────────────────────────────

test("one-offs list biggest first with a total and no average", () => {
  const result = oneOffs([
    entry({ note: "Small trip", amount: "80.00", categories: cat("lumpy") }),
    entry({ note: "Big purchase", amount: "450.00" }),
    entry({ note: "Group dinner", amount: "96.25", card_charged: "385.00" }),
    entry({ note: "Premium", amount: "900.00", recurring_id: 3 }),
    entry({ note: "Giving", amount: "800.00", categories: cat("give", true) }),
    entry({ note: "Set aside", amount: "800.00", categories: cat("invest", true) }),
    entry({ note: "Not counted", amount: "800.00", categories: cat("everyday", true) }),
  ]);
  assert.deepEqual(result.items.map((e) => e.note), ["Big purchase", "Small trip"]);
  assert.equal(result.totalCents, 53000);
  assert.deepEqual(Object.keys(result).sort(), ["items", "totalCents"], "no monthly average");
});

test("the look-back is twelve months, and survives a leap day", () => {
  assert.equal(oneOffsSince("2026-11-07"), "2025-11-07");
  assert.equal(oneOffsSince("2028-02-29"), "2027-03-01");
});

// Between the two of them money is joint, so the screen has no per-person
// anything. paid_by stays in the table only because Confirm needs it.
test("the Overview screen never reads who paid", () => {
  const main = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");
  const section = (from, to) => main.slice(main.indexOf(from), main.indexOf(to));
  const overview = section("// ── Overview (v1.20)", "// ── Coming up: the household horizon");
  assert.ok(overview.length > 1000, "found the Overview section");
  assert.ok(!overview.includes("paid_by"));
  const registryRow = section("function registryRow(item)", "// Tucked until asked for");
  assert.ok(registryRow.length > 500, "found the registry row");
  assert.ok(!registryRow.includes("paid_by"));
});
