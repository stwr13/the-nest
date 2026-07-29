import test from "node:test";
import assert from "node:assert/strict";
import { ledgerView } from "../js/ledger-view.js";

const e = (id, date, paid_by) => ({ id, date, paid_by });
const expenses = [
  e(5, "2026-07-29", "Shawn"),
  e(4, "2026-07-29", "Claire"),
  e(3, "2026-07-28", "Shawn"),
  e(2, "2026-07-26", "Claire"),
  e(1, "2026-07-26", "Shawn"),
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

test("empty input yields no groups", () => {
  assert.deepEqual(ledgerView([], "all"), []);
  assert.deepEqual(ledgerView(expenses, "Nobody"), []);
});
