import { supabase } from "./supabase.js";

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    // sort_order must be selected: the manager computes "end of list"
    // from it (2026-07-29 bug: omitting it sent new categories to the
    // top — Shawn caught it on the phone within minutes)
    .select("id, name, icon, excluded_from_totals, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
}

export async function fetchExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, date, paid_by, note, created_by, category_id, card_id, card_charged, categories(name, icon, excluded_from_totals)")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data;
}

// ── cards: household-managed miles/cap list (v1.4) ───────────────────

export async function fetchCards() {
  const { data, error } = await supabase
    .from("cards")
    .select("id, name, cap, note, earn_types, color, image, sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
}

export async function addCard(fields) {
  const { error } = await supabase.from("cards").insert(fields);
  if (error) throw error;
}

export async function updateCard(id, fields) {
  const { error } = await supabase.from("cards").update(fields).eq("id", id);
  if (error) throw error;
}

// Card images live in the private "cards" storage bucket; signed URLs
// keep them household-only (the bucket is not public). 12h expiry
// comfortably outlives a session. Returns Map(card_id -> url), empty
// on any failure — the CSS mini-card is always the fallback.
export async function fetchCardImageUrls(cards) {
  const withImage = cards.filter((c) => c.image);
  if (withImage.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from("cards")
    .createSignedUrls(withImage.map((c) => c.image), 60 * 60 * 12);
  if (error) throw error;
  const byPath = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  return new Map(
    withImage.filter((c) => byPath.has(c.image)).map((c) => [c.id, byPath.get(c.image)]),
  );
}

// FK on expenses.card_id is on-delete-restrict: deleting a card with
// history fails at the database — the UI maps that to a friendly
// message rather than offering a reassign flow nobody has needed yet.
export async function deleteCard(id) {
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}

// Checks the database, not the local list — catches the other person's
// entry logged moments ago on their phone.
export async function findPossibleDuplicates(amount, date, excludeId = null) {
  let query = supabase
    .from("expenses")
    .select("id, date, paid_by, categories(name)")
    .eq("amount", amount)
    .gte("date", shiftDate(date, -1))
    .lte("date", shiftDate(date, 1));
  if (excludeId !== null) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// PostgREST caps responses at 1000 rows; a backup that silently
// truncates is worse than none, so page until done.
export async function fetchAllExpensesForExport() {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("expenses")
      .select("date, amount, card_charged, paid_by, note, categories(name), cards(name)")
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) return all;
  }
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// created_by is stamped server-side (default auth.uid()) and verified by RLS.
// Returns the new row's id so the form can offer a jump to it (v1.10).
// The id is a courtesy, not a contract: if the returning row were ever
// withheld, throwing here would report "couldn't save" on an entry
// that DID save — the double-log trap. Missing id degrades to null.
export async function addExpense(fields) {
  const { data, error } = await supabase.from("expenses").insert(fields).select("id");
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

export async function updateExpense(id, fields) {
  const { error } = await supabase.from("expenses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ── categories: household-managed in-app (v1.1 piece 2b) ─────────────

export async function addCategory(fields) {
  const { error } = await supabase.from("categories").insert(fields);
  if (error) throw error;
}

export async function updateCategory(id, fields) {
  const { error } = await supabase.from("categories").update(fields).eq("id", id);
  if (error) throw error;
}

export async function countExpensesForCategory(id) {
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (error) throw error;
  return count ?? 0;
}

// Delete-via-reassign must move BOTH users' rows; the expenses RLS
// policy (update own only) rightly blocks that client-side, so a
// SECURITY DEFINER function is the one narrow door (see
// db/migrations/2026-07-29-category-manager-rpc.sql).
export async function reassignAndDeleteCategory(fromId, toId) {
  const { error } = await supabase.rpc("reassign_and_delete_category", {
    from_id: fromId,
    to_id: toId,
  });
  if (error) throw error;
}

// ── to-dos: one shared household list (v1.2 ship 1) ──────────────────
// Sorting/overdue live in todos-view.js (pure, Node-tested); the fetch
// order is just a stable base.

export async function fetchTodos() {
  const { data, error } = await supabase
    .from("todos")
    .select("id, body, due_date, urgent, list, author, done_at, done_by, created_by, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addTodo(fields) {
  const { error } = await supabase.from("todos").insert(fields);
  if (error) throw error;
}

// Check-off and un-check both land here; RLS lets either account update
// any row — completing the other person's item is the point of a
// shared list (see db/migrations/2026-08-12-todos-v1_2.sql).
export async function updateTodo(id, fields) {
  const { error } = await supabase.from("todos").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteTodo(id) {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw error;
}

// ── ideas: raw friction inbox, curated into IDEAS.md at scoping time ──

export async function fetchIdeas() {
  const { data, error } = await supabase
    .from("ideas")
    .select("id, body, author, created_at, created_by")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addIdea(fields) {
  const { error } = await supabase.from("ideas").insert(fields);
  if (error) throw error;
}

export async function deleteIdea(id) {
  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) throw error;
}
