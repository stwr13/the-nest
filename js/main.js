import { supabase } from "./supabase.js";
import { HOUSEHOLD } from "./config.js";
import {
  fetchCategories,
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
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

const sgd = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const dateFmt = new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short" });

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
    userName.textContent = HOUSEHOLD[session.user.email] ?? session.user.email;
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
    const [categories, expenses] = await Promise.all([fetchCategories(), fetchExpenses()]);
    categorySelect.replaceChildren(
      ...categories.map((c) => new Option(c.name, c.id)),
    );
    renderLedger(expenses);
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
}

async function refreshLedger() {
  try {
    renderLedger(await fetchExpenses());
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
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
  top.textContent = expense.categories.name + (expense.note ? ` · ${expense.note}` : "");

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
    if (editingId === null) await addExpense(fields);
    else await updateExpense(editingId, fields);
    exitEditMode();
    expenseForm.amount.value = "";
    expenseForm.note.value = "";
    await refreshLedger();
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
    await refreshLedger();
  } catch (error) {
    showLedgerStatus(
      error.message?.includes("fetch")
        ? "No connection — entry not deleted."
        : `Couldn't delete: ${error.message}`,
    );
  }
}

function resetFormDefaults() {
  expenseForm.date.value = todayISO();
  const myName = HOUSEHOLD[currentUser?.email];
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
