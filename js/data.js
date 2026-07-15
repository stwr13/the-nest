import { supabase } from "./supabase.js";

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, date, paid_by, note, created_by, category_id, categories(name)")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return data;
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
      .select("date, amount, paid_by, note, categories(name)")
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
export async function addExpense(fields) {
  const { error } = await supabase.from("expenses").insert(fields);
  if (error) throw error;
}

export async function updateExpense(id, fields) {
  const { error } = await supabase.from("expenses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
