// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { displayNameFor } from "../js/identity.js";

test("returns the display_name from auth metadata, trimmed", () => {
  assert.equal(displayNameFor({ user_metadata: { display_name: "Shawn" } }), "Shawn");
  assert.equal(displayNameFor({ user_metadata: { display_name: "  Claire  " } }), "Claire");
});

test("returns null when metadata is missing, blank, or not a string", () => {
  assert.equal(displayNameFor(null), null);
  assert.equal(displayNameFor(undefined), null);
  assert.equal(displayNameFor({}), null);
  assert.equal(displayNameFor({ user_metadata: {} }), null);
  assert.equal(displayNameFor({ user_metadata: { display_name: "" } }), null);
  assert.equal(displayNameFor({ user_metadata: { display_name: "   " } }), null);
  assert.equal(displayNameFor({ user_metadata: { display_name: 42 } }), null);
});
