import test from "node:test";
import assert from "node:assert/strict";
import { cardSummary, bestNextCard, normalizeTags, allTags, cardsForTag, staleRule } from "../js/cards-math.js";

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

test("card_charged overrides amount for cap math (group-bill split); null falls back", () => {
  const s = cardSummary(
    [
      { date: "2026-08-05", amount: 50, card_id: 1, card_charged: 200 }, // paid $200, share $50
      { date: "2026-08-06", amount: 30, card_id: 1 }, // normal entry
    ],
    cards,
    AUG,
  );
  assert.equal(s.find((c) => c.id === 1).spentCents, 23000); // 200 + 30, not 50 + 30
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

test("normalizeTags: trims, lowercases, dedupes, drops empties", () => {
  assert.deepEqual(normalizeTags(" Dining, contactless , dining,, ONLINE "), [
    "dining",
    "contactless",
    "online",
  ]);
  assert.deepEqual(normalizeTags(""), []);
  assert.deepEqual(normalizeTags(null), []);
});

test("allTags: sorted union across cards", () => {
  assert.deepEqual(
    allTags([
      { earn_types: ["online", "dining"] },
      { earn_types: ["dining", "retail"] },
      { earn_types: [] },
      {}, // pre-migration shape
    ]),
    ["dining", "online", "retail"],
  );
});

test("cardsForTag: open-cap matches by headroom, then uncapped, cap-hit last but visible", () => {
  const tagged = [
    { ...cards[0], earn_types: ["retail", "contactless"] }, // A cap 1000
    { ...cards[1], earn_types: ["retail"] }, // B cap 600
    { ...cards[2], earn_types: ["retail"] }, // PayNow, uncapped
  ];
  // A has spent 900 (100 left), B spent 0 (600 left)
  const s = cardSummary([e("2026-08-01", 900, 1)], tagged, AUG);
  const { ranked, best } = cardsForTag(s, "retail");
  assert.deepEqual(ranked.map((c) => c.id), [2, 1, 3]);
  assert.equal(best.id, 2);
  // cap-hit match sinks to the bottom but is not hidden
  const s2 = cardSummary([e("2026-08-01", 1000, 1), e("2026-08-02", 600, 2)], tagged, AUG);
  const r2 = cardsForTag(s2, "retail");
  assert.deepEqual(r2.ranked.map((c) => c.id), [3, 1, 2]);
  assert.equal(r2.best.id, 3); // uncapped match still earns
  // no match for an unknown tag
  assert.deepEqual(cardsForTag(s, "petrol"), { ranked: [], best: null });
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

// ── v1.17: expired earn rules ───────────────────────────────────────
test("staleRule only fires on a review date that has passed", () => {
  assert.equal(staleRule({ earn_review_date: "2026-09-30" }, "2026-09-20"), false);
  assert.equal(staleRule({ earn_review_date: "2026-09-20" }, "2026-09-20"), false, "the review day itself is still good");
  assert.equal(staleRule({ earn_review_date: "2026-09-19" }, "2026-09-20"), true);
  assert.equal(staleRule({ earn_review_date: null }, "2026-09-20"), false, "no date means the rule does not expire");
  assert.equal(staleRule({ earn_review_date: "2026-09-19" }, null), false, "no clock, no judgement");
});

test("a stale card is flagged but still ranked", () => {
  const cards = [
    { id: 1, name: "Fresh", cap: 1000, earn_types: ["dining"], earn_review_date: "2026-12-31" },
    { id: 2, name: "Expired", cap: 1000, earn_types: ["dining"], earn_review_date: "2026-09-30" },
  ];
  // the expired card has MORE headroom, so without the stale rule it
  // would win outright — that is the bug being prevented
  const expenses = [{ card_id: 1, date: "2026-10-05", amount: "400.00", card_charged: null }];
  const summary = cardSummary(expenses, cards, new Date(2026, 9, 5), "2026-10-05");

  assert.equal(summary.find((c) => c.id === 1).stale, false);
  assert.equal(summary.find((c) => c.id === 2).stale, true);
  assert.equal(bestNextCard(summary).name, "Fresh", "a confirmed rule beats more headroom on an expired one");

  const forTag = cardsForTag(summary, "dining");
  assert.equal(forTag.best.name, "Fresh");
  assert.deepEqual(forTag.ranked.map((c) => c.name), ["Fresh", "Expired"], "still listed, just last");
});

test("a stale card still wins when it is the only option", () => {
  const cards = [{ id: 1, name: "Only one", cap: 500, earn_types: ["dining"], earn_review_date: "2026-01-01" }];
  const summary = cardSummary([], cards, new Date(2026, 9, 5), "2026-10-05");
  assert.equal(bestNextCard(summary).name, "Only one", "a stale rule is usually still roughly right");
});

test("cardSummary without a clock reports nothing stale", () => {
  const cards = [{ id: 1, name: "Old", cap: 500, earn_review_date: "2020-01-01" }];
  assert.equal(cardSummary([], cards, new Date(2026, 9, 5))[0].stale, false);
});
