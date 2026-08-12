import { supabase } from "./supabase.js";
import { displayNameFor } from "./identity.js";
import { summarize, categoryLabel, monthKey } from "./dashboard-math.js";
import { ledgerView } from "./ledger-view.js";
import { todosView } from "./todos-view.js";
import { defaultCategoryId } from "./category-default.js";
import { evaluateAmount, hasOperator } from "./amount-expr.js";
import {
  fetchCategories,
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  findPossibleDuplicates,
  fetchAllExpensesForExport,
  addCategory,
  updateCategory,
  countExpensesForCategory,
  reassignAndDeleteCategory,
  fetchIdeas,
  addIdea,
  deleteIdea,
  fetchTodos,
  addTodo,
  updateTodo,
  deleteTodo,
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
const dashPrev = document.getElementById("dash-prev");
const dashNext = document.getElementById("dash-next");
const catList = document.getElementById("cat-list");
const catDialog = document.getElementById("cat-dialog");
const catForm = document.getElementById("cat-form");
const catDialogTitle = document.getElementById("cat-dialog-title");
const catStatus = document.getElementById("cat-status");
const catDeleteBtn = document.getElementById("cat-delete");
const catDeleteDialog = document.getElementById("cat-delete-dialog");
const catDeleteForm = document.getElementById("cat-delete-form");
const catDeleteInfo = document.getElementById("cat-delete-info");
const catDeleteTarget = document.getElementById("cat-delete-target");
const catDeleteStatus = document.getElementById("cat-delete-status");
const ideaForm = document.getElementById("idea-form");
const ideaStatus = document.getElementById("idea-status");
const ideaSubmit = document.getElementById("idea-submit");
const ideaList = document.getElementById("idea-list");
const todoForm = document.getElementById("todo-form");
const todoStatus = document.getElementById("todo-status");
const todoSubmit = document.getElementById("todo-submit");
const todoEmpty = document.getElementById("todo-empty");
const todoList = document.getElementById("todo-list");
const todoDoneToggle = document.getElementById("todo-done-toggle");
const todoDoneList = document.getElementById("todo-done-list");

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
let categoriesCache = [];
let dialogCategoryId = null; // null while adding a new category
let expensesCache = [];
let dashDate = startOfMonth(new Date()); // which month the dashboard shows
let ledgerFilter = "all";
let ledgerCategory = "all";
const ledgerCategorySelect = document.getElementById("ledger-category");
const amountPreview = document.getElementById("amount-preview");

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
    categoriesCache = categories;
    renderCategoryOptions();
    renderCategoryManager();
    // cold open lands on the category this user actually logs most
    // (v1.2.1 — Shawn: daily use is Eating out, picking it every time
    // is friction). Within a session, the last pick still sticks.
    const usual = defaultCategoryId(expenses, currentUser?.id, todayISO());
    if (usual !== null && [...categorySelect.options].some((o) => o.value === String(usual))) {
      categorySelect.value = String(usual);
    }
    renderAll(expenses);
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
  // Deliberately separate: the idea box and to-do list are auxiliary,
  // and their failures must never take the ledger down with them. Each
  // shows its errors in its own card via its refresh's catch.
  refreshIdeas();
  refreshTodos();
}

