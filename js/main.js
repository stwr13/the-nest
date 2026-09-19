import { supabase } from "./supabase.js";
import { displayNameFor } from "./identity.js";
import { summarize, categoryLabel, monthKey } from "./dashboard-math.js";
import { ledgerView, dayTotal, recentDayTotals, capGroups } from "./ledger-view.js";
import {
  nextDue,
  dueItems,
  upcomingItems,
  commitmentTotals,
  remaining,
  daysLate,
  monthlyEquivalentCents,
} from "./recurring-view.js";
import { todosView } from "./todos-view.js";
import { defaultCategoryId, defaultCardId, usageRank } from "./category-default.js";
import { cardSummary, bestNextCard, normalizeTags, allTags, cardsForTag } from "./cards-math.js";
import { evaluateAmount, hasOperator, leadingNumber } from "./amount-expr.js";
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
  fetchCards,
  addCard,
  updateCard,
  deleteCard,
  fetchCardImageUrls,
  fetchRecurring,
  addRecurring,
  confirmRecurring,
  skipRecurring,
  deactivateRecurring,
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
// Ledger cap (v1.13.0): 25 is the middle of Shawn's 20–30, and covers
// roughly the last fortnight at the household's real logging rate.
const LEDGER_CAP = 25;
let ledgerExpanded = false;
const ledgerMore = document.getElementById("ledger-more");
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
const todoCancel = document.getElementById("todo-cancel");
const buyForm = document.getElementById("buy-form");
const buyStatus = document.getElementById("buy-status");
const buySubmit = document.getElementById("buy-submit");
const buyEmpty = document.getElementById("buy-empty");
const buyList = document.getElementById("buy-list");
const buyDoneToggle = document.getElementById("buy-done-toggle");
const buyDoneList = document.getElementById("buy-done-list");
const buyCancel = document.getElementById("buy-cancel");
const cardSelect = document.getElementById("exp-card");
const cardsMonth = document.getElementById("cards-month");
const cardsHint = document.getElementById("cards-hint");
const cardsBest = document.getElementById("cards-best");
const cardsList = document.getElementById("cards-list");
const cardDialog = document.getElementById("card-dialog");
const cardForm = document.getElementById("card-form");
const cardDialogTitle = document.getElementById("card-dialog-title");
const cardStatus = document.getElementById("card-status");
const cardDeleteBtn = document.getElementById("card-delete");
const cardsTags = document.getElementById("cards-tags");

const sgd = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });
const dateFmt = new Intl.DateTimeFormat("en-SG", { weekday: "short", day: "numeric", month: "short" });
const shortDateFmt = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" });
// every stored date is a plain ISO day; the midday anchor keeps it from
// sliding a day under a timezone offset
const isoToDate = (iso) => new Date(iso + "T00:00:00");
const monthFmt = new Intl.DateTimeFormat("en-SG", { month: "long" });
const monthShortFmt = new Intl.DateTimeFormat("en-SG", { month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("en-SG", { weekday: "short" });
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
let cardsCache = [];
let cardImageUrls = new Map(); // card_id -> signed URL (private bucket)
let dialogCardId = null; // null while adding a new card
const cardPicker = document.getElementById("card-picker");
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
  showLoginError(null); // retire the boot watchdog's message once auth answers
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

// Boot watchdog (v1.12.1): the handler above is the only thing that
// unhides a view, and INITIAL_SESSION won't fire until supabase-js has
// refreshed an expired token — a network round-trip. On a cold open
// (first launch of the day, radio still waking) that refresh can hang,
// which used to leave the app permanently blank; close-and-reopen was
// the only cure. If no view is visible after 4s, surface the login view
// with a visible status line instead — never a silent blank. Whenever
// auth does answer, the handler wins: it clears this message and shows
// the correct view.
setTimeout(() => {
  if (!loginView.hidden || !appView.hidden) return; // auth already answered
  loginView.hidden = false;
  showLoginError("Still connecting — this screen will sort itself out in a moment.");
}, 4000);

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
    const [categories, cards, expenses] = await Promise.all([
      fetchCategories(),
      fetchCards(),
      fetchExpenses(),
    ]);
    categoriesCache = categories;
    cardsCache = cards;
    expensesCache = expenses; // before the picker syncs — it orders by usage
    // signed URLs for the private card images; on any failure the CSS
    // mini-cards simply stay — never let art block the ledger
    cardImageUrls = await fetchCardImageUrls(cards).catch(() => new Map());
    renderCategoryOptions();
    renderCategoryManager();
    renderCardOptions();
    // cold open lands on the category and card this user actually logs
    // most (v1.2.1 / v1.4 — picking the usual every time is friction).
    // Within a session, the last pick still sticks.
    const usual = defaultCategoryId(expenses, currentUser?.id, todayISO());
    if (usual !== null && [...categorySelect.options].some((o) => o.value === String(usual))) {
      categorySelect.value = String(usual);
    }
    const usualCard = defaultCardId(expenses, currentUser?.id, todayISO());
    if (usualCard !== null && [...cardSelect.options].some((o) => o.value === String(usualCard))) {
      cardSelect.value = String(usualCard);
    }
    syncCardPicker();
    renderAll(expenses);
  } catch (error) {
    showLedgerStatus(loadErrorMessage(error));
  }
  // Deliberately separate: the idea box and to-do list are auxiliary,
  // and their failures must never take the ledger down with them. Each
  // shows its errors in its own card via its refresh's catch.
  refreshIdeas();
  refreshTodos();
  refreshRecurring();
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
  renderCards(expenses);
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
  const { shown, hiddenEntries } = capGroups(groups, ledgerExpanded ? null : LEDGER_CAP);
  // textContent throughout: notes are user input and must never be
  // interpreted as HTML
  ledgerList.replaceChildren(
    // the FYI on the newest header glances back over calendar days, so
    // it reads the FULL group list — the cap is a display limit, never
    // a change to what the numbers mean
    ...shown.flatMap((group, i) => [
      dayHeader(group.date, group.items, i === 0 ? groups : null),
      ...group.items.map(renderEntry),
    ]),
  );
  renderLedgerMore(hiddenEntries);
}

