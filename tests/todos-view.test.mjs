import test from "node:test";
import assert from "node:assert/strict";
import { todosView } from "../js/todos-view.js";

const t = (id, created_at, due_date = null, done_at = null, urgent = false) => ({
  id,
  created_at,
  due_date,
  done_at,
  urgent,
});

const TODAY = "2026-08-12";

test("open items sort due-first, dateless last, ties oldest-added first", () => {
  const { open } = todosView(
    [
      t(1, "2026-08-01T10:00:00Z"), // dateless, added first
      t(2, "2026-08-02T10:00:00Z", "2026-08-20"),
      t(3, "2026-08-03T10:00:00Z", "2026-08-14"),
      t(4, "2026-08-04T10:00:00Z"), // dateless, added later
      t(5, "2026-08-05T10:00:00Z", "2026-08-14"), // same due as 3, newer
    ],
    TODAY,
  );
  assert.deepEqual(
    open.map((x) => x.id),
    [3, 5, 2, 1, 4],
  );
});

test("overdue is strictly before today; due today is not overdue", () => {
  const { open } = todosView(
    [
      t(1, "2026-08-01T10:00:00Z", "2026-08-11"),
      t(2, "2026-08-01T11:00:00Z", "2026-08-12"),
      t(3, "2026-08-01T12:00:00Z"),
    ],
    TODAY,
  );
  assert.deepEqual(
    open.map((x) => [x.id, x.overdue]),
    [
      [1, true],
      [2, false],
      [3, false],
    ],
  );
});

test("done items split out, newest-done-first, and never flagged overdue", () => {
  const { open, done } = todosView(
    [
      t(1, "2026-08-01T10:00:00Z", "2026-08-01", "2026-08-10T09:00:00Z"),
      t(2, "2026-08-02T10:00:00Z", null, "2026-08-11T09:00:00Z"),
      t(3, "2026-08-03T10:00:00Z", "2026-08-30"),
    ],
    TODAY,
  );
  assert.deepEqual(open.map((x) => x.id), [3]);
  assert.deepEqual(done.map((x) => x.id), [2, 1]);
  assert.ok(done.every((x) => x.overdue === undefined));
});

test("empty input yields empty lists", () => {
  assert.deepEqual(todosView([], TODAY), { open: [], done: [] });
});

test("urgent pins above everything — even a dateless urgent beats an overdue dated one", () => {
  const { open } = todosView(
    [
      t(1, "2026-08-01T10:00:00Z", "2026-08-05"), // overdue, not urgent
      t(2, "2026-08-02T10:00:00Z", null, null, true), // dateless urgent
      t(3, "2026-08-03T10:00:00Z", "2026-08-20", null, true), // dated urgent
      t(4, "2026-08-04T10:00:00Z"), // dateless normal
    ],
    TODAY,
  );
  // urgent block first (due-first within it), then the normal block
  assert.deepEqual(open.map((x) => x.id), [3, 2, 1, 4]);
});

test("list split: shopping items stay out of the to-do view and vice versa", () => {
  const rows = [
    { ...t(1, "2026-08-01T10:00:00Z"), list: "todo" },
    { ...t(2, "2026-08-02T10:00:00Z"), list: "shopping" },
    { ...t(3, "2026-08-03T10:00:00Z", null, "2026-08-10T09:00:00Z"), list: "shopping" },
    t(4, "2026-08-04T10:00:00Z"), // no list field: pre-migration row = to-do
  ];
  const todoView = todosView(rows, TODAY);
  const shopView = todosView(rows, TODAY, "shopping");
  assert.deepEqual(todoView.open.map((x) => x.id), [1, 4]);
  assert.deepEqual(shopView.open.map((x) => x.id), [2]);
  assert.deepEqual(shopView.done.map((x) => x.id), [3]);
});

test("rows without an urgent field (pre-migration shape) sort as not urgent", () => {
  const legacy = { id: 9, created_at: "2026-08-01T09:00:00Z", due_date: null, done_at: null };
  const { open } = todosView([legacy, t(2, "2026-08-02T10:00:00Z", null, null, true)], TODAY);
  assert.deepEqual(open.map((x) => x.id), [2, 9]);
});
