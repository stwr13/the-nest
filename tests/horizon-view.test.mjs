import test from "node:test";
import assert from "node:assert/strict";
import { horizon, addDays, upcomingChargeCents } from "../js/horizon-view.js";

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

test("upcomingChargeCents totals only the charges", () => {
  const groups = horizon(sources, TODAY);
  assert.equal(upcomingChargeCents(groups), 28500 + 18640);
  assert.equal(upcomingChargeCents([]), 0);
});

test("an empty household produces no groups, not an error", () => {
  assert.deepEqual(horizon({}, TODAY), []);
});
