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
    centsByCard.set(e.card_id, (centsByCard.get(e.card_id) ?? 0) + Math.round(e.amount * 100));
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

// The v1 "which card should I use?" answer: the capped card with the
// most headroom left. Uncapped cards don't compete (they have no bonus
// ceiling to maximize). Null when no capped card has room.
export function bestNextCard(summary) {
  return (
    summary
      .filter((c) => c.capCents != null && !c.overCap)
      .sort((a, b) => b.remainingCents - a.remainingCents)[0] ?? null
  );
}
