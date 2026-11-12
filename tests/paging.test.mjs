import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchAllPages, PAGE_SIZE } from "../js/paging.js";

// A stand-in for the API: a table of `total` rows that hands back at
// most `cap` rows per request, whatever range is asked for. Records
// every range it was asked for.
function table(total, { cap = PAGE_SIZE, failAtCall = null } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls = [];
  const fetchPage = async (from, to) => {
    calls.push([from, to]);
    if (failAtCall !== null && calls.length === failAtCall) throw new Error("network down");
    return rows.slice(from, Math.min(to + 1, from + cap));
  };
  return { rows, calls, fetchPage };
}

test("the API cap these tests assume is the one the app uses", () => {
  assert.equal(PAGE_SIZE, 1000);
});

test("a ledger under one page takes one request", async () => {
  const t = table(137);
  const all = await fetchAllPages(t.fetchPage);
  assert.equal(all.length, 137);
  assert.deepEqual(t.calls, [[0, 999]]);
});

test("several pages come back whole and in order", async () => {
  const t = table(3400);
  const all = await fetchAllPages(t.fetchPage);
  assert.equal(all.length, 3400);
  assert.deepEqual(all.map((r) => r.id), t.rows.map((r) => r.id));
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999], [3000, 3999]]);
});

test("a short last page ends the load", async () => {
  const t = table(1201);
  const all = await fetchAllPages(t.fetchPage);
  assert.equal(all.length, 1201);
  assert.equal(all.at(-1).id, 1201); // the oldest row is there
  assert.equal(t.calls.length, 2);
});

test("an exact multiple of the page size asks once more and gets nothing", async () => {
  const t = table(2000);
  const all = await fetchAllPages(t.fetchPage);
  assert.equal(all.length, 2000);
  // the third request is how it learns there is no row 2001
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("exactly one full page asks once more", async () => {
  const t = table(1000);
  const all = await fetchAllPages(t.fetchPage);
  assert.equal(all.length, 1000);
  assert.equal(t.calls.length, 2);
});

test("an empty table is an empty ledger, not an error", async () => {
  const t = table(0);
  assert.deepEqual(await fetchAllPages(t.fetchPage), []);
  assert.equal(t.calls.length, 1);
});

test("a failure part-way fails the whole load; no part-ledger comes back", async () => {
  const t = table(2500, { failAtCall: 2 });
  await assert.rejects(fetchAllPages(t.fetchPage), /network down/);
  assert.equal(t.calls.length, 2); // and it stops asking
});

test("a failure on the first page fails the load", async () => {
  const t = table(50, { failAtCall: 1 });
  await assert.rejects(fetchAllPages(t.fetchPage), /network down/);
});

test("a page that is not a list fails the load rather than ending it early", async () => {
  let call = 0;
  const fetchPage = async () => (++call === 1 ? Array.from({ length: 1000 }, (_, i) => ({ id: i })) : null);
  await assert.rejects(fetchAllPages(fetchPage), /incomplete/);
});

test("the page size can be set, and ranges follow it", async () => {
  const t = table(25, { cap: 10 });
  const all = await fetchAllPages(t.fetchPage, { pageSize: 10 });
  assert.equal(all.length, 25);
  assert.deepEqual(t.calls, [[0, 9], [10, 19], [20, 29]]);
});

// The other phone saves an entry between two requests: every row moves
// down one place, so the last row of page one is also the first row of
// page two. Counted twice, it would inflate that month's total.
test("a row repeated across a page boundary is kept once when rows have a key", async () => {
  const newestFirst = Array.from({ length: 15 }, (_, i) => ({ id: 15 - i }));
  let call = 0;
  const fetchPage = async (from, to) => {
    if (++call === 2) newestFirst.unshift({ id: 16 }); // saved after page one was read
    return newestFirst.slice(from, to + 1);
  };
  const all = await fetchAllPages(fetchPage, { pageSize: 10, keyOf: (r) => r.id });
  assert.equal(all.length, 15);
  assert.equal(new Set(all.map((r) => r.id)).size, 15);
  assert.deepEqual(all.map((r) => r.id), newestFirst.slice(1).map((r) => r.id));
});

// The paging lives in paging.js so it can be tested here; data.js cannot
// load in Node. These read the source to hold the two together.
test("the ledger load goes through the paging helper, with row ids as the key", () => {
  const data = readFileSync(new URL("../js/data.js", import.meta.url), "utf8");
  const body = data.slice(data.indexOf("export async function fetchExpenses()"), data.indexOf("export async function fetchCards()"));
  assert.ok(body.includes("fetchAllPages("), "fetchExpenses pages");
  assert.ok(body.includes(".range(from, to)"), "each request asks for its own range");
  assert.ok(body.includes("keyOf: (row) => row.id"), "repeats are dropped by id");
  assert.ok(body.includes("if (error) throw error;"), "a failed page throws");
});

test("the service worker caches the paging module with the rest of the app", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(sw.includes('"js/paging.js"'));
});
