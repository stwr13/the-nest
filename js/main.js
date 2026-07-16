import { supabase } from "./supabase.js";
import { displayNameFor } from "./identity.js";
import {
  fetchCategories,
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  findPossibleDuplicates,
  fetchAllExpensesForExport,
  fetchIdeas,
  addIdea,
  deleteIdea,
} from "./data.js";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");
const userName = document.getElementById("user-name");

const expenseForm = document.getElementById("expense-form");
const formTitle = document.getElementById("form-title");
const formStatus = document.getElementById("form-status");
const submitBtn = document.getElementById("exp-submit");
const cancelBtn = document.getElementById("exp-cancel");
const categorySelect = document.getElementById("exp-category");
const ledgerList = document.getElementById("ledger");
const ledgerStatus = document.getElementById("ledger-status");
const dashLabel = document.getElementById("dash-label");
const dashTotal = document.getElementById("dash-total");
const dashCompare = document.getElementById("dash-compare");
const dashCats = document.getElementById("dash-cats");
const dashEmpty = document.getElementById("dash-empty");
const dashMonths = document.getElementById("dash-months");
const ideaForm = document.getElementById("idea-form");
const ideaStatus = document.getElementById("idea-status");
const ideaSubmit = document.getElementById("idea-submit");
const ideaList = document.getElementById("idea-list");

const sgd = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const dateFmt = new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("en-SG", { month: "long" });
const monthShortFmt = new Intl.DateTimeFormat("en-SG", { month: "short" });
// whole dollars for trend glances; cents belong in the ledger
const sgdWhole = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 0,
});

let currentUser = null;
let editingId = null;
let appLoaded = false;

// ── auth ──────────────────────────────────────────────────────────────

// Fires INITIAL_SESSION on page load, then on every sign-in/out and
// token refresh, so this is the single place that decides the view.
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  loginView.hidden = Boolean(session);
  appView.hidden = !session;
  if (session) {
    // No display_name set yet → show the login email: visible, never blank.
    userName.textContent = displayNameFor(session.user) ?? session.user.email;
    if (!appLoaded) {
      appLoaded = true; // token refreshes re-fire this handler; load once
      loadApp();
    }
  } else {
    appLoaded = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showLoginError(null);
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Signing in…";

  const { error } = await supabase.auth.signInWithPassword({
    email: loginForm.email.value.trim(),
    password: loginForm.password.value,
  });

  loginSubmit.disabled = false;
  loginSubmit.textContent = "Sign in";
  if (error) showLoginError(friendlyAuthError(error));
  else loginForm.reset();
});

document.getElementById("sign-out").addEventListener("click", () => {
  supabase.auth.signOut();
});

function showLoginError(message) {
  loginError.textContent = message ?? "";
  loginError.hidden = !message;
}

function friendlyAuthError(error) {
  if (error.message?.includes("Invalid login credentials")) {
    return "Wrong email or password — try again.";
  }
  if (error.message?.includes("fetch")) {
    return "No connection — couldn't sign in.";
  }
  return `Couldn't sign in: ${error.message}`;
}

// ── app ───────────────────────────────────────────────────────────────

