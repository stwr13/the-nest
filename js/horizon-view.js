// "Coming up" — the household horizon (v1.15). Pure, Node-tested.
//
// What this is NOT: a calendar. A calendar holds your dentist
// appointment, and Google already does that better on both phones.
// This assembles the things the HOUSEHOLD jointly needs to see — a
// charge landing, a chore due, an evening booked — which no external
// calendar can build, because it knows nothing about the money or the
// lists. The test for anything proposed here: would a dentist
// appointment belong? If yes, it belongs in Google instead.
//
// Forward-looking on purpose. Overdue to-dos are already surfaced on
// the To-dos tab and overdue charges on the due strip; repeating them
// here would make "what's coming" mean "what's late", which is a
// different question that already has two answers.

const RANK = { event: 0, recurring: 1, todo: 2 };

export function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function horizon(sources, todayIso, days = 30) {
  const { todos = [], recurring = [], events = [] } = sources;
  const end = addDays(todayIso, days);
  const inWindow = (date) => date >= todayIso && date <= end;
  const items = [];

  for (const t of todos) {
    // only the to-do list carries dated obligations: a shopping item
    // and a wish are both undated by nature
    if (t.list !== "todo" || t.done_at || !t.due_date) continue;
    if (!inWindow(t.due_date)) continue;
    items.push({ kind: "todo", date: t.due_date, label: t.body, urgent: Boolean(t.urgent) });
  }

  for (const r of recurring) {
    if (!r.active || !r.next_due || !inWindow(r.next_due)) continue;
    items.push({
      kind: "recurring",
      date: r.next_due,
      label: r.name,
      amount: Number(r.amount),
      who: r.paid_by,
    });
  }

  for (const e of events) {
    if (!inWindow(e.date)) continue;
    items.push({
      kind: "event",
      date: e.date,
      label: e.title,
      time: e.at_time ?? null,
      note: e.note ?? null,
      who: e.author,
    });
  }

  // Within a day: timed events in clock order, then all-day events,
  // then charges, then chores. A day reads as "when, then what".
  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      RANK[a.kind] - RANK[b.kind] ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.label.localeCompare(b.label),
  );

  const groups = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

// What the month is going to cost, from the charges in view — the
// figure the dashboard's "spent so far" can't know, because it only
// counts what has already happened.
export function upcomingChargeCents(groups) {
  let cents = 0;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === "recurring") cents += Math.round(item.amount * 100);
    }
  }
  return cents;
}
