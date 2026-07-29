// Pure ledger presentation logic (v1.1 piece 3): person filter + day
// grouping, extracted for Node tests. Expenses arrive newest-first
// (the fetch order); groups preserve that order.

export function ledgerView(expenses, person = "all") {
  const filtered =
    person === "all" ? expenses : expenses.filter((e) => e.paid_by === person);
  const groups = [];
  for (const expense of filtered) {
    const last = groups.at(-1);
    if (last?.date === expense.date) last.items.push(expense);
    else groups.push({ date: expense.date, items: [expense] });
  }
  return groups;
}
