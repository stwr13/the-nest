// Money in (v1.24). Pure, Node-tested.
//
// What it answers: of what came in this month, how much is left once
// everything that went out is taken off. Out is total outflow, counted
// or not, so Left over is what the household actually kept. Investment
// & Insurance sits inside Out, and the hint says how much, because that
// is saving too.
//
// `whose` is a tag on each row of the list, and never a total: there is
// no per-person sum anywhere in this module, and a test holds that line.

import { toCents } from "./helpers.js";

export const INFLOW_WHOSE = ["Shawn", "Claire", "Both"];
export const INFLOW_KINDS = ["salary", "other"];
export const KIND_LABEL = { salary: "Salary", other: "Other" };

// The month's inflows and their sums. Rows: Salary first, then Other,
// newest first within each, so the steady part reads at the top.
export function monthInflows(inflows, key) {
  const rows = inflows
    .filter((inflow) => inflow.date.slice(0, 7) === key)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "salary" ? -1 : 1;
      return b.date.localeCompare(a.date) || b.id - a.id;
    });
  let salaryCents = 0;
  let otherCents = 0;
  for (const row of rows) {
    if (row.kind === "salary") salaryCents += toCents(row.amount);
    else otherCents += toCents(row.amount);
  }
  return { rows, salaryCents, otherCents, inCents: salaryCents + otherCents };
}

// What went to Investment & Insurance this month, by categories.kind,
// never by name. Named after its category, as on Overview; if there
// were ever more than one such category, a neutral name instead.
export function setAsideOut(expenses, key) {
  let cents = 0;
  const names = new Set();
  for (const expense of expenses) {
    if (expense.categories?.kind !== "invest") continue;
    if (expense.date.slice(0, 7) !== key) continue;
    cents += toCents(expense.amount);
    names.add(expense.categories.name);
  }
  const label = names.size === 1 ? [...names][0] : "investment and insurance";
  return { cents, label };
}

// The row's headline is its note when there is one ("Dividend"),
// otherwise its type ("Salary"). The type then moves to the meta line,
// so it is never lost.
export function inflowTitle(inflow) {
  const note = inflow.note?.trim();
  return note || KIND_LABEL[inflow.kind] || "Other";
}

export function inflowShowsKind(inflow) {
  return Boolean(inflow.note?.trim());
}

// Checks the form and returns the row to save, or the reason not to.
// `amount` arrives already evaluated (the calculator may have run).
export function inflowFields({ amount, date, whose, kind, note }) {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount above zero." };
  }
  if (amount >= 1e10) return { error: "That amount is too large." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return { error: "Pick a date." };
  if (!INFLOW_WHOSE.includes(whose)) return { error: "Pick whose it is." };
  if (!INFLOW_KINDS.includes(kind)) return { error: "Pick Salary or Other." };
  const trimmed = (note ?? "").trim();
  if (trimmed.length > 200) return { error: "Keep the note under 200 characters." };
  return {
    fields: {
      amount: Math.round(amount * 100) / 100,
      date,
      whose,
      kind,
      note: trimmed || null,
    },
  };
}
