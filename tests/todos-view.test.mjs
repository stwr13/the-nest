import test from "node:test";
import assert from "node:assert/strict";
import { todosView } from "../js/todos-view.js";

const t = (id, created_at, due_date = null, done_at = null) => ({
  id,
  created_at,
  due_date,
  done_at,
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
