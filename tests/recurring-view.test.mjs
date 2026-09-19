import test from "node:test";
import assert from "node:assert/strict";
import {
  nextDue,
  dueItems,
  upcomingItems,
  monthlyEquivalentCents,
  commitmentTotals,
  remaining,
  daysLate,
} from "../js/recurring-view.js";

const item = (over = {}) => ({
  id: 1,
  name: "Spotify",
  amount: "11.98",
  cadence: "monthly",
  anchor_day: 1,
  next_due: "2026-09-01",
  end_date: null,
  active: true,
  categories: { excluded_from_totals: false },
  ...over,
});

test("nextDue steps by cadence", () => {
  assert.equal(nextDue("2026-09-01", "monthly", 1), "2026-10-01");
  assert.equal(nextDue("2026-09-18", "quarterly", 18), "2026-12-18");
  assert.equal(nextDue("2026-09-20", "yearly", 20), "2027-09-20");
});

test("nextDue re-anchors instead of drifting", () => {
  // the bug this prevents: stepping from the PREVIOUS due date would
  // pin a 31st item to the 28th forever after one February
  assert.equal(nextDue("2027-01-31", "monthly", 31), "2027-02-28");
  assert.equal(nextDue("2027-02-28", "monthly", 31), "2027-03-31", "returns to the anchor");
  assert.equal(nextDue("2027-03-31", "monthly", 31), "2027-04-30");
  // leap year
  assert.equal(nextDue("2028-01-31", "monthly", 31), "2028-02-29");
  // a yearly item anchored on 29 Feb lands on the 28th in common years
  assert.equal(nextDue("2028-02-29", "yearly", 29), "2029-02-28");
});

test("dueItems returns the backlog oldest first, inactive excluded", () => {
  const registry = [
    item({ id: 1, next_due: "2026-09-15" }),
    item({ id: 2, next_due: "2026-09-01" }),
    item({ id: 3, next_due: "2026-10-05" }),
    item({ id: 4, next_due: null, active: false }),
  ];
  const due = dueItems(registry, "2026-09-18");
  assert.deepEqual(due.map((r) => r.id), [2, 1], "oldest first; future and stopped left out");
  // due today counts as due
  assert.equal(dueItems([item({ next_due: "2026-09-18" })], "2026-09-18").length, 1);
});

test("upcomingItems looks forward only", () => {
  const registry = [
    item({ id: 1, next_due: "2026-09-01" }),
    item({ id: 2, next_due: "2026-09-20" }),
    item({ id: 3, next_due: "2026-10-05" }),
    item({ id: 4, next_due: "2026-11-05" }),
  ];
  assert.deepEqual(upcomingItems(registry, "2026-09-18").map((r) => r.id), [2, 3]);
});

test("monthlyEquivalentCents amortises for the registry view only", () => {
  assert.equal(monthlyEquivalentCents(item({ amount: "11.98" })), 1198);
  assert.equal(monthlyEquivalentCents(item({ amount: "186.40", cadence: "yearly" })), 1553);
  assert.equal(monthlyEquivalentCents(item({ amount: "285.00", cadence: "quarterly" })), 9500);
});

test("commitmentTotals splits spending from excluded categories", () => {
  const registry = [
    item({ amount: "11.98" }),
    item({ amount: "285.00", cadence: "quarterly" }),
    item({
      amount: "2000.00",
      categories: { excluded_from_totals: true },
    }),
    item({ amount: "999.00", active: false, next_due: null }),
  ];
  const t = commitmentTotals(registry);
  assert.equal(t.spendingCents, 1198 + 9500);
  assert.equal(t.excludedCents, 200000);
  assert.equal(t.totalCents, 1198 + 9500 + 200000);
  assert.ok(!String(t.totalCents).includes("."), "integer cents, no float drift");
});

test("remaining counts the finite tail of a commitment", () => {
  const ilp = item({
    amount: "2000.00",
    cadence: "monthly",
    anchor_day: 15,
    next_due: "2026-09-15",
    end_date: "2027-08-15",
  });
  const left = remaining(ilp);
  assert.equal(left.payments, 12, "this one plus eleven more");
  assert.equal(left.cents, 12 * 200000);

  assert.equal(remaining(item()), null, "no end date means no runway");
  assert.equal(remaining(item({ active: false, next_due: null })), null);

  // the final payment: one left, and it is the one already due
  const last = item({ next_due: "2026-09-01", end_date: "2026-09-30", amount: "10.00" });
  assert.equal(remaining(last).payments, 1);
});

test("daysLate", () => {
  assert.equal(daysLate("2026-09-01", "2026-09-18"), 17);
  assert.equal(daysLate("2026-09-18", "2026-09-18"), 0);
});
