import test from "node:test";
import assert from "node:assert/strict";
import { ledgerView, dayTotal, recentDayTotals } from "../js/ledger-view.js";

const e = (id, date, paid_by, category_id = 1) => ({ id, date, paid_by, category_id });
const expenses = [
  e(5, "2026-07-29", "Shawn", 2),
  e(4, "2026-07-29", "Claire", 1),
  e(3, "2026-07-28", "Shawn", 1),
  e(2, "2026-07-26", "Claire", 2),
  e(1, "2026-07-26", "Shawn", 1),
];

test("groups by day, preserving newest-first order", () => {
  const groups = ledgerView(expenses);
  assert.deepEqual(
    groups.map((g) => [g.date, g.items.map((i) => i.id)]),
    [
      ["2026-07-29", [5, 4]],
      ["2026-07-28", [3]],
      ["2026-07-26", [2, 1]],
    ],
  );
});

test("person filter drops the other person's entries and empty days", () => {
  const groups = ledgerView(expenses, "Claire");
  assert.deepEqual(
    groups.map((g) => [g.date, g.items.map((i) => i.id)]),
    [
      ["2026-07-29", [4]],
      ["2026-07-26", [2]],
    ],
  );
});

test("category filter works alone and combined with person", () => {
  // select values arrive as strings — Number() coercion is the contract
  assert.deepEqual(
    ledgerView(expenses, "all", "2").map((g) => [g.date, g.items.map((i) => i.id)]),
    [
      ["2026-07-29", [5]],
      ["2026-07-26", [2]],
    ],
  );
  assert.deepEqual(
    ledgerView(expenses, "Shawn", "1").map((g) => [g.date, g.items.map((i) => i.id)]),
    [
      ["2026-07-28", [3]],
      ["2026-07-26", [1]],
    ],
  );
});

test("empty input yields no groups", () => {
  assert.deepEqual(ledgerView([], "all"), []);
  assert.deepEqual(ledgerView(expenses, "Nobody"), []);
  assert.deepEqual(ledgerView(expenses, "all", "99"), []);
});

test("dayTotal sums counted spending, skips excluded categories", () => {
  const items = [
    { amount: "8.20", categories: { excluded_from_totals: false } },
    { amount: 10, categories: { excluded_from_totals: true } },
    { amount: 1.8, categories: null },
  ];
  assert.equal(dayTotal(items), 10);
});

test("dayTotal is null when nothing counts — header omits the figure", () => {
  assert.equal(dayTotal([]), null);
  assert.equal(dayTotal([{ amount: 50, categories: { excluded_from_totals: true } }]), null);
});

test("recentDayTotals walks calendar days back from the anchor, zero-filling gaps", () => {
  const groups = [
    { date: "2026-08-17", items: [{ amount: 50, categories: null }] },
    { date: "2026-08-15", items: [{ amount: 87.1, categories: null }] },
  ];
  // 08-16 has no group — a quiet day shows as 0, not skipped
  assert.deepEqual(recentDayTotals(groups, "2026-08-17"), [
    { date: "2026-08-16", total: 0 },
    { date: "2026-08-15", total: 87.1 },
  ]);
});

test("recentDayTotals crosses month boundaries and treats excluded-only days as 0", () => {
  const groups = [
    { date: "2026-07-31", items: [{ amount: 20, categories: { excluded_from_totals: true } }] },
  ];
  assert.deepEqual(recentDayTotals(groups, "2026-08-01"), [
    { date: "2026-07-31", total: 0 },
    { date: "2026-07-30", total: 0 },
  ]);
});
