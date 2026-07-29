import test from "node:test";
import assert from "node:assert/strict";
import { ledgerView } from "../js/ledger-view.js";

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