// The expand control only appears when something is actually hidden —
// a "show all" on a list that already shows all is a lie about length.
function renderLedgerMore(hiddenEntries) {
  if (hiddenEntries > 0) {
    ledgerMore.hidden = false;
    ledgerMore.textContent = `Show all — ${hiddenEntries} more ${hiddenEntries === 1 ? "entry" : "entries"}`;
  } else if (ledgerExpanded) {
    ledgerMore.hidden = false;
    ledgerMore.textContent = `Show recent only`;
  } else {
    ledgerMore.hidden = true;
  }
}

// v1.10: the header carries the day's counted total beside the date
// (Claire's ask) — it sums the rows *as filtered*, so filtering to one
// person shows that person's days. The newest header's right side
// glances back at the two days before it (Shawn's layout), whole
// dollars per the trend-glance convention.
function dayHeader(date, items, fyiGroups) {
  const li = document.createElement("li");
  li.className = "day-header";
  const day = document.createElement("span");
  day.textContent = dateFmt.format(new Date(date + "T00:00:00"));
  const total = dayTotal(items);
  let sum = null;
  if (total !== null) {
    sum = document.createElement("span");
    sum.className = "day-total";
    sum.textContent = sgd.format(total);
  }
  // the newest header carries the most text — one pill around the day
  // AND its total anchors the eye; the FYI reads as its satellite
  if (fyiGroups) {
    const pill = document.createElement("span");
    pill.className = "day-current";
    pill.append(day);
    if (sum) pill.append(sum);
    li.append(pill);
  } else {
    li.append(day);
    if (sum) li.append(sum);
  }
  if (fyiGroups) {
    const fyi = document.createElement("span");
    fyi.className = "day-fyi";
    fyi.textContent = recentDayTotals(fyiGroups, date)
      .map((d) => `${weekdayFmt.format(new Date(d.date + "T00:00:00"))} ${sgdWhole.format(d.total)}`)
      .join(" · ");
    li.append(fyi);
  }
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
  li.dataset.id = expense.id; // the saved-jump's landing anchor

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
  const { thisCents, byCategory, prevByCategory, past, excluded } = summarize(expenses, dashDate);
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
  const prevLabel = monthShortFmt.format(shiftMonth(dashDate, -1));
  dashCats.replaceChildren(
    ...rows.map(([label, cents]) =>
      categoryRow(label, cents, maxCents, prevByCategory.get(label), prevLabel),
    ),
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
  renderCards(expensesCache); // the cards area follows the viewed month
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

// v1.13.0: each bar carries its own month-on-month move. Shawn, during
// the 2b review: "we might compare or analyse which category we spent
// more in comparison" — the data model always supported it (every entry
// keeps category_id + date), only the delta was missing. Shown only
// where last month actually has that category: a delta against nothing
// is not a 100% rise, it's a category that didn't exist yet.
function categoryRow(labelText, cents, maxCents, prevCents, prevLabel) {
  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "cat-row";
  const label = document.createElement("span");
  label.textContent = labelText;

  const values = document.createElement("span");
  values.className = "cat-values";
  const value = document.createElement("span");
  value.textContent = sgd.format(cents / 100);
  values.append(value);

  if (prevCents > 0) {
    const diff = cents - prevCents;
    const delta = document.createElement("span");
    delta.className = "cat-delta";
    if (diff === 0) {
      delta.textContent = `same as ${prevLabel}`;
    } else {
      // up is the direction worth noticing in a spending list, so it
      // takes the alert colour — semantic, not decorative
      delta.classList.add(diff > 0 ? "cat-delta-up" : "cat-delta-down");
      const arrow = diff > 0 ? "▲" : "▼";
      delta.textContent = `${arrow} ${sgdWhole.format(Math.round(Math.abs(diff) / 100))} vs ${prevLabel}`;
    }
    values.append(delta);
  }

  row.append(label, values);

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

  // group-bill split (v1.8.2 — Shawn: "not me having to input the
  // total again"): the expression already contains both truths —
  // "815÷5×2" charges the card 815 and records 326 as the expense.
  let expenseAmount = amount;
  let cardCharged = null;
  if (expenseForm.split.checked) {
    const charged = leadingNumber(expenseForm.amount.value);
    // equal means no real split was expressed — store nothing extra
    cardCharged = charged !== null && charged !== amount ? charged : null;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  const fields = {
    amount: expenseAmount,
    category_id: Number(expenseForm.category_id.value),
    // "" only ever appears while editing a pre-v1.4 untagged entry
    card_id: expenseForm.card_id.value === "" ? null : Number(expenseForm.card_id.value),
    card_charged: cardCharged,
    paid_by: expenseForm.paid_by.value,
    date: expenseForm.date.value,
    // textarea since v1.11 — collapse newlines: notes are one thought
    note: expenseForm.note.value.replace(/\s+/g, " ").trim() || null,
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

    let savedId = editingId;
    if (editingId === null) savedId = await addExpense(fields);
    else await updateExpense(editingId, fields);
    exitEditMode();
    expenseForm.amount.value = "";
    resetSplit();
    expenseForm.note.value = "";
    resizeNote();
    updateAmountPreview();
    // show the month the entry landed in, so the save is always visible
    // even while browsing an older month
    dashDate = startOfMonth(new Date(fields.date + "T00:00:00"));
    await refresh();
    // v1.10: offer the check without forcing it — a tap glides to the
    // saved row; auto-scrolling would hijack back-to-back logging
    showSavedJump(savedId, editingId === null ? fields : null);
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
  resetSplit();
  expenseForm.note.value = "";
  resizeNote();
  updateAmountPreview();
});

// ── group-bill split UI (v1.8.2) ─────────────────────────────────────
// One checkbox, no second field: the live legend shows exactly what
// will be saved — "Card charged $815 · our expense $326" — derived
// from the expression's first number and its result.

const splitLegend = document.getElementById("split-legend");

expenseForm.split.addEventListener("change", updateSplitLegend);

function resetSplit() {
  expenseForm.split.checked = false;
  updateSplitLegend();
}

function updateSplitLegend() {
  if (!expenseForm.split.checked) {
    splitLegend.hidden = true;
    return;
  }
  const charged = leadingNumber(expenseForm.amount.value);
  const share = evaluateAmount(expenseForm.amount.value);
  splitLegend.hidden = false;
  if (charged === null || share === null) {
    splitLegend.textContent = "Type the bill as a sum — e.g. 815÷5×2";
  } else if (charged === share) {
    splitLegend.textContent = `Card charged ${sgd.format(charged)} — add ÷ or × to record a smaller share`;
  } else {
    splitLegend.textContent = `Card charged ${sgd.format(charged)} · our expense ${sgd.format(share)}`;
  }
}

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

// v1.11: the note grows with its content — you see what you type
const noteField = document.getElementById("exp-note");
function resizeNote() {
  noteField.style.height = "auto";
  noteField.style.height = `${noteField.scrollHeight}px`;
}
noteField.addEventListener("input", resizeNote);

expenseForm.amount.addEventListener("input", () => {
  savedLine.hidden = true; // typing the next entry retires the offer
  updateAmountPreview();
  updateSplitLegend();
});

// The iOS decimal keypad has no operator keys — these chips insert
// them. pointerdown + preventDefault keeps focus (and the keypad) in
// the amount field.
for (const button of document.querySelectorAll(".calc-op")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    expenseForm.amount.value += button.dataset.op;
    expenseForm.amount.focus({ preventScroll: true });
    updateAmountPreview();
    updateSplitLegend();
  });
}

function startEdit(expense) {
  editingId = expense.id;
  // A split entry reopens as a synthesized sum whose first number is
  // the card charge and whose result is the expense — same contract
  // as capture ("815-489" → card 815, expense 326); the legend
  // explains it on sight. The original typed expression isn't stored.
  if (expense.card_charged != null) {
    const diff = Math.round((expense.card_charged - expense.amount) * 100) / 100;
    expenseForm.amount.value =
      diff >= 0
        ? `${expense.card_charged}-${diff}`
        : `${expense.card_charged}+${Math.abs(diff)}`;
    expenseForm.split.checked = true;
  } else {
    expenseForm.amount.value = expense.amount;
    expenseForm.split.checked = false;
  }
  updateAmountPreview();
  updateSplitLegend();
  expenseForm.category_id.value = String(expense.category_id);
  setCardSelectValue(expense.card_id);
  expenseForm.paid_by.value = expense.paid_by;
  expenseForm.date.value = expense.date;
  expenseForm.note.value = expense.note ?? "";
  resizeNote();
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
  clearTempCardOption();
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
    const header = "date,amount,card_charged,category,paid_by,card,note";
    const lines = rows.map((r) =>
      [r.date, r.amount, r.card_charged ?? "", r.categories.name, r.paid_by, r.cards?.name ?? "", r.note ?? ""]
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

  const recSelected = recCategorySelect.value;
  recCategorySelect.replaceChildren(
    ...categoriesCache.map((c) => new Option(categoryLabel(c), c.id)),
  );
  if ([...recCategorySelect.options].some((o) => o.value === recSelected)) {
    recCategorySelect.value = recSelected;
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

// ── cards + miles caps (v1.4) ────────────────────────────────────────
// The at-the-shop answer: per card, what this month absorbed vs its
// bonus cap. Math in cards-math.js (pure, Node-tested); this renders
// the viewed month (follows the dashboard's ‹ › navigation).

function renderCardOptions() {
  const selected = cardSelect.value;
  cardSelect.replaceChildren(...cardsCache.map((c) => new Option(c.name, c.id)));
  if ([...cardSelect.options].some((o) => o.value === selected)) {
    cardSelect.value = selected;
  }

  const recSelected = recCardSelect.value;
  recCardSelect.replaceChildren(...cardsCache.map((c) => new Option(c.name, c.id)));
  if ([...recCardSelect.options].some((o) => o.value === recSelected)) {
    recCardSelect.value = recSelected;
  }
  syncCardPicker();
}

// The visual picker (v1.7): tappable card faces driving the hidden
// select. Rebuilt from the select's own options so the two can never
// disagree — including the temporary "(unspecified)" option while
// editing a pre-card entry.
function miniCardArt(card) {
  const url = card && cardImageUrls.get(card.id);
  if (url) {
    const img = document.createElement("img");
    img.className = "mini-card-img";
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }
  const art = document.createElement("span");
  art.className = "mini-card";
  art.style.setProperty("--card-c", card?.color ?? "#3a7d5c");
  return art;
}

// Tiles that share a face (the two Solitaire buckets, the two PPV
// tracks) are told apart by the part after the "·" — the face already
// names the card, the label names the bucket.
function cardPickLabel(name) {
  return name.includes("·") ? name.split("·").pop().trim() : name;
}

function syncCardPicker() {
  const options = [...cardSelect.options];
  cardPicker.hidden = options.length === 0;
  cardSelect.hidden = options.length > 0; // picker takes over once cards exist
  // v1.7.1: a wrapped GRID, everything visible, one tap — Shawn: the
  // slide-strip hid most cards. Your most-used cards take the top-left
  // (per-person usage rank); never-used ones keep the manager's order.
  const rank = usageRank(expensesCache, currentUser?.id, todayISO(), (e) => e.card_id);
  const ordered = [...options].sort((a, b) => {
    if (a.value === "") return -1; // "(unspecified)" stays first while editing
    if (b.value === "") return 1;
    return (
      (rank.get(Number(a.value)) ?? 999) - (rank.get(Number(b.value)) ?? 999) ||
      options.indexOf(a) - options.indexOf(b)
    );
  });
  cardPicker.replaceChildren(
    ...ordered.map((o) => {
      const card = cardsCache.find((c) => String(c.id) === o.value);
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "card-pick";
      pick.setAttribute("role", "option");
      pick.setAttribute("aria-selected", String(o.value === cardSelect.value));
      pick.append(miniCardArt(card));
      const name = document.createElement("span");
      name.className = "card-pick-name";
      name.textContent = card ? cardPickLabel(card.name) : o.textContent;
      pick.append(name);
      pick.addEventListener("click", () => {
        cardSelect.value = o.value;
        syncCardPicker();
      });
      return pick;
    }),
  );
}

// Editing a pre-v1.4 entry: card unknown. A temporary "(unspecified)"
// option keeps the edit honest — saving without picking keeps null,
// but the option vanishes once the edit ends so new entries must pick.
function setCardSelectValue(cardId) {
  clearTempCardOption();
  if (cardId != null) {
    cardSelect.value = String(cardId);
    syncCardPicker();
    return;
  }
  const temp = new Option("(unspecified)", "");
  temp.dataset.temp = "1";
  cardSelect.prepend(temp);
  cardSelect.value = "";
  syncCardPicker();
}

function clearTempCardOption() {
  cardSelect.querySelector('option[data-temp]')?.remove();
  syncCardPicker();
}

let activeTag = null; // the tapped "which card for…" chip

function renderCards(expenses) {
  const summary = cardSummary(expenses, cardsCache, dashDate);
  cardsMonth.textContent = `· ${monthShortFmt.format(dashDate)}`;
  const capped = summary.filter((c) => c.capCents != null);
  cardsHint.hidden = capped.length > 0;

  // "Which card for…" chips — vocabulary comes from the cards' own
  // earn tags, so it can never disagree with the data
  const tags = allTags(cardsCache);
  if (activeTag && !tags.includes(activeTag)) activeTag = null;
  cardsTags.hidden = tags.length === 0;
  cardsTags.replaceChildren(
    ...tags.map((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.textContent = tag;
      chip.setAttribute("aria-pressed", String(tag === activeTag));
      chip.addEventListener("click", () => {
        activeTag = activeTag === tag ? null : tag;
        renderCards(expensesCache);
      });
      return chip;
    }),
  );

  // busiest cards first for the viewed month (v1.5.1, Shawn's ask);
  // ties fall back to the manager's sort order
  let displayOrder = [...summary].sort(
    (a, b) => b.spentCents - a.spentCents || (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  let matchedIds = null;
  if (activeTag) {
    const { ranked, best } = cardsForTag(summary, activeTag);
    matchedIds = new Set(ranked.map((c) => c.id));
    displayOrder = [...ranked, ...displayOrder.filter((c) => !matchedIds.has(c.id))];
    cardsBest.hidden = false;
    if (best) {
      cardsBest.textContent =
        best.capCents == null
          ? `For ${activeTag}: ${best.name} — no cap to worry about`
          : `For ${activeTag}: ${best.name} — ${sgd.format(best.remainingCents / 100)} to cap`;
    } else {
      cardsBest.textContent = `All ${activeTag} cards are capped out this month.`;
    }
  } else {
    const best = bestNextCard(summary);
    cardsBest.hidden = !(best && capped.length >= 2);
    if (best) {
      cardsBest.textContent = `Most headroom: ${best.name} — ${sgd.format(best.remainingCents / 100)} to cap`;
    }
  }

  cardsList.replaceChildren(
    ...displayOrder.map((c) => {
      const li = document.createElement("li");
      if (matchedIds && !matchedIds.has(c.id)) li.className = "card-dim";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cat-manage-row card-row";
      row.addEventListener("click", () => openCardDialog(cardsCache.find((x) => x.id === c.id)));

      // real card face when the private bucket has one (v1.7),
      // CSS-drawn mini card (v1.6) as the ever-present fallback
      const art = miniCardArt(c);

      const left = document.createElement("span");
      left.className = "card-row-name";
      left.textContent = c.name;
      if (c.note) {
        const note = document.createElement("span");
        note.className = "card-row-note";
        note.textContent = c.note;
        left.append(note);
      }

      const right = document.createElement("span");
      right.className = "card-row-amount";
      if (c.capCents == null) {
        right.textContent = sgd.format(c.spentCents / 100);
      } else if (c.overCap) {
        right.textContent = `${sgd.format(c.spentCents / 100)} · cap hit`;
        right.classList.add("card-over");
      } else {
        right.textContent = `${sgd.format(c.spentCents / 100)} of ${sgdWhole.format(Math.round(c.capCents / 100))}`;
      }
      row.append(art, left, right);
      li.append(row);

      if (c.capCents != null) {
        const bar = document.createElement("div");
        bar.className = "cat-bar";
        const fill = document.createElement("div");
        fill.className = c.overCap ? "cat-bar-fill card-bar-over" : "cat-bar-fill";
        fill.style.width = `${Math.min(100, Math.round((c.spentCents / c.capCents) * 100))}%`;
        bar.append(fill);
        li.append(bar);
      }
      return li;
    }),
  );
}

async function refreshCards() {
  cardsCache = await fetchCards();
  cardImageUrls = await fetchCardImageUrls(cardsCache).catch(() => new Map());
  renderCardOptions();
  renderCards(expensesCache);
}

document.getElementById("card-add").addEventListener("click", () => openCardDialog(null));

function openCardDialog(card) {
  dialogCardId = card?.id ?? null;
  cardDialogTitle.textContent = card ? "Edit card" : "Add card";
  cardForm.name.value = card?.name ?? "";
  cardForm.color.value = card?.color ?? "#3a7d5c";
  cardForm.image.value = card?.image ?? "";
  cardForm.cap.value = card?.cap ?? "";
  cardForm.tags.value = (card?.earn_types ?? []).join(", ");
  cardForm.note.value = card?.note ?? "";
  cardDeleteBtn.hidden = card === null;
  showCardStatus(null);
  cardDialog.showModal();
}

cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = cardForm.name.value.trim();
  if (!name) {
    showCardStatus("Give it a name.");
    return;
  }
  const capText = cardForm.cap.value.trim();
  const cap = capText === "" ? null : Number(capText);
  if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) {
    showCardStatus("Cap should be a plain amount, like 1000.");
    return;
  }
  const fields = {
    name,
    cap,
    color: cardForm.color.value,
    image: cardForm.image.value.trim() || null,
    earn_types: normalizeTags(cardForm.tags.value),
    note: cardForm.note.value.trim() || null,
  };
  try {
    if (dialogCardId === null) {
      const maxSort = Math.max(0, ...cardsCache.map((c) => c.sort_order ?? 0));
      await addCard({ ...fields, sort_order: maxSort + 1 });
    } else {
      await updateCard(dialogCardId, fields);
    }
    cardDialog.close();
    await refreshCards();
  } catch (error) {
    showCardStatus(friendlyCardError(error));
  }
});

cardDeleteBtn.addEventListener("click", async () => {
  const card = cardsCache.find((c) => c.id === dialogCardId);
  if (!card) return;
  if (cardsCache.length === 1) {
    showCardStatus("Can't delete the only card.");
    return;
  }
  if (!window.confirm(`Delete ${card.name}?`)) return;
  try {
    await deleteCard(card.id);
    cardDialog.close();
    await refreshCards();
  } catch (error) {
    showCardStatus(
      error.message?.includes("foreign key") || error.code === "23503"
        ? "This card has entries — it can't be deleted. Rename it instead."
        : friendlyCardError(error),
    );
  }
});

document.getElementById("card-cancel").addEventListener("click", () => cardDialog.close());

function friendlyCardError(error) {
  if (error.message?.includes("duplicate key")) return "That name already exists.";
  if (error.message?.includes("fetch")) return "No connection — not saved.";
  return `Couldn't save: ${error.message}`;
}

function showCardStatus(message) {
  cardStatus.textContent = message ?? "";
  cardStatus.hidden = !message;
}

// ── idea box: raw friction inbox for the usage trial ─────────────────

// Header 💡: capture must stay one tap away. The card lives at the
// bottom of Money (v1.3.2 — its tab was noise, Shawn's call); focus()
// inside the tap handler opens the keyboard, and on iOS the keyboard
// animation is what actually scrolls the card into view.
document.getElementById("idea-jump").addEventListener("click", () => {
  showTab("money");
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
  if (message) savedLine.hidden = true; // an error replaces the offer
}

// ── saved-jump (v1.10) ────────────────────────────────────────────────
// After a save, "check it in the ledger ↓" glides to the new row and
// flashes it — the verification trip without the scroll (Shawn's ask).
const savedLine = document.getElementById("form-saved");
let lastSavedId = null;
let lastSavedFields = null;
const savedRecurring = document.getElementById("saved-recurring");

function showSavedJump(id, fields = null) {
  lastSavedId = id;
  lastSavedFields = fields;
  // the offer only makes sense for a fresh expense with a note to name
  // the commitment after — an edit is not a new standing charge
  savedRecurring.hidden = !(fields && fields.note);
  savedLine.hidden = false;
}

ledgerMore.addEventListener("click", () => {
  ledgerExpanded = !ledgerExpanded;
  renderLedger(expensesCache);
  if (!ledgerExpanded) glideTo(document.querySelector(".ledger-card"));
});

document.getElementById("saved-jump").addEventListener("click", () => {
  let row = lastSavedId === null ? null : ledgerList.querySelector(`li[data-id="${lastSavedId}"]`);
  if (!row && lastSavedId !== null && !ledgerExpanded) {
    // the cap is hiding it (an edit to an old entry keeps its old date,
    // so the row can sit below the fold) — expand before giving up
    ledgerExpanded = true;
    renderLedger(expensesCache);
    row = ledgerList.querySelector(`li[data-id="${lastSavedId}"]`);
  }
  if (!row && lastSavedId !== null) {
    // the active filter hides the new row — reset to All so the check
    // can land; a jump that arrives nowhere reads as a lost entry
    ledgerFilter = "all";
    ledgerCategory = "all";
    document.querySelector('#ledger-filter input[value="all"]').checked = true;
    ledgerCategorySelect.value = "all";
    renderLedger(expensesCache);
    row = ledgerList.querySelector(`li[data-id="${lastSavedId}"]`);
  }
  if (!row) {
    // no id or the row is gone — still honour the tap: land on the ledger
    glideTo(document.querySelector(".ledger-card"));
    return;
  }
  glideTo(row);
  row.classList.remove("entry-flash");
  void row.offsetWidth; // restart the animation on a repeat tap
  row.classList.add("entry-flash");
});

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
  buy: document.getElementById("tab-buy"),
  rec: document.getElementById("tab-rec"),
};
const tabButtons = {
  money: document.getElementById("tab-btn-money"),
  todos: document.getElementById("tab-btn-todos"),
  buy: document.getElementById("tab-btn-buy"),
  rec: document.getElementById("tab-btn-rec"),
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

// ── to-dos + to-buy: two shared household lists (v1.2 ship 1 / v1.3) ─
// One table backs both; `list` discriminates. The shopping list exists
// because the household was already running it over Telegram — this
// brings that workflow home (2026-08-12).

let todosCacheRows = [];
let doneOpenTodo = false; // collapsed by default; the open list is the point
let doneOpenBuy = false;
// v1.3.1: items are edited through their list's form (the expense-form
// pattern) — urgency, wording, and due date all change via Edit, so
// the row itself carries just Edit/Delete (Shawn: the toggle crowded it)
let todoEditingId = null;
let buyEditingId = null;

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showTodoStatus(null);
  todoSubmit.disabled = true;
  todoSubmit.textContent = todoEditingId === null ? "Adding…" : "Updating…";
  try {
    const fields = {
      body: todoForm.body.value.trim(),
      due_date: todoForm.due_date.value || null,
      urgent: todoForm.urgent.checked,
    };
    if (todoEditingId === null) {
      await addTodo({
        ...fields,
        author: displayNameFor(currentUser) ?? currentUser?.email ?? "unknown",
      });
    } else {
      await updateTodo(todoEditingId, fields);
    }
    exitTodoEdit();
    await refreshTodos();
  } catch (error) {
    showTodoStatus(
      error.message?.includes("fetch")
        ? "No connection — to-do not saved."
        : `Couldn't save: ${error.message}`,
    );
  } finally {
    todoSubmit.disabled = false;
    todoSubmit.textContent = todoEditingId === null ? "Add" : "Update";
  }
});

todoCancel.addEventListener("click", exitTodoEdit);

function exitTodoEdit() {
  todoEditingId = null;
  todoForm.reset();
  todoSubmit.textContent = "Add";
  todoCancel.hidden = true;
}

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
  todosCacheRows = todos;
  const t = todosView(todos, todayISO(), "todo");
  todoEmpty.hidden = t.open.length > 0;
  todoList.replaceChildren(...t.open.map(renderTodo));
  todoDoneToggle.hidden = t.done.length === 0;
  todoDoneToggle.textContent = `${doneOpenTodo ? "Hide" : "Show"} done (${t.done.length})`;
  todoDoneList.hidden = !doneOpenTodo || t.done.length === 0;
  todoDoneList.replaceChildren(...t.done.map(renderTodo));

  const s = todosView(todos, todayISO(), "shopping");
  buyEmpty.hidden = s.open.length > 0;
  buyList.replaceChildren(...s.open.map(renderTodo));
  buyDoneToggle.hidden = s.done.length === 0;
  buyDoneToggle.textContent = `${doneOpenBuy ? "Hide" : "Show"} bought (${s.done.length})`;
  buyDoneList.hidden = !doneOpenBuy || s.done.length === 0;
  buyDoneList.replaceChildren(...s.done.map(renderTodo));
}

// toggles re-render from cache — no refetch for a view change
todoDoneToggle.addEventListener("click", () => {
  doneOpenTodo = !doneOpenTodo;
  renderTodos(todosCacheRows);
});

buyDoneToggle.addEventListener("click", () => {
  doneOpenBuy = !doneOpenBuy;
  renderTodos(todosCacheRows);
});

buyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showBuyStatus(null);
  buySubmit.disabled = true;
  buySubmit.textContent = buyEditingId === null ? "Adding…" : "Updating…";
  try {
    const fields = {
      body: buyForm.body.value.trim(),
      urgent: buyForm.urgent.checked,
    };
    if (buyEditingId === null) {
      await addTodo({
        ...fields,
        list: "shopping",
        author: displayNameFor(currentUser) ?? currentUser?.email ?? "unknown",
      });
    } else {
      await updateTodo(buyEditingId, fields);
    }
    exitBuyEdit();
    await refreshTodos();
  } catch (error) {
    showBuyStatus(
      error.message?.includes("fetch")
        ? "No connection — item not saved."
        : `Couldn't save: ${error.message}`,
    );
  } finally {
    buySubmit.disabled = false;
    buySubmit.textContent = buyEditingId === null ? "Add" : "Update";
  }
});

