import test from "node:test";
import assert from "node:assert/strict";
import { horizon, addDays, endOfMonth, upcomingCharges, dayList, isMonthlyCharge } from "../js/horizon-view.js";

const TODAY = "2026-09-19";

const sources = {
  todos: [
    { id: 1, list: "todo", body: "Call the plumber", due_date: "2026-09-22", urgent: false, done_at: null },
    { id: 2, list: "todo", body: "Pay season parking", due_date: "2026-09-25", urgent: true, done_at: null },
    { id: 3, list: "todo", body: "Already handled", due_date: "2026-09-21", urgent: false, done_at: "2026-09-18" },
    { id: 4, list: "todo", body: "No date on this one", due_date: null, urgent: false, done_at: null },
    { id: 5, list: "shopping", body: "Milk", due_date: "2026-09-20", urgent: false, done_at: null },
    { id: 6, list: "wish", body: "That ramen place", due_date: "2026-09-20", urgent: false, done_at: null },
    { id: 7, list: "todo", body: "Overdue chore", due_date: "2026-09-10", urgent: false, done_at: null },
    { id: 8, list: "todo", body: "Far future", due_date: "2027-01-01", urgent: false, done_at: null },
  ],
  recurring: [
    { id: 1, name: "MCST maintenance", amount: "285.00", next_due: "2026-09-19", active: true, paid_by: "Shawn" },
    { id: 2, name: "Great Eastern premium", amount: "186.40", next_due: "2026-09-20", active: true, paid_by: "Claire" },
    { id: 3, name: "Stopped thing", amount: "9.00", next_due: null, active: false, paid_by: "Shawn" },
  ],
  events: [
    { id: 1, title: "Dinner at Claire's parents", date: "2026-09-20", at_time: "19:00", note: null, author: "Claire" },
    { id: 2, title: "Sarah's wedding", date: "2026-09-20", at_time: null, note: "Shangri-La", author: "Shawn" },
    { id: 3, title: "Brunch", date: "2026-09-20", at_time: "11:00", note: null, author: "Shawn" },
  ],
};

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-09-19", 30), "2026-10-19");
  assert.equal(addDays("2026-12-25", 10), "2027-01-04");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("horizon merges the three sources into forward-looking days", () => {
  const groups = horizon(sources, TODAY);
  assert.deepEqual(groups.map((g) => g.date), ["2026-09-19", "2026-09-20", "2026-09-22", "2026-09-25"]);

  // today holds only the charge due today
  assert.deepEqual(groups[0].items.map((i) => i.label), ["MCST maintenance"]);
});

test("a day reads as when-then-what: timed events, all-day, charges, chores", () => {
  const [, secondDay] = horizon(sources, TODAY);
  assert.deepEqual(secondDay.items.map((i) => i.label), [
    "Brunch", // 11:00
    "Dinner at Claire's parents", // 19:00
    "Sarah's wedding", // all-day event
    "Great Eastern premium", // charge
  ]);
});

test("what is deliberately left out", () => {
  const labels = horizon(sources, TODAY).flatMap((g) => g.items.map((i) => i.label));
  assert.ok(!labels.includes("Already handled"), "done to-dos");
  assert.ok(!labels.includes("No date on this one"), "undated to-dos");
  assert.ok(!labels.includes("Milk"), "shopping items are undated by nature");
  assert.ok(!labels.includes("That ramen place"), "wishes are not obligations");
  assert.ok(!labels.includes("Overdue chore"), "overdue belongs to the To-dos tab, not to 'what's coming'");
  assert.ok(!labels.includes("Far future"), "outside the 30-day window");
  assert.ok(!labels.includes("Stopped thing"), "stopped commitments");
});

test("the window is honoured at both edges", () => {
  const edge = {
    todos: [],
    recurring: [],
    events: [
      { id: 1, title: "Last day in", date: addDays(TODAY, 30), at_time: null, author: "Shawn" },
      { id: 2, title: "One day out", date: addDays(TODAY, 31), at_time: null, author: "Shawn" },
      { id: 3, title: "Today counts", date: TODAY, at_time: null, author: "Shawn" },
    ],
  };
  const labels = horizon(edge, TODAY).flatMap((g) => g.items.map((i) => i.label));
  assert.deepEqual(labels, ["Today counts", "Last day in"]);
});

