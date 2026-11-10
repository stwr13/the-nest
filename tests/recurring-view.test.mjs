import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  nextDue,
  dueItems,
  monthlyEquivalentCents,
  remaining,
  daysLate,
  CADENCE_MONTHS,
  CADENCE_LABEL,
  recurringEdit,
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

test("monthlyEquivalentCents amortises for the registry view only", () => {
  assert.equal(monthlyEquivalentCents(item({ amount: "11.98" })), 1198);
  assert.equal(monthlyEquivalentCents(item({ amount: "186.40", cadence: "yearly" })), 1553);
  assert.equal(monthlyEquivalentCents(item({ amount: "285.00", cadence: "quarterly" })), 9500);
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

test("nextDue steps half-yearly and once", () => {
  assert.equal(nextDue("2026-11-12", "half-yearly", 12), "2027-05-12");
  // re-anchors like every other cadence: the 31st, six months on, in February
  assert.equal(nextDue("2027-08-31", "half-yearly", 31), "2028-02-29");
  assert.equal(nextDue("2027-08-03", "once", 3), "2028-08-03");
});

// A row whose cadence has no step gets a null next_due inside
// confirm_recurring, which then breaks active_has_due. The database and
// this file must agree on every cadence, so the test reads the real SQL.
test("every cadence the database allows has the same step here", () => {
  const dir = new URL("../db/migrations/", import.meta.url);
  const newest = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    // the newest file that DEFINES the function, not one that only grants on it
    .filter((f) =>
      readFileSync(new URL(f, dir), "utf8").includes(
        "create or replace function public.recurring_next_due(",
      ),
    )
    .at(-1);
  const sql = readFileSync(new URL(newest, dir), "utf8");
  const steps = {};
  for (const [, cadence, months] of sql.matchAll(/when '([a-z-]+)'\s+then interval '(\d+) months?'/g)) {
    steps[cadence] = Number(months);
  }
  assert.deepEqual(steps, CADENCE_MONTHS);

  const allowed = sql.match(/check \(cadence in \(([^)]+)\)\)/)[1].match(/[a-z-]+/g);
  assert.deepEqual([...allowed].sort(), Object.keys(CADENCE_MONTHS).sort());
});

test("the form only offers cadences the registry knows, each with a label", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const select = html.match(/<select id="rec-cadence"[\s\S]*?<\/select>/)[0];
  const offered = [...select.matchAll(/value="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...offered].sort(), Object.keys(CADENCE_MONTHS).sort());
  for (const cadence of offered) assert.ok(CADENCE_LABEL[cadence], `${cadence} has no label`);
});

test("a one-time charge has no monthly cost", () => {
  const once = item({ amount: "500.00", cadence: "once", next_due: "2027-03-01", end_date: "2027-03-01" });
  assert.equal(monthlyEquivalentCents(once), 0);
});

test("a half-yearly charge spreads over six months", () => {
  assert.equal(monthlyEquivalentCents(item({ amount: "120.00", cadence: "half-yearly" })), 2000);
});

test("remaining counts a one-time charge as one payment", () => {
  const once = item({ amount: "500.00", cadence: "once", next_due: "2027-03-01", end_date: "2027-03-01" });
  assert.deepEqual(remaining(once), { payments: 1, cents: 50000 });
});

const edit = (over = {}) => ({
  name: "Spotify",
  amount: 11.98,
  categoryId: 5,
  nextDueDate: "2026-09-01",
  ...over,
});
const editable = (over = {}) => item({ category_id: 5, ...over });

test("an edit sends only what changed", () => {
  assert.deepEqual(recurringEdit(editable(), edit()), { fields: {} });
  assert.deepEqual(recurringEdit(editable(), edit({ name: "  Music  " })), { fields: { name: "Music" } });
  assert.deepEqual(recurringEdit(editable(), edit({ amount: 12.5 })), { fields: { amount: 12.5 } });
  assert.deepEqual(recurringEdit(editable(), edit({ categoryId: 9 })), { fields: { category_id: 9 } });
});

// An untouched date must stay out of the write: resending it could undo the
// other phone's confirm, and it would pin a 31st item to a short month.
test("a new date moves the anchor, an untouched one leaves both alone", () => {
  const anchored = editable({ anchor_day: 31, next_due: "2027-02-28" });
  const unchanged = recurringEdit(anchored, edit({ name: "Renamed", nextDueDate: "2027-02-28" }));
  assert.deepEqual(unchanged, { fields: { name: "Renamed" } });
  assert.deepEqual(recurringEdit(editable(), edit({ nextDueDate: "2026-09-15" })), {
    fields: { next_due: "2026-09-15", anchor_day: 15 },
  });
});

test("a one-time item's end date follows its due date", () => {
  const once = editable({ cadence: "once", next_due: "2027-03-01", end_date: "2027-03-01" });
  assert.deepEqual(recurringEdit(once, edit({ nextDueDate: "2027-04-09" })), {
    fields: { end_date: "2027-04-09", next_due: "2027-04-09", anchor_day: 9 },
  });
});

test("an edit that can't be saved says why", () => {
  assert.ok(recurringEdit(editable(), edit({ name: "   " })).error);
  assert.ok(recurringEdit(editable(), edit({ amount: null })).error);
  assert.ok(recurringEdit(editable(), edit({ amount: 0 })).error);
  assert.ok(recurringEdit(editable(), edit({ nextDueDate: "" })).error);
  const ending = editable({ end_date: "2026-12-31" });
  assert.ok(recurringEdit(ending, edit({ nextDueDate: "2027-01-01" })).error);
  assert.deepEqual(recurringEdit(ending, edit({ nextDueDate: "2026-12-31" })).fields.next_due, "2026-12-31");
});