buyCancel.addEventListener("click", exitBuyEdit);

function exitBuyEdit() {
  buyEditingId = null;
  buyForm.reset();
  buySubmit.textContent = "Add";
  buyCancel.hidden = true;
}

function startTodoEdit(todo) {
  if ((todo.list ?? "todo") === "shopping") {
    buyEditingId = todo.id;
    buyForm.body.value = todo.body;
    buyForm.urgent.checked = Boolean(todo.urgent);
    buySubmit.textContent = "Update";
    buyCancel.hidden = false;
    glideTo(buyForm);
  } else {
    todoEditingId = todo.id;
    todoForm.body.value = todo.body;
    todoForm.due_date.value = todo.due_date ?? "";
    todoForm.urgent.checked = Boolean(todo.urgent);
    todoSubmit.textContent = "Update";
    todoCancel.hidden = false;
    glideTo(todoForm);
  }
}

function showBuyStatus(message) {
  buyStatus.textContent = message ?? "";
  buyStatus.hidden = !message;
}

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
  if (todo.urgent && !isDone) {
    const tag = document.createElement("span");
    tag.className = "todo-urgent-tag";
    tag.textContent = "urgent · ";
    meta.append(tag);
  }
  const author = document.createElement("span");
  author.textContent = todo.author;
  meta.append(author);
  if (isDone) {
    const doneWord = (todo.list ?? "todo") === "shopping" ? "bought" : "done";
    const doneMeta = document.createElement("span");
    doneMeta.textContent = ` · ${doneWord}${todo.done_by ? ` by ${todo.done_by}` : ""} ${dateFmt.format(new Date(todo.done_at))}`;
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
  // Open rows carry Edit/Delete only (v1.3.1 — the urgent toggle
  // crowded them); urgency changes ride the Edit flow with everything
  // else. Household-wide RLS: either account edits either's items.
  if (!isDone) {
    side.append(entryButton("Edit", () => startTodoEdit(todo)));
  }
  side.append(entryButton("Delete", () => confirmDeleteTodo(todo)));

  li.append(check, main, side);
  return li;
}