test("endOfMonth", () => {
  assert.equal(endOfMonth("2026-09-19"), "2026-09-30");
  assert.equal(endOfMonth("2027-02-03"), "2027-02-28");
  assert.equal(endOfMonth("2028-02-03"), "2028-02-29");
  assert.equal(endOfMonth("2026-12-31"), "2026-12-31");
});

test("upcomingCharges splits at the month boundary, not the window edge", () => {
  const groups = horizon(sources, TODAY);
  const c = upcomingCharges(groups, TODAY);
  assert.equal(c.items.length, 2, "charges only — no chores, no events");
  assert.equal(c.monthCents, 28500 + 18640, "both September charges");
  assert.equal(c.laterCents, 0);

  // the bug this guards: a rolling 30-day window reaches into next
  // month, and a single total would silently mix the two
  const spanning = horizon(
    {
      recurring: [
        { id: 1, name: "This month", amount: "100.00", next_due: "2026-09-25", active: true, paid_by: "Shawn" },
        { id: 2, name: "Next month", amount: "30.00", next_due: "2026-10-02", active: true, paid_by: "Shawn" },
      ],
    },
    TODAY,
  );
  const split = upcomingCharges(spanning, TODAY);
  assert.equal(split.monthCents, 10000);
  assert.equal(split.monthCount, 1);
  assert.equal(split.laterCents, 3000);
  assert.equal(split.laterCount, 1);
});

test("upcomingCharges on an empty horizon", () => {
  const c = upcomingCharges([], TODAY);
  assert.equal(c.monthCents, 0);
  assert.equal(c.laterCents, 0);
  assert.deepEqual(c.items, []);
});

test("an empty household produces no groups, not an error", () => {
  assert.deepEqual(horizon({}, TODAY), []);
});

const charge = (id, cadence, next_due, amount = "50.00") => ({
  id,
  name: `Charge ${id}`,
  amount,
  cadence,
  next_due,
  active: true,
  paid_by: "Shawn",
});

test("the day list drops monthly charges and keeps everything rarer", () => {
  const groups = horizon(
    {
      todos: [{ id: 1, list: "todo", body: "Chore", due_date: "2026-09-22", urgent: false, done_at: null }],
      events: [{ id: 1, title: "Dinner", date: "2026-09-23", at_time: null, note: null, author: "Claire" }],
      recurring: [
        charge(1, "monthly", "2026-09-22"),
        charge(2, "quarterly", "2026-09-24"),
        charge(3, "half-yearly", "2026-09-25"),
        charge(4, "yearly", "2026-09-26"),
        charge(5, "once", "2026-09-27"),
        charge(6, "monthly", "2026-09-28"),
      ],
    },
    TODAY,
  );
  const days = dayList(groups);
  assert.deepEqual(
    days.map((d) => d.date),
    ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"],
    "a day holding only a monthly charge disappears",
  );
  assert.deepEqual(days[0].items.map((i) => i.kind), ["todo"], "a chore stays on a monthly charge's day");
  const labels = days.flatMap((d) => d.items).filter((i) => i.kind === "recurring").map((i) => i.label);
  assert.deepEqual(labels, ["Charge 2", "Charge 3", "Charge 4", "Charge 5"]);
});

// The summary line's figure must stay checkable against its own rows
// (v1.15.1), so the day list change must not touch it.
test("the summary line still counts and lists every charge", () => {
  const groups = horizon(
    { recurring: [charge(1, "monthly", "2026-09-22"), charge(2, "yearly", "2026-09-24")] },
    TODAY,
  );
  const charges = upcomingCharges(groups, TODAY);
  assert.equal(charges.items.length, 2);
  assert.equal(charges.monthCents, 10000);
  assert.equal(charges.items.filter(isMonthlyCharge).length, 1);
});

test("only monthly charges in the window: the day list is empty but the view is not", () => {
  const groups = horizon({ recurring: [charge(1, "monthly", "2026-09-22")] }, TODAY);
  assert.equal(groups.length, 1, "so the empty message stays hidden");
  assert.deepEqual(dayList(groups), []);
});
