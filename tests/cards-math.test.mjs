import test from "node:test";
import assert from "node:assert/strict";
import { cardSummary, bestNextCard } from "../js/cards-math.js";

const AUG = new Date(2026, 7, 1); // August 2026
const cards = [
  { id: 1, name: "A (4mpd)", cap: 1000, note: "4mpd online" },
  { id: 2, name: "B (4mpd)", cap: 600, note: null },
  { id: 3, name: "PayNow / transfer", cap: null, note: null },
];
const e = (date, amount, card_id) => ({ date, amount, card_id });

test("sums per card for the viewed month only; untagged entries don't count", () => {
  const s = cardSummary(
    [
      e("2026-08-05", 400.5, 1),
      e("2026-08-20", 100, 1),
      e("2026-07-30", 999, 1), // other month
      e("2026-08-10", 50, 3),
      e("2026-08-11", 80, null), // pre-v1.4 untagged
    ],
    cards,
    AUG,
  );
  assert.deepEqual(
    s.map((c) => [c.id, c.spentCents, c.remainingCents, c.overCap]),
    [
      [1, 50050, 49950, false],
      [2, 0, 60000, false],
      [3, 5000, null, false],
    ],
  );
});

test("cap hit flags at and beyond the cap; remaining floors at zero", () => {
  const s = cardSummary([e("2026-08-01", 600, 2), e("2026-08-02", 50, 2)], cards, AUG);
  const b = s.find((c) => c.id === 2);
  assert.equal(b.overCap, true);
  assert.equal(b.remainingCents, 0);
});

test("excluded-from-totals spend still counts toward the card (miles don't care)", () => {
  // cardSummary never looks at category exclusion — this documents it
  const s = cardSummary([e("2026-08-03", 100, 1)], cards, AUG);
  assert.equal(s.find((c) => c.id === 1).spentCents, 10000);
});

test("bestNextCard: most headroom among capped cards; uncapped never competes", () => {
  const s = cardSummary([e("2026-08-05", 700, 1)], cards, AUG);
  assert.equal(bestNextCard(s).id, 2); // B has 600 left, A only 300
  const allCapped = cardSummary(
    [e("2026-08-05", 1000, 1), e("2026-08-06", 600, 2)],
    cards,
    AUG,
  );
  assert.equal(bestNextCard(allCapped), null);
});
