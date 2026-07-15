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