async function refresh() {
  try {
    renderAll(await fetchExpenses());
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
}

function renderAll(expenses) {
  expensesCache = expenses;
  renderDashboard(expenses);
  renderLedger(expenses);
}

function loadErrorMessage(error) {
  return error.message?.includes("fetch")
    ? "No connection — couldn't load the ledger."
    : `Couldn't load the ledger: ${error.message}`;
}

function renderLedger(expenses) {
  const groups = ledgerView(expenses, ledgerFilter, ledgerCategory);
  if (groups.length === 0) {
    showLedgerStatus(
      expenses.length === 0
        ? "No expenses yet — log the first one above."
        : "Nothing matches this filter yet.",
    );
    ledgerList.replaceChildren();
    return;
  }
  showLedgerStatus(null);
  // textContent throughout: notes are user input and must never be
  // interpreted as HTML
  ledgerList.replaceChildren(
    ...groups.flatMap((group) => [
      dayHeader(group.date),
      ...group.items.map(renderEntry),
    ]),
  );
}

function dayHeader(date) {
  const li = document.createElement("li");
  li.className = "day-header";
  li.textContent = dateFmt.format(new Date(date + "T00:00:00"));
  return li;
}

// filters re-render from cache — no refetch for a view change
document.getElementById("ledger-filter").addEventListener("change", (event) => {
  ledgerFilter = event.target.value;
  renderLedger(expensesCache);
});

ledgerCategorySelect.addEventListener("change", () => {
  ledgerCategory = ledgerCategorySelect.value;
  renderLedger(expensesCache);
});

function renderEntry(expense) {
  const li = document.createElement("li");

  const main = document.createElement("div");
  main.className = "entry-main";

  const top = document.createElement("p");
  top.className = "entry-title";
  const category = document.createElement("span");
  category.textContent = categoryLabel(expense.categories);
  top.append(category);
  if (expense.note) {
    const note = document.createElement("span");
    note.className = "entry-note";
    note.textContent = ` · ${expense.note}`;
    top.append(note);
  }

  const meta = document.createElement("p");
  meta.className = "entry-meta";
  // date lives in the day header now; repeating it per entry is noise
  meta.textContent = `paid by ${expense.paid_by}`;

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

// Math lives in dashboard-math.js (pure, Node-tested); this renders it.
// The dashboard is month-navigable: on the 1st of a month the previous
// month's breakdown used to vanish — exactly when you want to review it
// (Claire, idea box 2026-08-01).
function renderDashboard(expenses) {
  const { thisCents, byCategory, past, excluded } = summarize(expenses, dashDate);
  const viewingNow = monthKey(dashDate) === monthKey(new Date());

  dashLabel.textContent = viewingNow
    ? `This month · ${monthFmt.format(dashDate)}`
    : `${monthFmt.format(dashDate)} ${dashDate.getFullYear()}`;
  dashTotal.textContent = sgd.format(thisCents / 100);

  // don't walk back past the start of history, or forward past today
  const earliestKey = expenses.length
    ? expenses[expenses.length - 1].date.slice(0, 7)
    : monthKey(new Date());
  dashPrev.disabled = monthKey(shiftMonth(dashDate, -1)) < earliestKey;
  dashNext.disabled = viewingNow;

  // months in the comparison row are tappable — Claire reached for this
  // before it existed, so it's the affordance the app owed her
  dashMonths.hidden = past.length === 0;
  dashMonths.replaceChildren(
    ...past.flatMap((m, i) => {
      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "dash-month-link";
      jump.textContent = `${monthShortFmt.format(m.date)} ${sgdWhole.format(Math.round(m.cents / 100))}`;
      jump.addEventListener("click", () => showMonth(m.date));
      return i === 0 ? [jump] : [document.createTextNode(" · "), jump];
    }),
  );

  if (past.length >= 2) {
    const avgCents = past.reduce((sum, m) => sum + m.cents, 0) / past.length;
    dashCompare.textContent = `${past.length}-mo avg: ${sgdWhole.format(Math.round(avgCents / 100))}`;
  } else if (past.length === 1) {
    dashCompare.textContent = `${monthShortFmt.format(past[0].date)}: ${sgd.format(past[0].cents / 100)}`;
  } else {
    dashCompare.textContent = "first month";
  }

  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  dashEmpty.hidden = rows.length > 0 || excluded.size > 0;
  dashEmpty.textContent = viewingNow
    ? "Nothing logged this month yet."
    : `Nothing logged in ${monthFmt.format(dashDate)}.`;
  const maxCents = rows[0]?.[1] ?? 1;
  const excludedRows = [...excluded.entries()].sort((a, b) => b[1] - a[1]);
  dashCats.replaceChildren(
    ...rows.map(([label, cents]) => categoryRow(label, cents, maxCents)),
    ...excludedRows.map(([label, cents]) => excludedCategoryRow(label, cents)),
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function showMonth(date) {
  dashDate = startOfMonth(date);
  renderDashboard(expensesCache);
}

dashPrev.addEventListener("click", () => showMonth(shiftMonth(dashDate, -1)));
dashNext.addEventListener("click", () => showMonth(shiftMonth(dashDate, 1)));

// Blessing-style categories: shown for visibility, kept out of the sums
function excludedCategoryRow(label, cents) {
  const li = document.createElement("li");
  li.className = "cat-excluded";
  const row = document.createElement("div");
  row.className = "cat-row";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.textContent = `${sgd.format(cents / 100)} · not counted`;
  row.append(name, value);
  li.append(row);
  return li;
}

function categoryRow(labelText, cents, maxCents) {
  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "cat-row";
  const label = document.createElement("span");
  label.textContent = labelText;
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

  // the amount field doubles as a calculator: "405/4" saves as 101.25
  const amount = evaluateAmount(expenseForm.amount.value);
  if (amount === null || amount <= 0 || amount > 99999999) {
    showFormStatus("Check the amount — a number like 12.40, or a sum like 405/4.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  const fields = {
    amount,
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
    updateAmountPreview();
    // show the month the entry landed in, so the save is always visible
    // even while browsing an older month
    dashDate = startOfMonth(new Date(fields.date + "T00:00:00"));
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
  updateAmountPreview();
});

// ── inline amount calculator (v1.1 piece 4) ─────────────────────────

function updateAmountPreview() {
  const text = expenseForm.amount.value;
  if (!hasOperator(text)) {
    amountPreview.hidden = true;
    return;
  }
  const result = evaluateAmount(text);
  amountPreview.hidden = false;
  amountPreview.textContent = result === null ? "= …" : `= ${sgd.format(result)}`;
}

expenseForm.amount.addEventListener("input", updateAmountPreview);

// The iOS decimal keypad has no operator keys — these chips insert
// them. pointerdown + preventDefault keeps focus (and the keypad) in
// the amount field.
for (const button of document.querySelectorAll(".calc-op")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    expenseForm.amount.value += button.dataset.op;
    expenseForm.amount.focus({ preventScroll: true });
    updateAmountPreview();
  });
}

function startEdit(expense) {
  editingId = expense.id;
  expenseForm.amount.value = expense.amount;
  updateAmountPreview();
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

// ── category manager (v1.1 piece 2b) ─────────────────────────────────

function renderCategoryOptions() {
  const selected = categorySelect.value;
  categorySelect.replaceChildren(
    ...categoriesCache.map((c) => new Option(categoryLabel(c), c.id)),
  );
  // keep the user's pick across refreshes when it still exists
  if ([...categorySelect.options].some((o) => o.value === selected)) {
    categorySelect.value = selected;
  }

  // the ledger's category filter mirrors the list, plus "All"
  ledgerCategorySelect.replaceChildren(
    new Option("All categories", "all"),
    ...categoriesCache.map((c) => new Option(categoryLabel(c), c.id)),
  );
  if ([...ledgerCategorySelect.options].some((o) => o.value === ledgerCategory)) {
    ledgerCategorySelect.value = ledgerCategory;
  } else {
    ledgerCategory = "all"; // the filtered category was deleted
    renderLedger(expensesCache);
  }
}

function renderCategoryManager() {
  catList.replaceChildren(
    ...categoriesCache.map((category) => {
      const li = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cat-manage-row";
      const label = document.createElement("span");
      label.textContent = categoryLabel(category);
      row.append(label);
      if (category.excluded_from_totals) {
        const badge = document.createElement("span");
        badge.className = "cat-badge";
        badge.textContent = "not counted";
        row.append(badge);
      }
      row.addEventListener("click", () => openCategoryDialog(category));
      li.append(row);
      return li;
    }),
  );
}

async function refreshCategories() {
  categoriesCache = await fetchCategories();
  renderCategoryOptions();
  renderCategoryManager();
}

document.getElementById("cat-add").addEventListener("click", () => openCategoryDialog(null));

// Header 🗃️: the card lives below the ledger (rare-use), but reaching
// it must not require scrolling past the whole ledger — same pattern
// as the 💡 idea jump. The glide is hand-rolled: iOS PWAs silently
// ignore smooth scrollIntoView (💡 only glides because focusing its
// input makes iOS animate toward the keyboard). Phone-found 2026-07-29.
function glideTo(element) {
  const start = window.scrollY;
  const target = Math.min(
    element.getBoundingClientRect().top + start,
    document.scrollingElement.scrollHeight - window.innerHeight,
  );
  const duration = 400;
  let t0 = null;
  let started = false;
  function step(ts) {
    started = true;
    t0 ??= ts;
    const p = Math.min((ts - t0) / duration, 1);
    const eased = 1 - (1 - p) ** 3;
    window.scrollTo(0, start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  // Frames can be suspended (backgrounded/embedded webviews) — never
  // strand the tap: jump instantly if no frame ran.
  setTimeout(() => {
    if (!started) window.scrollTo(0, target);
  }, 100);
}

document.getElementById("cat-jump").addEventListener("click", () => {
  showTab("money"); // the card lives in the Money panel
  glideTo(document.querySelector(".cat-card"));
});

function openCategoryDialog(category) {
  dialogCategoryId = category?.id ?? null;
  catDialogTitle.textContent = category ? "Edit category" : "Add category";
  catForm.icon.value = category?.icon ?? "";
  catForm.name.value = category?.name ?? "";
  catForm.excluded.checked = Boolean(category?.excluded_from_totals);
  catDeleteBtn.hidden = category === null;
  showCatStatus(null);
  catDialog.showModal();
}

catForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = catForm.name.value.trim();
  if (!name) {
    showCatStatus("Give it a name.");
    return;
  }
  const fields = {
    name,
    icon: catForm.icon.value.trim() || null,
    excluded_from_totals: catForm.excluded.checked,
  };
  try {
    if (dialogCategoryId === null) {
      // new categories go to the end of the list
      const maxSort = Math.max(0, ...categoriesCache.map((c) => c.sort_order ?? 0));
      await addCategory({ ...fields, sort_order: maxSort + 1 });
    } else {
      await updateCategory(dialogCategoryId, fields);
    }
    catDialog.close();
    await refreshCategories();
    await refresh(); // ledger + dashboard labels may have changed
  } catch (error) {
    showCatStatus(friendlyCategoryError(error));
  }
});

document.getElementById("cat-cancel").addEventListener("click", () => catDialog.close());

catDeleteBtn.addEventListener("click", async () => {
  const category = categoriesCache.find((c) => c.id === dialogCategoryId);
  if (!category) return;
  const others = categoriesCache.filter((c) => c.id !== category.id);
  if (others.length === 0) {
    showCatStatus("Can't delete the only category.");
    return;
  }
  catDialog.close();
  catDeleteTarget.replaceChildren(...others.map((c) => new Option(categoryLabel(c), c.id)));
  catDeleteInfo.textContent = `Counting entries in ${categoryLabel(category)}…`;
  showCatDeleteStatus(null);
  catDeleteDialog.showModal();
  try {
    const count = await countExpensesForCategory(category.id);
    catDeleteInfo.textContent =
      count === 0
        ? `No entries use ${categoryLabel(category)}.`
        : `${count} ${count === 1 ? "entry" : "entries"} will move out of ${categoryLabel(category)}.`;
  } catch {
    catDeleteInfo.textContent = `Couldn't count entries in ${categoryLabel(category)} — the move below still works.`;
  }
});

catDeleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCatDeleteStatus(null);
  try {
    await reassignAndDeleteCategory(dialogCategoryId, Number(catDeleteTarget.value));
    catDeleteDialog.close();
    await refreshCategories();
    await refresh();
  } catch (error) {
    showCatDeleteStatus(
      error.message?.includes("fetch")
        ? "No connection — nothing was changed."
        : `Couldn't delete: ${error.message}`,
    );
  }
});

document.getElementById("cat-delete-cancel").addEventListener("click", () => catDeleteDialog.close());

function friendlyCategoryError(error) {
  if (error.message?.includes("duplicate key")) return "That name already exists.";
  if (error.message?.includes("fetch")) return "No connection — not saved.";
  return `Couldn't save: ${error.message}`;
}

function showCatStatus(message) {
  catStatus.textContent = message ?? "";
  catStatus.hidden = !message;
}

function showCatDeleteStatus(message) {
  catDeleteStatus.textContent = message ?? "";
  catDeleteStatus.hidden = !message;
}

// ── idea box: raw friction inbox for the usage trial ─────────────────

// Header 💡: capture must stay one tap away. Since v1.2 the card lives
// on its own tab; focus() inside the tap handler opens the keyboard.
document.getElementById("idea-jump").addEventListener("click", () => {
  showTab("ideas");
  ideaForm.body.focus({ preventScroll: true });
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

// ── tabs (v1.2 ship 1) ───────────────────────────────────────────────

// Always opens on Money — the app is an input tool first (the same
// rationale as v1.1's entry-first layout); the other tabs are one tap.
const tabPanels = {
  money: document.getElementById("tab-money"),
  todos: document.getElementById("tab-todos"),
  ideas: document.getElementById("tab-ideas"),
};
const tabButtons = {
  money: document.getElementById("tab-btn-money"),
  todos: document.getElementById("tab-btn-todos"),
  ideas: document.getElementById("tab-btn-ideas"),
};

function showTab(name) {
  for (const key of Object.keys(tabPanels)) {
    tabPanels[key].hidden = key !== name;
    tabButtons[key].setAttribute("aria-selected", String(key === name));
  }
  window.scrollTo(0, 0);
}

for (const [name, button] of Object.entries(tabButtons)) {
  button.addEventListener("click", () => showTab(name));
}

// ── to-dos: one shared household list (v1.2 ship 1) ──────────────────

let doneOpen = false; // collapsed by default; the open list is the point

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showTodoStatus(null);
  todoSubmit.disabled = true;
  todoSubmit.textContent = "Adding…";
  try {
    await addTodo({
      body: todoForm.body.value.trim(),
      due_date: todoForm.due_date.value || null,
      author: displayNameFor(currentUser) ?? currentUser?.email ?? "unknown",
    });
    todoForm.reset();
    await refreshTodos();
  } catch (error) {
    showTodoStatus(
      error.message?.includes("fetch")
        ? "No connection — to-do not saved."
        : `Couldn't save: ${error.message}`,
    );
  } finally {
    todoSubmit.disabled = false;
    todoSubmit.textContent = "Add";
  }
});

async function refreshTodos() {
  try {
    renderTodos(await fetchTodos());
  } catch (error) {
    showTodoStatus(
      error.message?.includes("fetch")
        ? "No connection — couldn't load to-dos."
        : `Couldn't load to-dos: ${error.message}`,
    );
  }
}

function renderTodos(todos) {
  const { open, done } = todosView(todos, todayISO());
  todoEmpty.hidden = open.length > 0;
  todoList.replaceChildren(...open.map(renderTodo));
  todoDoneToggle.hidden = done.length === 0;
  todoDoneToggle.textContent = `${doneOpen ? "Hide" : "Show"} done (${done.length})`;
  todoDoneList.hidden = !doneOpen || done.length === 0;
  todoDoneList.replaceChildren(...done.map(renderTodo));
}

todoDoneToggle.addEventListener("click", () => {
  doneOpen = !doneOpen;
  refreshTodos();
});

function renderTodo(todo) {
  const isDone = Boolean(todo.done_at);
  const li = document.createElement("li");
  if (isDone) li.className = "todo-done";

  // The tap target IS the checkbox — either account may check off (or
  // reopen) either person's item; RLS permits it by design.
  const check = document.createElement("button");
  check.type = "button";
  check.className = "todo-check";
  check.setAttribute("aria-label", isDone ? "Mark as not done" : "Mark as done");
  check.textContent = isDone ? "✓" : "";
  check.addEventListener("click", () => toggleTodo(todo));

  const main = document.createElement("div");
  main.className = "entry-main";

  const body = document.createElement("p");
  body.className = "entry-title todo-body";
  body.textContent = todo.body;

  const meta = document.createElement("p");
  meta.className = "entry-meta";
  const author = document.createElement("span");
  author.textContent = todo.author;
  meta.append(author);
  if (isDone) {
    const doneMeta = document.createElement("span");
    doneMeta.textContent = ` · done${todo.done_by ? ` by ${todo.done_by}` : ""} ${dateFmt.format(new Date(todo.done_at))}`;
    meta.append(doneMeta);
  } else if (todo.due_date) {
    const due = document.createElement("span");
    due.className = todo.overdue ? "todo-due-overdue" : "";
    due.textContent = ` · ${todo.overdue ? "overdue — was due" : "due"} ${dateFmt.format(new Date(todo.due_date + "T00:00:00"))}`;
    meta.append(due);
  }
  main.append(body, meta);

  const side = document.createElement("div");
  side.className = "entry-side";
  side.append(entryButton("Delete", () => confirmDeleteTodo(todo)));

  li.append(check, main, side);
  return li;
}

async function toggleTodo(todo) {
  const fields = todo.done_at
    ? { done_at: null, done_by: null }
    : {
        done_at: new Date().toISOString(),
        done_by: displayNameFor(currentUser) ?? currentUser?.email ?? "unknown",
      };
  try {
    await updateTodo(todo.id, fields);
    await refreshTodos();
  } catch (error) {
    showTodoStatus(
      error.message?.includes("fetch")
        ? "No connection — not updated."
        : `Couldn't update: ${error.message}`,
    );
  }
}

async function confirmDeleteTodo(todo) {
  if (!window.confirm(`Delete "${todo.body}"?`)) return;
  try {
    await deleteTodo(todo.id);
    await refreshTodos();
  } catch (error) {
    showTodoStatus(`Couldn't delete: ${error.message}`);
  }
}

function showTodoStatus(message) {
  todoStatus.textContent = message ?? "";
  todoStatus.hidden = !message;
}

// ── PWA ───────────────────────────────────────────────────────────────

// Version marker (v1.2 piece 0): set by js/version.js, shown so "which
// build is this phone on?" is answerable from a screenshot.
document.getElementById("app-version").textContent = `v${self.APP_VERSION}`;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .catch((error) => console.warn("Service worker registration failed:", error));
}
