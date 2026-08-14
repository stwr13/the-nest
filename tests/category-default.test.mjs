import test from "node:test";
import assert from "node:assert/strict";
import { defaultCategoryId, usageRank } from "../js/category-default.js";

const SHAWN = "uuid-shawn";
const CLAIRE = "uuid-claire";
const TODAY = "2026-08-12";

const e = (date, category_id, created_by = SHAWN) => ({ date, category_id, created_by });

test("picks the user's most-used category in the last 60 days", () => {
  const expenses = [
    e("2026-08-10", 2),
    e("2026-08-09", 2),
    e("2026-08-08", 5),
    e("2026-08-07", 2),
  ];
  assert.equal(defaultCategoryId(expenses, SHAWN, TODAY), 2);
});

test("per person: the other user's entries don't count", () => {
  const expenses = [
    e("2026-08-10", 2, CLAIRE),
    e("2026-08-09", 2, CLAIRE),
    e("2026-08-08", 5, SHAWN),
  ];
  assert.equal(defaultCategoryId(expenses, SHAWN, TODAY), 5);
  assert.equal(defaultCategoryId(expenses, CLAIRE, TODAY), 2);
});

test("falls back to all-time when nothing recent, null with no history", () => {
  const old = [e("2026-01-05", 7), e("2026-01-04", 7), e("2026-01-03", 1)];
  assert.equal(defaultCategoryId(old, SHAWN, TODAY), 7);
  assert.equal(defaultCategoryId(old, CLAIRE, TODAY), null);
  assert.equal(defaultCategoryId([], SHAWN, TODAY), null);
});

test("recent habit beats all-time habit", () => {
  const expenses = [
    // last 60 days: category 9 twice
    e("2026-08-01", 9),
    e("2026-07-20", 9),
    // ancient: category 1 five times
    ...Array.from({ length: 5 }, (_, i) => e(`2026-01-0${i + 1}`, 1)),
  ];
  assert.equal(defaultCategoryId(expenses, SHAWN, TODAY), 9);
});

test("usageRank: recent frequency first, all-time as tiebreak, per person, unused absent", () => {
  const ex = (date, card_id, created_by = SHAWN) => ({ date, card_id, created_by });
  const expenses = [
    ex("2026-08-10", 5),
    ex("2026-08-09", 5),
    ex("2026-08-08", 2),
    ex("2026-01-05", 7), // ancient heavy use
    ex("2026-01-04", 7),
    ex("2026-01-03", 7),
    ex("2026-08-07", 9, CLAIRE), // not Shawn's
  ];
  const rank = usageRank(expenses, SHAWN, TODAY, (e) => e.card_id);
  assert.deepEqual([...rank.entries()], [[5, 0], [2, 1], [7, 2]]);
  assert.equal(rank.has(9), false);
});

test("tie resolves to the category appearing first (newest-first fetch order)", () => {
  const expenses = [e("2026-08-10", 3), e("2026-08-09", 8), e("2026-08-08", 8), e("2026-08-07", 3)];
  assert.equal(defaultCategoryId(expenses, SHAWN, TODAY), 3);
});
