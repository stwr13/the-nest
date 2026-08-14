// Pure card/cap math (v1.4), Node-tested. The miles question is
// "how much has this card absorbed this month, and how much cap is
// left?" — so sums deliberately include EVERY entry on the card,
// even excluded-from-totals categories (Blessing spend still earns
// miles; the exclusion flag is about household totals, not card caps).

export function cardSummary(expenses, cards, monthDate) {
  const mk = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const centsByCard = new Map();
  for (const e of expenses) {
    if (e.card_id == null || !e.date.startsWith(mk)) continue;
    // v1.8: caps count what the CARD absorbed — on a group bill that's
    // the full charge (card_charged), not the household's share (amount)
    const charged = e.card_charged ?? e.amount;
    centsByCard.set(e.card_id, (centsByCard.get(e.card_id) ?? 0) + Math.round(charged * 100));
  }
  return cards.map((c) => {
    const spentCents = centsByCard.get(c.id) ?? 0;
    const capCents = c.cap == null ? null : Math.round(c.cap * 100);
    return {
      ...c,
      spentCents,
      capCents,
      remainingCents: capCents == null ? null : Math.max(0, capCents - spentCents),
      overCap: capCents != null && spentCents >= capCents,
    };
  });
}

// The generic "which card should I use?" answer: the capped card with
// the most headroom left. Uncapped cards don't compete (they have no
// bonus ceiling to maximize). Null when no capped card has room.
export function bestNextCard(summary) {
  return (
    summary
      .filter((c) => c.capCents != null && !c.overCap)
      .sort((a, b) => b.remainingCents - a.remainingCents)[0] ?? null
  );
}

// ── earn tags (v1.5): the situation-specific answer ──────────────────
// Tags are the household's own vocabulary ("dining", "contactless",
// "retail"…), typed per card — deliberately not a fixed menu, so the
// model can't be wrong about how a specific card earns; the app only
// contributes ranking and cap math.

export function normalizeTags(text) {
  const seen = new Set();
  for (const raw of (text ?? "").split(",")) {
    const tag = raw.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export function allTags(cards) {
  const seen = new Set();
  for (const c of cards) for (const t of c.earn_types ?? []) seen.add(t);
  return [...seen].sort();
}

// Cards that earn on `tag`, ranked: open-cap matches by headroom first
// (uncapped matches after — they earn, but there's no ceiling to
// protect), cap-hit matches last (flagged, not hidden: "it earns here
// but it's full" is the warning that saves the wasted spend).
export function cardsForTag(summary, tag) {
  const matches = summary.filter((c) => (c.earn_types ?? []).includes(tag));
  const open = matches
    .filter((c) => !c.overCap && c.capCents != null)
    .sort((a, b) => b.remainingCents - a.remainingCents);
  const uncapped = matches.filter((c) => c.capCents == null);
  const full = matches.filter((c) => c.overCap);
  return { ranked: [...open, ...uncapped, ...full], best: open[0] ?? uncapped[0] ?? null };
}
