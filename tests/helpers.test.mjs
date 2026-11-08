import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toCents, isoDate, isOffline } from "../js/helpers.js";

test("cents are exact for amounts that floats get wrong", () => {
  assert.equal(toCents("0.29"), 29);
  assert.equal(toCents("0.07"), 7);
  assert.equal(toCents(12.3), 1230);
  assert.equal(toCents("1234.56"), 123456);
});

test("a date is the local calendar date, zero-padded", () => {
  assert.equal(isoDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(isoDate(new Date(2026, 10, 30, 23, 59)), "2026-11-30");
});

// The iPhone is the reference device, and every browser on it is WebKit.
test("no connection reads the same on every browser", () => {
  assert.ok(isOffline(new TypeError("Load failed")), "WebKit, so every iPhone browser");
  assert.ok(isOffline({ message: "TypeError: Load failed" }), "as supabase-js passes it on");
  assert.ok(isOffline(new TypeError("The Internet connection appears to be offline.")), "older iOS");
  assert.ok(isOffline(new TypeError("The network connection was lost.")), "older iOS, mid-request");
  assert.ok(isOffline(new TypeError("Failed to fetch")), "Chrome on a desktop");
  assert.ok(isOffline(new TypeError("NetworkError when attempting to fetch resource.")), "Firefox");
  assert.ok(!isOffline(new Error("duplicate key value violates unique constraint")));
  assert.ok(!isOffline(null));
});

test("the app asks one helper, not its own copy of the check", () => {
  const main = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");
  assert.ok(!main.includes('includes("fetch")'), "main.js should call isOffline");
  assert.ok(!/\/fetch\|load failed\/i/.test(main), "main.js should call isOffline");
});

// A raw error shown to a person must have had its chance to read as "No
// connection" first. v1.22 found five that never did.
test("every raw error message is checked for no connection first", () => {
  const lines = readFileSync(new URL("../js/main.js", import.meta.url), "utf8").split("\n");
  const raw = /Couldn't [^`]*\$\{(error\.message|failure\.message|message)\}/;
  const unchecked = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line, i }) => raw.test(line) && !lines.slice(Math.max(0, i - 5), i + 1).join("\n").includes("isOffline("))
    .map(({ line, i }) => `main.js:${i + 1} ${line.trim()}`);
  assert.deepEqual(unchecked, []);
});
