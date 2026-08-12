// Pure to-do presentation logic (v1.2 ship 1), extracted for Node
// tests. Open items sort due-first: earliest due date at the top,
// dateless ones after, ties oldest-added first (a dump list grows at
// the bottom). Done items sort newest-done-first. "Overdue" is computed
// against the caller's today so tests control the clock.

export function todosView(todos, todayIso) {
  const open = todos
    .filter((t) => !t.done_at)
    .sort(
      (a, b) =>
        compareDue(a.due_date, b.due_date) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id - b.id,
    )
    .map((t) => ({ ...t, overdue: Boolean(t.due_date && t.due_date < todayIso) }));
  const done = todos
    .filter((t) => t.done_at)
    .sort((a, b) => b.done_at.localeCompare(a.done_at) || b.id - a.id);
  return { open, done };
}

function compareDue(a, b) {
  if (a === b) return 0;
  if (!a) return 1; // dateless sinks below every dated item
  if (!b) return -1;
  return a < b ? -1 : 1;
}