async function loadApp() {
  resetFormDefaults();
  try {
    const [categories, expenses] = await Promise.all([
      fetchCategories(),
      fetchExpenses(),
    ]);
    categorySelect.replaceChildren(
      ...categories.map((c) => new Option(c.name, c.id)),
    );
    renderAll(expenses);
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
  // Deliberately separate: the idea box is auxiliary, and its failure
  // must never take the ledger down with it. Its errors show in its
  // own card via refreshIdeas' catch.
  refreshIdeas();
}

async function refresh() {
  try {
    renderAll(await fetchExpenses());
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
}

function renderAll(expenses) {
  renderDashboard(expenses);
  renderLedger(expenses);
}

function loadErrorMessage(error) {
  return error.message?.includes("fetch")
    ? "No connection — couldn't load the ledger."
    : `Couldn't load the ledger: ${error.message}`;
}

function renderLedger(expenses) {
  if (expenses.length === 0) {
    showLedgerStatus("No expenses yet — log the first one above.");
    ledgerList.replaceChildren();
    return;
  }
  showLedgerStatus(null);
  // textContent throughout: notes are user input and must never be
  // interpreted as HTML
  ledgerList.replaceChildren(...expenses.map(renderEntry));
}

function renderEntry(expense) {
  const li = document.createElement("li");

  const main = document.createElement("div");
  main.className = "entry-main";

  const top = document.createElement("p");
  top.className = "entry-title";
  const category = document.createElement("span");
  category.textContent = expense.categories.name;
  top.append(category);
  if (expense.note) {
    const note = document.createElement("span");
    note.className = "entry-note";
    note.textContent = ` · ${expense.note}`;
    top.append(note);
  }

  const meta = document.createElement("p");
  meta.className = "entry-meta";
  meta.textContent = `${dateFmt.format(new Date(expense.date + "T00:00:00"))} · paid by ${expense.paid_by}`;

  main.append(top, meta);

  const side = document.createElement("div");
  side.className = "entry-side";

  const amount = document.createElement("span");
  amount.className = "entry-amount";
  amount.textContent = sgd.format(expense.amount);
  side.append(amount);

  // Courtesy only — RLS is what actually stops edits to the other
  // person's rows.
  if (expense.created_by === currentUser?.id) {
    const actions = document.createElement("span");
    actions.className = "entry-actions";
    actions.append(
      entryButton("Edit", () => startEdit(expense)),
      entryButton("Delete", () => confirmDelete(expense)),
    );
    side.append(actions);
  }

  li.append(main, side);
  return li;
}

// ── dashboard ─────────────────────────────────────────────────────────

// Sums in integer cents: amounts are exact numeric in Postgres, but JS
// numbers are floats — 84.2 + 9.9 style drift would show on screen.
function renderDashboard(expenses) {
  const now = new Date();
  const thisKey = monthKey(now);

  let thisCents = 0;
  const byCategory = new Map();
  const byMonth = new Map();

  for (const expense of expenses) {
    const key = expense.date.slice(0, 7);
    const cents = Math.round(Number(expense.amount) * 100);
    if (key === thisKey) {
      thisCents += cents;
      const name = expense.categories.name;
      byCategory.set(name, (byCategory.get(name) ?? 0) + cents);
    } else {
      byMonth.set(key, (byMonth.get(key) ?? 0) + cents);
    }
  }

  dashLabel.textContent = `This month · ${monthFmt.format(now)}`;
  dashTotal.textContent = sgd.format(thisCents / 100);

  // Past three calendar months, oldest first — but only from the month
  // history began; a wall of S$0 rows would be noise in the first weeks.
  // The average smooths one-off big-ticket months; the row shows why.
  const earliestKey = expenses.length
    ? expenses[expenses.length - 1].date.slice(0, 7)
    : null;
  const past = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    if (earliestKey !== null && key >= earliestKey) {
      past.push({ date: d, cents: byMonth.get(key) ?? 0 });
    }
  }

  dashMonths.hidden = past.length === 0;
  dashMonths.textContent = past
    .map((m) => `${monthShortFmt.format(m.date)} ${sgdWhole.format(Math.round(m.cents / 100))}`)
    .join(" · ");

  if (past.length >= 2) {
    const avgCents = past.reduce((sum, m) => sum + m.cents, 0) / past.length;
    dashCompare.textContent = `${past.length}-mo avg: ${sgdWhole.format(Math.round(avgCents / 100))}`;
  } else if (past.length === 1) {
    dashCompare.textContent = `${monthShortFmt.format(past[0].date)}: ${sgd.format(past[0].cents / 100)}`;
  } else {
    dashCompare.textContent = "first month";
  }

  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  dashEmpty.hidden = rows.length > 0;
  const maxCents = rows[0]?.[1] ?? 1;
  dashCats.replaceChildren(...rows.map(([name, cents]) => categoryRow(name, cents, maxCents)));
}

function categoryRow(name, cents, maxCents) {
  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "cat-row";
  const label = document.createElement("span");
  label.textContent = name;
  const value = document.createElement("span");
  value.textContent = sgd.format(cents / 100);
  row.append(label, value);

  const bar = document.createElement("div");
  bar.className = "cat-bar";
  const fill = document.createElement("div");
  fill.className = "cat-bar-fill";
  fill.style.width = `${Math.max(4, Math.round((cents / maxCents) * 100))}%`;
  bar.append(fill);

  li.append(row, bar);
  return li;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function entryButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn-link";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

// ── form ──────────────────────────────────────────────────────────────

expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showFormStatus(null);
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  const fields = {
    amount: Number(expenseForm.amount.value),
    category_id: Number(expenseForm.category_id.value),
    paid_by: expenseForm.paid_by.value,
    date: expenseForm.date.value,
    note: expenseForm.note.value.trim() || null,
  };

  try {
    let proceed = true;
    try {
      const dupes = await findPossibleDuplicates(fields.amount, fields.date, editingId);
      if (dupes.length > 0) proceed = window.confirm(duplicateMessage(fields, dupes[0]));
    } catch {
      // the check is advisory — warn, never block, even when it fails
    }
    if (!proceed) return;

    if (editingId === null) await addExpense(fields);
    else await updateExpense(editingId, fields);
    exitEditMode();
    expenseForm.amount.value = "";
    expenseForm.note.value = "";
    await refresh();
  } catch (error) {
    showFormStatus(
      error.message?.includes("fetch")
        ? "No connection — entry not saved."
        : `Couldn't save: ${error.message}`,
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId === null ? "Save" : "Update";
  }
});

function duplicateMessage(fields, dupe) {
  const when = dateFmt.format(new Date(dupe.date + "T00:00:00"));
  return (
    `Possible duplicate: ${sgd.format(fields.amount)} is already logged ` +
    `(${dupe.categories.name}, ${when}, paid by ${dupe.paid_by}).\n\nSave anyway?`
  );
}

cancelBtn.addEventListener("click", () => {
  exitEditMode();
  expenseForm.amount.value = "";
  expenseForm.note.value = "";
});

function startEdit(expense) {
  editingId = expense.id;
  expenseForm.amount.value = expense.amount;
  expenseForm.category_id.value = String(expense.category_id);
  expenseForm.paid_by.value = expense.paid_by;
  expenseForm.date.value = expense.date;
  expenseForm.note.value = expense.note ?? "";
  formTitle.textContent = "Edit expense";
  submitBtn.textContent = "Update";
  cancelBtn.hidden = false;
  showFormStatus(null);
  expenseForm.scrollIntoView({ behavior: "smooth" });
}

function exitEditMode() {
  editingId = null;
  formTitle.textContent = "Log an expense";
  submitBtn.textContent = "Save";
  cancelBtn.hidden = true;
  resetFormDefaults();
}

async function confirmDelete(expense) {
  const label = `${sgd.format(expense.amount)} (${expense.categories.name})`;
  if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
  try {
    await deleteExpense(expense.id);
    if (editingId === expense.id) exitEditMode();
    await refresh();
  } catch (error) {
    showLedgerStatus(
      error.message?.includes("fetch")
        ? "No connection — entry not deleted."
        : `Couldn't delete: ${error.message}`,
    );
  }
}

// ── CSV export ────────────────────────────────────────────────────────

const exportBtn = document.getElementById("export-csv");
exportBtn.addEventListener("click", exportCsv);

async function exportCsv() {
  exportBtn.disabled = true;
  exportBtn.textContent = "Exporting…";
  try {
    const rows = await fetchAllExpensesForExport();
    const header = "date,amount,category,paid_by,note";
    const lines = rows.map((r) =>
      [r.date, r.amount, r.categories.name, r.paid_by, r.note ?? ""]
        .map(csvField)
        .join(","),
    );
    // BOM so Excel detects UTF-8 instead of mangling accented text
    const csv = "\uFEFF" + [header, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `the-nest-ledger-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    showLedgerStatus(
      error.message?.includes("fetch")
        ? "No connection — export failed."
        : `Couldn't export: ${error.message}`,
    );
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = "Export CSV";
  }
}

function csvField(value) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// ── idea box: raw friction inbox for the usage trial ─────────────────

// Header 💡: capture must stay one tap away no matter how long the
// ledger grows. focus() inside the tap handler opens the keyboard.
document.getElementById("idea-jump").addEventListener("click", () => {
  ideaForm.body.focus({ preventScroll: true });
  ideaForm.body.scrollIntoView({ behavior: "smooth", block: "center" });
});

ideaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showIdeaStatus(null);
  ideaSubmit.disabled = true;
  ideaSubmit.textContent = "Logging…";
  try {
    await addIdea({
      body: ideaForm.body.value.trim(),
      author: displayNameFor(currentUser) ?? currentUser?.email ?? "unknown",
    });
    ideaForm.reset();
    await refreshIdeas();
  } catch (error) {
    showIdeaStatus(
      error.message?.includes("fetch")
        ? "No connection — idea not saved."
        : `Couldn't save: ${error.message}`,
    );
  } finally {
    ideaSubmit.disabled = false;
    ideaSubmit.textContent = "Log it";
  }
});

