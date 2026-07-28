import test from "node:test";
import assert from "node:assert/strict";
import { summarize, categoryLabel } from "../js/dashboard-math.js";

const now = new Date(2026, 6, 29); // July 2026
const cat = (name, icon = null, excluded = false) => ({
  name,
  icon,
  excluded_from_totals: excluded,
});

test("excluded categories stay out of every sum but remain visible", () => {
  const expenses = [
    { amount: "50.00", date: "2026-07-20", categories: cat("Blessing", "🙏", true) },
    { amount: "84.20", date: "2026-07-18", categories: cat("Groceries", "🛒") },
    { amount: "9.90", date: "2026-07-10", categories: cat("Groceries", "🛒") },
    { amount: "70.00", date: "2026-06-15", categories: cat("Blessing", "🙏", true) },
    { amount: "30.00", date: "2026-06-10", categories: cat("Fun", "🎉") },
  ];
  const { thisCents, byCategory, past, excluded } = summarize(expenses, now);
  assert.equal(thisCents, 9410); // 84.20 + 9.90 in cents — no drift, no Blessing
  assert.deepEqual([...byCategory.entries()], [["🛒 Groceries", 9410]]);
  assert.deepEqual([...excluded.entries()], [["🙏 Blessing", 5000]]);
  // June: Fun only — the June Blessing never lands in past-month sums
  assert.equal(past.at(-1).cents, 3000);
});

test("labels combine icon and name; icon optional", () => {
  assert.equal(categoryLabel(cat("Groceries", "🛒")), "🛒 Groceries");
  assert.equal(categoryLabel(cat("Other")), "Other");
});
