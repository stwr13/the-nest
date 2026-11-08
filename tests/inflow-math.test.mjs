import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  monthInflows,
  setAsideOut,
  inflowTitle,
  inflowShowsKind,
  inflowFields,
} from "../js/inflow-math.js";

// sample figures only — the repo is public
const inflow = (over = {}) => ({
  id: 1,
  amount: "100.00",
  date: "2026-11-10",
  whose: "Both",
  kind: "other",
  note: null,
  ...over,
});

test("monthInflows sums the month only, split into Salary and Other", () => {
  const rows = [
    inflow({ id: 1, amount: "1000.10", kind: "salary", whose: "Shawn", date: "2026-11-25" }),
    inflow({ id: 2, amount: "800.20", kind: "salary", whose: "Claire", date: "2026-11-28" }),
    inflow({ id: 3, amount: "50.30", kind: "other", date: "2026-11-12" }),
    inflow({ id: 4, amount: "999.00", kind: "salary", date: "2026-10-25" }),
  ];
  const month = monthInflows(rows, "2026-11");
  assert.equal(month.salaryCents, 180030);
  assert.equal(month.otherCents, 5030);
  assert.equal(month.inCents, 185060);
  assert.deepEqual(month.rows.map((r) => r.id), [2, 1, 3]);
});

test("monthInflows: salary rows come before other rows, newest first in each", () => {
  const rows = [
    inflow({ id: 1, kind: "other", date: "2026-11-03" }),
    inflow({ id: 2, kind: "salary", date: "2026-11-01" }),
    inflow({ id: 3, kind: "other", date: "2026-11-20" }),
    inflow({ id: 4, kind: "other", date: "2026-11-20" }),
  ];
  assert.deepEqual(monthInflows(rows, "2026-11").rows.map((r) => r.id), [2, 4, 3, 1]);
});

test("monthInflows of an empty month is zero, with no rows", () => {
  const month = monthInflows([inflow({ date: "2026-10-01" })], "2026-11");
  assert.equal(month.inCents, 0);
  assert.deepEqual(month.rows, []);
});

test("sums are exact in cents, with no float drift", () => {
  const rows = [inflow({ amount: "0.10" }), inflow({ amount: "0.20" })];
  assert.equal(monthInflows(rows, "2026-11").inCents, 30);
});

test("no per-person total: the result carries only Salary, Other and In", () => {
  const month = monthInflows([inflow({ whose: "Shawn" }), inflow({ whose: "Claire" })], "2026-11");
  assert.deepEqual(Object.keys(month).sort(), ["inCents", "otherCents", "rows", "salaryCents"]);
  const source = readFileSync(new URL("../js/inflow-math.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /whose\s*===|\.whose\]/, "nothing groups or sums by whose");
});

test("setAsideOut sums Investment & Insurance by kind, never by name", () => {
  const invest = { name: "Investment & Insurance", kind: "invest" };
  const expenses = [
    { amount: "300.00", date: "2026-11-02", categories: invest },
    { amount: "20.50", date: "2026-11-09", categories: invest },
    { amount: "999.00", date: "2026-10-02", categories: invest },
    { amount: "80.00", date: "2026-11-02", categories: { name: "Investment & Insurance look-alike", kind: "everyday" } },
  ];
  assert.deepEqual(setAsideOut(expenses, "2026-11"), { cents: 32050, label: "Investment & Insurance" });
});

test("setAsideOut with nothing set aside is zero", () => {
  assert.equal(setAsideOut([], "2026-11").cents, 0);
});

test("a row's title is its note, otherwise its type", () => {
  assert.equal(inflowTitle(inflow({ kind: "salary" })), "Salary");
  assert.equal(inflowTitle(inflow({ kind: "other", note: "  " })), "Other");
  assert.equal(inflowTitle(inflow({ note: "Dividend" })), "Dividend");
  assert.equal(inflowShowsKind(inflow({ note: "Dividend" })), true);
  assert.equal(inflowShowsKind(inflow({ kind: "salary" })), false);
});

test("inflowFields accepts a full row and trims the note", () => {
  const { error, fields } = inflowFields({
    amount: 12.345,
    date: "2026-11-08",
    whose: "Both",
    kind: "other",
    note: "  Blessing ",
  });
  assert.equal(error, undefined);
  assert.deepEqual(fields, { amount: 12.35, date: "2026-11-08", whose: "Both", kind: "other", note: "Blessing" });
});

test("inflowFields: an empty note saves as null", () => {
  const { fields } = inflowFields({ amount: 5, date: "2026-11-08", whose: "Shawn", kind: "salary", note: "" });
  assert.equal(fields.note, null);
});

test("inflowFields refuses what the table would refuse", () => {
  const ok = { amount: 5, date: "2026-11-08", whose: "Claire", kind: "salary", note: "" };
  assert.ok(inflowFields({ ...ok, amount: null }).error);
  assert.ok(inflowFields({ ...ok, amount: 0 }).error);
  assert.ok(inflowFields({ ...ok, amount: -3 }).error);
  assert.ok(inflowFields({ ...ok, date: "" }).error);
  assert.ok(inflowFields({ ...ok, whose: "Someone" }).error);
  assert.ok(inflowFields({ ...ok, kind: "bonus" }).error);
  assert.ok(inflowFields({ ...ok, note: "x".repeat(201) }).error);
});
