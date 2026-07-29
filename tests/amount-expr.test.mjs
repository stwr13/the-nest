import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAmount, hasOperator } from "../js/amount-expr.js";

test("plain amounts pass through", () => {
  assert.equal(evaluateAmount("12.40"), 12.4);
  assert.equal(evaluateAmount(" 7 "), 7);
});

test("the food court and the dinner split", () => {
  assert.equal(evaluateAmount("3.5+6+2"), 11.5);
  assert.equal(evaluateAmount("405/4"), 101.25);
});

test("pretty glyphs and precedence", () => {
  assert.equal(evaluateAmount("405÷4"), 101.25);
  assert.equal(evaluateAmount("3×2"), 6);
  assert.equal(evaluateAmount("2+3*4"), 14);
  assert.equal(evaluateAmount("10/4/2"), 1.25); // left-associative
  assert.equal(evaluateAmount("10-2-3"), 5);
});

test("cent rounding", () => {
  assert.equal(evaluateAmount("0.1+0.2"), 0.3);
  assert.equal(evaluateAmount("100/3"), 33.33);
});

test("invalid or incomplete input returns null", () => {
  for (const bad of ["", "4+", "+4", "abc", "4//2", "12,40", "5/0", "1.2.3"]) {
    assert.equal(evaluateAmount(bad), null, `should reject "${bad}"`);
  }
});

test("hasOperator distinguishes calculations from plain amounts", () => {
  assert.equal(hasOperator("405/4"), true);
  assert.equal(hasOperator("3.5+6"), true);
  assert.equal(hasOperator("12.40"), false);
});