// errors surface in the card the tap happened in
function statusFnFor(todo) {
  return (todo.list ?? "todo") === "shopping" ? showBuyStatus : showTodoStatus;
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
    statusFnFor(todo)(
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
    if (todoEditingId === todo.id) exitTodoEdit();
    if (buyEditingId === todo.id) exitBuyEdit();
    await refreshTodos();
  } catch (error) {
    statusFnFor(todo)(`Couldn't delete: ${error.message}`);
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

// ── recurring commitments (v1.14) ────────────────────────────────────
// The gap this closes: subscriptions and premiums never get logged
// because there is no spend moment to trigger it. Habit can't fix that;
// only a due date can. So the registry carries the schedule, and the
// strip turns a due date into the moment.
//
// Standing rule, enforced here and in the RPC: NOTHING auto-commits.
// The day a subscription is cancelled is the day auto-logging starts
// lying, and it is the day nobody is looking. The tap is the audit.

const dueCard = document.getElementById("due-card");
const dueList = document.getElementById("due-list");
const dueCount = document.getElementById("due-count");
const dueStatus = document.getElementById("due-status");
const dueUpcoming = document.getElementById("due-upcoming");
const recList = document.getElementById("rec-list");
const recEmpty = document.getElementById("rec-empty");
const recOffCard = document.getElementById("rec-off-card");
const recOff = document.getElementById("rec-off");
const recForm = document.getElementById("rec-form");
const recStatus = document.getElementById("rec-status");
const recCategorySelect = document.getElementById("rec-category");
const recCardSelect = document.getElementById("rec-card");
const commitTotal = document.getElementById("commit-total");
const commitSpend = document.getElementById("commit-spend");
const commitExcluded = document.getElementById("commit-excluded");

let recurringCache = [];
const editingAmount = new Set(); // ids showing the amount box
const skipChoice = new Set(); // ids showing the skip/cancel fork

async function refreshRecurring() {
  try {
    recurringCache = await fetchRecurring();
    renderRecurring();
  } catch (error) {
    showDueStatus(
      error.message?.includes("fetch")
        ? "No connection — couldn't load recurring items."
        : `Couldn't load recurring items: ${error.message}`,
    );
  }
}

function showDueStatus(message) {
  dueStatus.textContent = message ?? "";
  dueStatus.hidden = !message;
}

function renderRecurring() {
  const today = todayISO();
  const due = dueItems(recurringCache, today);

  // the strip exists only when something is owed — an empty "Due now"
  // card would be permanent furniture saying nothing
  dueCard.hidden = due.length === 0;
  dueCount.textContent = String(due.length);
  dueList.replaceChildren(...due.map((item) => dueRow(item, today)));

  const soon = upcomingItems(recurringCache, today);
  dueUpcoming.hidden = soon.length === 0 || due.length === 0;
  dueUpcoming.textContent = soon.length
    ? "Coming up: " +
      soon.map((r) => `${r.name} ${shortDateFmt.format(isoToDate(r.next_due))}`).join(" · ")
    : "";

  const totals = commitmentTotals(recurringCache);
  commitTotal.textContent = sgd.format(totals.totalCents / 100);
  commitSpend.textContent = sgd.format(totals.spendingCents / 100);
  commitExcluded.textContent = sgd.format(totals.excludedCents / 100);

  const active = recurringCache.filter((r) => r.active);
  recEmpty.hidden = active.length > 0;
  recList.replaceChildren(...active.map(registryRow));

  const stopped = recurringCache.filter((r) => !r.active);
  recOffCard.hidden = stopped.length === 0;
  recOff.replaceChildren(...stopped.map(registryRow));
}

function dueRow(item, today) {
  const row = document.createElement("div");
  row.className = "due-row";

  const top = document.createElement("div");
  top.className = "due-top";
  const name = document.createElement("span");
  name.className = "due-name";
  name.textContent = item.name; // textContent: names are user input
  const amount = document.createElement("span");
  amount.className = "due-amt";
  amount.textContent = sgd.format(Number(item.amount));
  top.append(name, amount);

  const meta = document.createElement("div");
  meta.className = "due-meta";
  const late = daysLate(item.next_due, today);
  const badge = document.createElement("span");
  badge.className = late === 0 ? "badge badge-today" : "badge badge-late";
  badge.textContent = late === 0 ? "due today" : `${late} day${late === 1 ? "" : "s"} late`;
  meta.append(badge, metaText(shortDateFmt.format(isoToDate(item.next_due))));
  meta.append(metaText(categoryLabel(item.categories)));
  if (item.cards?.name) meta.append(metaText(item.cards.name));
  meta.append(metaText(item.paid_by));
  if (item.categories?.excluded_from_totals) {
    const flag = document.createElement("span");
    flag.className = "badge badge-quiet";
    flag.textContent = "not counted as spending";
    meta.append(flag);
  }

  row.append(top, meta);

  if (editingAmount.has(item.id)) {
    row.append(amountEditor(item));
  } else if (skipChoice.has(item.id)) {
    row.append(skipFork(item));
  } else {
    row.append(dueActions(item));
  }
  return row;
}

function metaText(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function dueActions(item) {
  const actions = document.createElement("div");
  actions.className = "due-actions";
  actions.append(
    smallButton("Confirm", "btn-primary", () => doConfirm(item, Number(item.amount))),
    smallButton("Edit", "btn-ghost", () => {
      editingAmount.add(item.id);
      renderRecurring();
    }),
    smallButton("Skip", "btn-ghost", () => {
      skipChoice.add(item.id);
      renderRecurring();
    }),
  );
  return actions;
}

// Confirm-with-edit updates the registry amount too: last month's
// actual is next month's best prediction, so an FX swing or a price
// rise is typed once rather than corrected every month.
function amountEditor(item) {
  const wrap = document.createElement("div");
  const box = document.createElement("div");
  box.className = "edit-row";
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number(item.amount).toFixed(2);
  input.setAttribute("aria-label", `Amount charged for ${item.name}`);
  const save = smallButton("Confirm", "btn-primary", () => {
    const parsed = evaluateAmount(input.value);
    if (parsed === null || parsed <= 0) {
      showDueStatus("Enter an amount greater than zero.");
      return;
    }
    editingAmount.delete(item.id);
    doConfirm(item, parsed);
  });
  box.append(input, save);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "The registry remembers this amount for next time.";
  wrap.append(box, hint);
  return wrap;
}

// Skip and cancel are deliberately different answers. A cancellation
// mistaken for a skip returns as a phantom next month; a skip mistaken
// for a cancellation costs nothing, because it can be switched back on.
function skipFork(item) {
  const wrap = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "due-actions";
  actions.append(
    smallButton("Skip just this one", "btn-ghost", async () => {
      skipChoice.delete(item.id);
      await guardDue(() => skipRecurring(item.id, item.next_due));
    }),
    smallButton("Cancelled — stop it", "btn-ghost", async () => {
      skipChoice.delete(item.id);
      await guardDue(() => deactivateRecurring(item.id));
    }),
  );
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Stopping keeps the item and its history — it just won't come round again.";
  wrap.append(actions, hint);
  return wrap;
}

function smallButton(text, variant, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn btn-small ${variant}`;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

// The confirm runs through the same duplicate check as a manual save:
// the RPC writes server-side, so without this the "already logged it by
// hand" case would double up silently — the one real trap in the shape.
async function doConfirm(item, amount) {
  showDueStatus(null);
  try {
    const dupes = await findPossibleDuplicates(amount, item.next_due);
    if (dupes.length > 0) {
      const when = dateFmt.format(isoToDate(dupes[0].date));
      const proceed = window.confirm(
        `Possible duplicate: ${sgd.format(amount)} is already logged ` +
          `(${dupes[0].categories.name}, ${when}, paid by ${dupes[0].paid_by}).\n\n` +
          `Confirm ${item.name} anyway?`,
      );
      if (!proceed) return;
    }
  } catch {
    // the duplicate check is a courtesy; never let it block a confirm
  }
  await guardDue(() => confirmRecurring(item.id, amount, item.next_due));
}

// One place to turn an RPC failure into something readable. The
// serialization_failure the function raises means the other phone got
// there first — that is not an error the user caused, so it reads as
// news rather than a fault.
async function guardDue(action) {
  try {
    await action();
    await Promise.all([refreshRecurring(), refresh()]);
  } catch (error) {
    const message = error?.message ?? String(error);
    showDueStatus(
      /already confirmed|already moved on/i.test(message)
        ? "Already done on the other phone — refreshed."
        : `Couldn't do that: ${message}`,
    );
    await refreshRecurring();
  }
}

function registryRow(item) {
  const row = document.createElement("div");
  row.className = item.active ? "reg-row" : "reg-row reg-off";

  const main = document.createElement("div");
  main.className = "reg-main";
  const name = document.createElement("div");
  name.className = "reg-name";
  name.textContent = item.name;
  const meta = document.createElement("div");
  meta.className = "reg-meta";
  const bits = [];
  if (item.active && item.next_due) {
    bits.push(`Next ${shortDateFmt.format(isoToDate(item.next_due))}`);
  } else {
    bits.push("Stopped");
  }
  bits.push(categoryLabel(item.categories));
  if (item.cards?.name) bits.push(item.cards.name);
  bits.push(item.paid_by);
  bits.push(
    item.last_confirmed
      ? `last ${shortDateFmt.format(isoToDate(item.last_confirmed))}`
      : "never confirmed",
  );
  meta.textContent = bits.join(" · ");
  main.append(name, meta);

  // "$X every month until age Y" as a live number instead of a fact
  // somebody has to remember
  const left = remaining(item);
  if (left) {
    const runway = document.createElement("div");
    runway.className = "runway";
    runway.textContent = `${left.payments} left · ${sgdWhole.format(Math.round(left.cents / 100))} to go`;
    main.append(runway);
  }

  const right = document.createElement("div");
  right.className = "reg-right";
  const amount = document.createElement("div");
  amount.className = "reg-amt";
  amount.textContent = sgd.format(Number(item.amount));
  const cadence = document.createElement("div");
  cadence.className = "reg-cad";
  cadence.textContent = item.cadence;
  right.append(amount, cadence);
  if (item.cadence !== "monthly") {
    const equiv = document.createElement("div");
    equiv.className = "reg-cad";
    equiv.textContent = `${sgd.format(monthlyEquivalentCents(item) / 100)}/mo`;
    right.append(equiv);
  }
  if (item.active) {
    right.append(
      smallButton("Stop", "btn-ghost btn-danger-ghost", async () => {
        if (!window.confirm(`Stop ${item.name}? It stays in the list with its history.`)) return;
        await guardDue(() => deactivateRecurring(item.id));
      }),
    );
  }

  row.append(main, right);
  return row;
}

recForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  recStatus.hidden = true;
  const amount = evaluateAmount(document.getElementById("rec-amount").value);
  if (amount === null || amount <= 0) {
    recStatus.textContent = "Enter an amount greater than zero.";
    recStatus.hidden = false;
    return;
  }
  const nextDueValue = document.getElementById("rec-next").value;
  const endValue = document.getElementById("rec-end").value;
  if (endValue && endValue < nextDueValue) {
    recStatus.textContent = "The end date can't be before the next due date.";
    recStatus.hidden = false;
    return;
  }
  try {
    await addRecurring({
      name: document.getElementById("rec-name").value.trim(),
      amount,
      cadence: document.getElementById("rec-cadence").value,
      // the anchor comes from the first due date: it is what re-anchors
      // a 31st item after a short month instead of drifting
      anchor_day: Number(nextDueValue.slice(8, 10)),
      next_due: nextDueValue,
      end_date: endValue || null,
      category_id: Number(recCategorySelect.value),
      card_id: recCardSelect.value ? Number(recCardSelect.value) : null,
      paid_by: recForm.querySelector('input[name="rec_paid_by"]:checked').value,
    });
    recForm.reset();
    document.getElementById("rec-cadence").value = "monthly";
    await refreshRecurring();
  } catch (error) {
    recStatus.textContent = `Couldn't add it: ${error.message}`;
    recStatus.hidden = false;
  }
});

// "Make this recurring" pre-fills the form from the expense just saved,
// so the registry is seeded by money that actually moved rather than by
// a form somebody has to remember to fill.
document.getElementById("make-recurring").addEventListener("click", () => {
  if (!lastSavedFields) return;
  document.getElementById("rec-name").value = lastSavedFields.note || "";
  document.getElementById("rec-amount").value = Number(lastSavedFields.amount).toFixed(2);
  document.getElementById("rec-cadence").value = "monthly";
  recCategorySelect.value = String(lastSavedFields.category_id);
  if (lastSavedFields.card_id) recCardSelect.value = String(lastSavedFields.card_id);
  const paid = recForm.querySelector(`input[name="rec_paid_by"][value="${lastSavedFields.paid_by}"]`);
  if (paid) paid.checked = true;
  // next due is one cadence on from the charge just logged
  const d = isoToDate(lastSavedFields.date);
  document.getElementById("rec-next").value = nextDue(lastSavedFields.date, "monthly", d.getDate());
  showTab("rec");
  glideTo(recForm);
});