async function refreshIdeas() {
  try {
    renderIdeas(await fetchIdeas());
  } catch (error) {
    showIdeaStatus(
      error.message?.includes("fetch")
        ? "No connection — couldn't load ideas."
        : `Couldn't load ideas: ${error.message}`,
    );
  }
}

function renderIdeas(ideas) {
  ideaList.replaceChildren(...ideas.map(renderIdea));
}

function renderIdea(idea) {
  const li = document.createElement("li");

  const main = document.createElement("div");
  main.className = "entry-main";

  const body = document.createElement("p");
  body.className = "entry-title";
  body.textContent = idea.body;

  const meta = document.createElement("p");
  meta.className = "entry-meta";
  meta.textContent = `${idea.author} · ${dateFmt.format(new Date(idea.created_at))}`;

  main.append(body, meta);
  li.append(main);

  if (idea.created_by === currentUser?.id) {
    const side = document.createElement("div");
    side.className = "entry-side";
    side.append(entryButton("Delete", () => confirmDeleteIdea(idea)));
    li.append(side);
  }
  return li;
}

async function confirmDeleteIdea(idea) {
  if (!window.confirm("Delete this note?")) return;
  try {
    await deleteIdea(idea.id);
    await refreshIdeas();
  } catch (error) {
    showIdeaStatus(`Couldn't delete: ${error.message}`);
  }
}

function showIdeaStatus(message) {
  ideaStatus.textContent = message ?? "";
  ideaStatus.hidden = !message;
}

function resetFormDefaults() {
  expenseForm.date.value = todayISO();
  // No display_name (or no matching radio) → nothing preselected; the
  // radio group is `required`, so the form visibly asks instead.
  const myName = displayNameFor(currentUser);
  if (myName) expenseForm.paid_by.value = myName;
}

// Local calendar date — toISOString() would give the UTC date, which is
// yesterday in Singapore before 8am.
function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function showFormStatus(message) {
  formStatus.textContent = message ?? "";
  formStatus.hidden = !message;
}

function showLedgerStatus(message) {
  ledgerStatus.textContent = message ?? "";
  ledgerStatus.hidden = !message;
}

// ── PWA ───────────────────────────────────────────────────────────────

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((error) => console.warn("Service worker registration failed:", error));
}
