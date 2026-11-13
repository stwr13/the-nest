import { supabase } from "./supabase.js";
import { displayNameFor } from "./identity.js";
import { summarize, categoryLabel, monthKey } from "./dashboard-math.js";
import { ledgerView, dayTotal, recentDayTotals, capGroups } from "./ledger-view.js";
import {
  nextDue,
  dueItems,
  remaining,
  daysLate,
  monthlyEquivalentCents,
  CADENCE_LABEL,
  recurringEdit,
} from "./recurring-view.js";
import {
  monthSplit,
  everydayComparison,
  typicalMonth,
  monthByMonth,
  oneOffs,
  oneOffsSince,
  ONE_OFF_CENTS,
} from "./overview-math.js";
import { todosView } from "./todos-view.js";
import { horizon, upcomingCharges, endOfMonth, dayList, isMonthlyCharge } from "./horizon-view.js";
import { defaultCategoryId, defaultCardId, usageRank } from "./category-default.js";
import { cardSummary, bestNextCard, normalizeTags, allTags, cardsForTag } from "./cards-math.js";
import { evaluateAmount, hasOperator, leadingNumber } from "./amount-expr.js";
import { isOffline, toCents } from "./helpers.js";
import { monthInflows, inflowTitle, inflowShowsKind, inflowFields, savingsCents, KIND_LABEL } from "./inflow-math.js";
import {
  fetchCategories,
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  findPossibleDuplicates,
  fetchAllExpensesForExport,
  fetchOneOffCandidates,
  addCategory,
  updateCategory,
  countExpensesForCategory,
  reassignAndDeleteCategory,
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
  updateRecurring,
  confirmRecurring,
  skipRecurring,
  deactivateRecurring,
  fetchEvents,
  addEvent,
  deleteEvent,
  fetchInflows,
  addInflow,
  updateInflow,
  deleteInflow,
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
const dashOutflow = document.getElementById("dash-outflow");
const dashSplit = document.getElementById("dash-split");
const dashEveryday = document.getElementById("dash-everyday");
const dashCommitments = document.getElementById("dash-commitments");
const dashOneOffs = document.getElementById("dash-oneoffs");
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
// v1.22: whether each source Overview reads has loaded at least once, and
// what went wrong if the latest try failed. An empty cache from a failed
// load would otherwise read as a real answer ("Nothing big lands").
const sources = {
  ledger: { loaded: false, failed: null },
  recurring: { loaded: false, failed: null },
  inflows: { loaded: false, failed: null },
};
let inflowsCache = [];
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
  if (isOffline(error)) {
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
    // v1.26: only cards in the picker get a vote, so a bills-only
    // account confirmed from Due now can't out-vote the usual card
    const pickable = new Set(pickerCards().map((c) => c.id));
    const usualCard = defaultCardId(
      expenses.filter((e) => pickable.has(e.card_id)),
      currentUser?.id,
      todayISO(),
    );
    if (usualCard !== null) cardSelect.value = String(usualCard);
    syncCardPicker();
    sources.ledger = { loaded: true, failed: null };
    renderAll(expenses);
  } catch (error) {
    ledgerFailed(error);
  }
  // Deliberately separate: the to-do list and the rest are auxiliary,
  // and their failures must never take the ledger down with them. Each
  // shows its errors in its own card via its refresh's catch.
  refreshTodos();
  refreshRecurring();
  refreshSoon();
  refreshOneOffs();
  refreshInflows();
}

async function refresh() {
  try {
    const expenses = await fetchExpenses();
    sources.ledger = { loaded: true, failed: null };
    renderAll(expenses);
    refreshOneOffs(); // a save can add one; its errors show in its own card
  } catch (error) {
    ledgerFailed(error);
  }
}

function ledgerFailed(error) {
  const message = loadErrorMessage(error);
  sources.ledger.failed = message;
  showLedgerStatus(message);
  renderOverview(); // so Overview says so too, rather than guess
}

function renderAll(expenses) {
  expensesCache = expenses;
  renderDashboard(expenses);
  renderCards(expenses);
  renderLedger(expenses);
  renderOverview();
}

function loadErrorMessage(error) {
  return isOffline(error)
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
  const { thisCents, byCategory, prevByCategory, excluded, notCountedCents, outflowCents } =
    summarize(expenses, dashDate);
  const viewingNow = monthKey(dashDate) === monthKey(new Date());

  dashLabel.textContent = viewingNow
    ? `This month · ${monthFmt.format(dashDate)}`
    : `${monthFmt.format(dashDate)} ${dashDate.getFullYear()}`;
  dashTotal.textContent = sgd.format(thisCents / 100);
  // only when it differs: the same number twice would say nothing
  dashOutflow.hidden = notCountedCents === 0;
  dashOutflow.textContent = `Total outflow ${sgd.format(outflowCents / 100)}, including ${sgd.format(notCountedCents / 100)} not counted below`;

  // don't walk back past the start of history, or forward past today
  const earliestKey = expenses.length
    ? expenses[expenses.length - 1].date.slice(0, 7)
    : monthKey(new Date());
  dashPrev.disabled = monthKey(shiftMonth(dashDate, -1)) < earliestKey;
  dashNext.disabled = viewingNow;

  renderEverydayComparison(everydayComparison(expenses, dashDate));

  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  // v1.19: the total keeps its meaning; these say what it's made of.
  // They add up to it, so a month's total can be read at a glance as
  // "the usual, the bills, and the unusual".
  const split = monthSplit(expenses, monthKey(dashDate));
  dashSplit.hidden = rows.length === 0;
  dashEveryday.textContent = wholeDollars(split.everydayCents);
  dashCommitments.textContent = wholeDollars(split.commitmentCents);
  dashOneOffs.textContent = wholeDollars(split.oneOffCents);

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
  renderFlow();
}

function wholeDollars(cents) {
  return sgdWhole.format(Math.round(cents / 100));
}

// v1.19: Everyday against Everyday. Comparing totals stopped being fair
// once bills started being confirmed: the months before them hold almost
// no commitments, so every month from here on would look like a jump.
// The months stay listed and tappable (Claire reached for that before it
// existed), and they are what the average can be checked against.
function renderEverydayComparison({ months, averageCents }) {
  dashMonths.hidden = months.length === 0;
  dashMonths.replaceChildren(
    ...months.flatMap((month, i) => {
      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "dash-month-link";
      jump.textContent = `${monthShortFmt.format(month.date)} ${wholeDollars(month.cents)}`;
      jump.addEventListener("click", () => showMonth(month.date));
      return i === 0 ? [jump] : [document.createTextNode(" · "), jump];
    }),
  );
  if (months.length >= 2) {
    dashCompare.textContent = `Everyday compared with the months before: ${wholeDollars(averageCents)} average`;
  } else if (months.length === 1) {
    dashCompare.textContent = `Everyday compared with ${monthFmt.format(months[0].date)}: ${wholeDollars(averageCents)}`;
  } else {
    dashCompare.textContent = "No full month before this one to compare Everyday with.";
  }
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
      isOffline(error)
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
      isOffline(error)
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
      isOffline(error)
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

  recEditCategory.replaceChildren(
    ...categoriesCache.map((c) => new Option(categoryLabel(c), c.id)),
  );

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
// as the old 💡 idea jump. The glide is hand-rolled: iOS PWAs silently
// ignore smooth scrollIntoView (💡 only glided because focusing its
// input made iOS animate toward the keyboard). Phone-found 2026-07-29.
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
    // the ledger, the dashboard and the Recurring rows all show the name
    await Promise.all([refresh(), refreshRecurring()]);
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
  // Recurring items move too (v1.22), stopped ones included
  const items = recurringCache.filter((r) => r.category_id === category.id).length;
  const itemsText = items === 0 ? "" : ` ${items} Recurring ${items === 1 ? "item moves" : "items move"} too.`;
  try {
    const count = await countExpensesForCategory(category.id);
    catDeleteInfo.textContent =
      (count === 0
        ? `No entries use ${categoryLabel(category)}.`
        : `${count} ${count === 1 ? "entry" : "entries"} will move out of ${categoryLabel(category)}.`) + itemsText;
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
    await Promise.all([refresh(), refreshRecurring()]); // both may have moved
  } catch (error) {
    showCatDeleteStatus(
      isOffline(error)
        ? "No connection — nothing was changed."
        : `Couldn't delete: ${error.message}`,
    );
  }
});

document.getElementById("cat-delete-cancel").addEventListener("click", () => catDeleteDialog.close());

function friendlyCategoryError(error) {
  if (error.message?.includes("duplicate key")) return "That name already exists.";
  if (isOffline(error)) return "No connection — not saved.";
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

// v1.18: retired cards never reach either select. An old entry that
// points at one gets it back as a temporary option while it is being
// edited (setCardSelectValue), the same way a pre-card entry does.
function liveCards() {
  return cardsCache.filter((c) => !c.retired);
}

// v1.26: a bills-only card (an account that only ever pays standing
// charges) stays out of the logging picker but is still offered for
// Recurring items, so Due now confirms keep landing on it. Its old
// entries edit the same way a retired card's do.
function pickerCards() {
  return liveCards().filter((c) => !c.bills_only);
}

function renderCardOptions() {
  const selected = cardSelect.value;
  // An entry on a hidden card (or with no card) is mid-edit: its
  // temporary option must outlive a rebuild, or saving a card while the
  // edit is open would drop it and the Update would move the entry.
  const temp = cardSelect.querySelector("option[data-temp]");
  cardSelect.replaceChildren(...pickerCards().map((c) => new Option(c.name, c.id)));
  if (temp && ![...cardSelect.options].some((o) => o.value === temp.value)) cardSelect.prepend(temp);
  if ([...cardSelect.options].some((o) => o.value === selected)) {
    cardSelect.value = selected;
  }

  const recSelected = recCardSelect.value;
  recCardSelect.replaceChildren(...liveCards().map((c) => new Option(c.name, c.id)));
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
  // v1.16: cap state rides the tile itself. "Have I maxed this out?"
  // is asked while CHOOSING a card, and the answer used to be three
  // scrolls away in the Cards area — far enough that the question
  // mostly went unasked. Always the current month: the cap question is
  // about now, even while editing an older entry.
  const capState = new Map(
    cardSummary(expensesCache, cardsCache, new Date(), todayISO()).map((c) => [c.id, c]),
  );
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
      const art = miniCardArt(card);
      pick.append(art);
      const name = document.createElement("span");
      name.className = "card-pick-name";
      name.textContent = card ? cardPickLabel(card.name) : o.textContent;
      pick.append(name);

      // Uncapped cards (PayNow, and any card with no bonus ceiling)
      // get no bar — there is no cap to be near, and a permanently
      // empty gauge would read as "nothing spent".
      const state = card ? capState.get(card.id) : null;
      if (state?.capCents != null) {
        const filled = Math.min(100, Math.round((state.spentCents / state.capCents) * 100));
        const bar = document.createElement("span");
        bar.className = "cap-bar";
        const fill = document.createElement("span");
        fill.className = "cap-bar-fill";
        fill.style.width = `${filled}%`;
        bar.append(fill);
        pick.append(bar);

        if (state.overCap) {
          // v1.16.2: no "FULL" word. The red border, the greyed art and
          // the red name already say it, and at four columns a fourth
          // signal was noise — Shawn: "too many words gets messy
          // visually". The state still reaches a screen reader through
          // the aria-label below, which is where the words belong.
          pick.classList.add("card-pick-full");
        } else if (filled >= 80) {
          pick.classList.add("card-pick-near");
        }
        // the exact headroom without spending tile space on it — and
        // the only form a screen reader gets at all
        pick.setAttribute(
          "aria-label",
          state.overCap
            ? `${card.name} — bonus cap reached (${sgd.format(state.capCents / 100)})`
            : `${card.name} — ${sgd.format(state.remainingCents / 100)} of cap left`,
        );
      }
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
// v1.18: same trick for an entry on a retired card — without it the
// select would silently fall back and a save would move the entry.
// v1.26: a bills-only card is outside the picker too and takes the
// same path.
function setCardSelectValue(cardId) {
  clearTempCardOption();
  if (cardId != null) {
    const id = String(cardId);
    if (![...cardSelect.options].some((o) => o.value === id)) {
      const card = cardsCache.find((c) => String(c.id) === id);
      const temp = new Option(card?.name ?? "(retired card)", id);
      temp.dataset.temp = "1";
      cardSelect.prepend(temp);
    }
    cardSelect.value = id;
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
  const summary = cardSummary(expenses, cardsCache, dashDate, todayISO());
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
  // ties fall back to the manager's sort order. v1.18: retired cards
  // sink below everything — kept here only so they can be edited back.
  let displayOrder = [...summary].sort(
    (a, b) =>
      Number(Boolean(a.retired)) - Number(Boolean(b.retired)) ||
      b.spentCents - a.spentCents ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
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
      if (c.retired || (matchedIds && !matchedIds.has(c.id))) li.className = "card-dim";
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
      // v1.17: the rule behind this card's advice has aged out. Said
      // here rather than on the picker tile — the tile answers "am I
      // maxed out", and a second unrelated warning there would be the
      // clutter just removed from it.
      if (c.retired) {
        const flag = document.createElement("span");
        flag.className = "card-row-retired";
        flag.textContent = "retired — not in the picker";
        left.append(flag);
      } else if (c.bills_only) {
        // v1.26: not dimmed and not sunk — it is in use, just never
        // picked by hand. The line says why its tile is missing.
        const flag = document.createElement("span");
        flag.className = "card-row-retired";
        flag.textContent = "bills only — not in the logging picker";
        left.append(flag);
      } else if (c.stale) {
        const flag = document.createElement("span");
        flag.className = "card-row-stale";
        flag.textContent = `rules need a check — set ${shortDateFmt.format(isoToDate(c.earn_review_date))}`;
        left.append(flag);
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

      if (c.capCents != null && !c.retired) {
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
  cardForm.earn_review_date.value = card?.earn_review_date ?? "";
  cardForm.bills_only.checked = Boolean(card?.bills_only);
  cardForm.retired.checked = Boolean(card?.retired);
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
    note: cardForm.note.value.replace(/\s+/g, " ").trim() || null,
    earn_review_date: cardForm.earn_review_date.value || null,
    bills_only: cardForm.bills_only.checked,
    retired: cardForm.retired.checked,
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
        ? "This card has entries — it can't be deleted. Tick Retired instead."
        : friendlyCardError(error),
    );
  }
});

document.getElementById("card-cancel").addEventListener("click", () => cardDialog.close());

function friendlyCardError(error) {
  if (error.message?.includes("duplicate key")) return "That name already exists.";
  if (isOffline(error)) return "No connection — not saved.";
  return `Couldn't save: ${error.message}`;
}

function showCardStatus(message) {
  cardStatus.textContent = message ?? "";
  cardStatus.hidden = !message;
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

document.getElementById("caps-jump").addEventListener("click", () => {
  glideTo(document.querySelector(".cards-card"));
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
  soon: document.getElementById("tab-soon"),
};
const tabButtons = {
  money: document.getElementById("tab-btn-money"),
  todos: document.getElementById("tab-btn-todos"),
  buy: document.getElementById("tab-btn-buy"),
  rec: document.getElementById("tab-btn-rec"),
  soon: document.getElementById("tab-btn-soon"),
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
let doneOpenWish = false; // "we did it" list, collapsed by default
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
      isOffline(error)
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
      isOffline(error)
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

  const w = todosView(todos, todayISO(), "wish");
  wishEmpty.hidden = w.open.length > 0;
  wishList.replaceChildren(...w.open.map(renderTodo));
  wishDoneToggle.hidden = w.done.length === 0;
  wishDoneToggle.textContent = `${doneOpenWish ? "Hide" : "Show"} done (${w.done.length})`;
  wishDoneList.hidden = !doneOpenWish || w.done.length === 0;
  wishDoneList.replaceChildren(...w.done.map(renderTodo));

  // Coming up reads this cache — a checked-off chore must leave the
  // horizon at the same moment it leaves the list
  renderSoon();
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
      isOffline(error)
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
      isOffline(error)
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
    statusFnFor(todo)(isOffline(error) ? "No connection — not deleted." : `Couldn't delete: ${error.message}`);
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
const dueToggle = document.getElementById("due-toggle");
const dueBody = document.getElementById("due-body");
const dueTotal = document.getElementById("due-total");
const dueConfirmAll = document.getElementById("due-confirm-all");
const recList = document.getElementById("rec-list");
const recEmpty = document.getElementById("rec-empty");
const recOffCard = document.getElementById("rec-off-card");
const recOff = document.getElementById("rec-off");
const recForm = document.getElementById("rec-form");
const recStatus = document.getElementById("rec-status");
const recCategorySelect = document.getElementById("rec-category");
const recCardSelect = document.getElementById("rec-card");
const recCadence = document.getElementById("rec-cadence");
const recEnd = document.getElementById("rec-end");
const recAddOpen = document.getElementById("rec-add-open");
const recDialog = document.getElementById("rec-dialog");
const recEditForm = document.getElementById("rec-edit-form");
const recEditCategory = document.getElementById("rec-edit-category");
const recEditStatus = document.getElementById("rec-edit-status");
const recEditSave = document.getElementById("rec-edit-save");
const runningCount = document.getElementById("running-count");
const runningStatus = document.getElementById("running-status");
const stoppedCount = document.getElementById("stopped-count");

let recurringCache = [];
const editingAmount = new Set(); // ids showing the amount box
const amountDrafts = new Map(); // id -> what was typed there, so a re-render keeps it
// v1.23: ids someone unticked. Ticked is the default, so confirming
// everything stays one tap; unticking holds back what isn't charged yet.
const dueUnticked = new Set();
const dueSelected = (due) => due.filter((item) => !dueUnticked.has(item.id));
const skipChoice = new Set(); // ids showing the skip/cancel fork
// v1.19: folded on every launch. At one line it costs the log form about
// a row of height; open, each item costs a compact row. The old full rows
// pushed the form off the first screen once the registry grew.
let dueOpen = false;
let confirmingAll = false;

async function refreshRecurring() {
  try {
    recurringCache = await fetchRecurring();
    sources.recurring = { loaded: true, failed: null };
    renderRecurring();
  } catch (error) {
    const message = isOffline(error)
      ? "No connection — couldn't load recurring items."
      : `Couldn't load recurring items: ${error.message}`;
    sources.recurring.failed = message;
    showDueStatus(message);
    // so Overview and Coming up say so too, rather than guess
    renderOverview();
    renderSoon();
  }
}

// The message sits outside the fold, and shows the card if it has to: the
// card is hidden while nothing is due, and a failure to load is exactly
// when nothing appears due. News rather than a fault clears itself, or an
// empty card would sit there saying it until the next launch.
let dueStatusTimer = null;

function showDueStatus(message, { news = false } = {}) {
  clearTimeout(dueStatusTimer);
  dueStatus.textContent = message ?? "";
  dueStatus.hidden = !message;
  if (message) dueCard.hidden = false;
  if (message && news) {
    dueStatusTimer = setTimeout(() => {
      showDueStatus(null);
      renderDue();
    }, 8000);
  }
}

function renderRecurring() {
  renderDue();

  const active = recurringCache.filter((r) => r.active);
  recEmpty.hidden = active.length > 0;
  runningCount.textContent = `(${active.length})`;
  recList.replaceChildren(...active.map(registryRow));

  const stopped = recurringCache.filter((r) => !r.active);
  recOffCard.hidden = stopped.length === 0;
  stoppedCount.textContent = `(${stopped.length})`;
  recOff.replaceChildren(...stopped.map(registryRow));

  renderOverview();
  renderSoon(); // a confirmed charge moves on; the horizon follows
}

function renderDue() {
  const today = todayISO();
  const due = dueItems(recurringCache, today);

  // the strip exists only when something is owed — an empty "Due now"
  // card would be permanent furniture saying nothing. A message about
  // what just happened stays up even when the list has emptied.
  dueCard.hidden = due.length === 0 && dueStatus.hidden;
  if (due.length === 0) dueOpen = false;
  dueToggle.hidden = due.length === 0;
  dueToggle.setAttribute("aria-expanded", String(dueOpen));
  dueBody.hidden = !dueOpen;
  dueCount.textContent = String(due.length);
  dueTotal.textContent = sgd.format(
    due.reduce((sum, item) => sum + toCents(item.amount), 0) / 100,
  );
  const dueIds = new Set(due.map((item) => item.id));
  for (const id of amountDrafts.keys()) if (!dueIds.has(id)) amountDrafts.delete(id);
  for (const id of dueUnticked) if (!dueIds.has(id)) dueUnticked.delete(id);
  // a tick on a lone item would only ask the button's question twice
  const ticks = due.length > 1;
  dueList.replaceChildren(...due.map((item) => dueRow(item, today, ticks)));
  renderConfirmAll(due);
}

dueToggle.addEventListener("click", () => {
  dueOpen = !dueOpen;
  renderDue();
});

// One compact row: name, amount, how late, and the two ways to change it.
function dueRow(item, today, ticks = false) {
  const row = document.createElement("div");
  row.className = "due-row";

  const top = document.createElement("div");
  top.className = "due-top";

  const left = document.createElement("div");
  left.className = "due-left";
  const name = document.createElement("div");
  name.className = "due-name";
  name.textContent = item.name; // textContent: names are user input
  const late = daysLate(item.next_due, today);
  const badge = document.createElement("span");
  badge.className = late === 0 ? "badge badge-today" : "badge badge-late";
  badge.textContent = late === 0 ? "due today" : `${late} day${late === 1 ? "" : "s"} late`;
  left.append(name, badge);

  const right = document.createElement("div");
  right.className = "due-right";
  const amount = document.createElement("div");
  amount.className = "due-amt";
  amount.textContent = sgd.format(Number(item.amount));
  const links = document.createElement("div");
  links.className = "due-links";
  links.append(
    dueLink("Edit", item, editingAmount),
    document.createTextNode(" · "),
    dueLink("Skip", item, skipChoice),
  );
  right.append(amount, links);

  if (ticks) {
    const tick = document.createElement("label");
    tick.className = "due-tick";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !dueUnticked.has(item.id);
    box.setAttribute("aria-label", `Include ${item.name} in Confirm`);
    box.addEventListener("change", () => {
      if (box.checked) dueUnticked.delete(item.id);
      else dueUnticked.add(item.id);
      renderConfirmAll(dueItems(recurringCache, todayISO()));
    });
    tick.append(box);
    top.append(tick);
  }
  top.append(left, right);
  row.append(top);

  if (editingAmount.has(item.id)) {
    row.append(amountEditor(item));
  } else if (skipChoice.has(item.id)) {
    row.append(skipFork(item));
  }
  return row;
}

// Tapping again closes it, and opening one closes the other: a row holds
// one question at a time.
function dueLink(text, item, set) {
  const link = document.createElement("button");
  link.type = "button";
  link.className = "due-link";
  link.textContent = text;
  link.setAttribute("aria-expanded", String(set.has(item.id)));
  link.addEventListener("click", () => {
    const opening = !set.has(item.id);
    editingAmount.delete(item.id);
    skipChoice.delete(item.id);
    if (opening) set.add(item.id);
    if (!editingAmount.has(item.id)) amountDrafts.delete(item.id); // closed: start fresh next time
    renderDue();
  });
  return link;
}

// Only inside the opened view, so the amounts have been seen before they
// are confirmed. Hidden while a row is mid-edit: its typed amount isn't
// the item's amount yet, and this button would quietly confirm the old one.
function renderConfirmAll(due) {
  if (confirmingAll) return; // the run in progress owns the label
  const selected = dueSelected(due);
  // a row mid-edit or mid-skip is only a risk if the button would take it
  const busy = selected.some((item) => editingAmount.has(item.id) || skipChoice.has(item.id));
  dueConfirmAll.hidden = due.length === 0 || busy;
  dueConfirmAll.disabled = selected.length === 0;
  const total = sgd.format(selected.reduce((sum, item) => sum + toCents(item.amount), 0) / 100);
  dueConfirmAll.textContent =
    due.length === 1
      ? "Confirm"
      : selected.length === 0
        ? "Tick what to confirm"
        : selected.length === due.length
          ? `Confirm all ${due.length} · ${total}`
          : `Confirm ${selected.length} of ${due.length} · ${total}`;
}

// Runs the same doConfirm a single row uses, one item at a time, so every
// item gets its duplicate check and its due-date pin. A possible duplicate
// is the one thing that should interrupt: the dialog asks, and answering
// no stops the run with the rest still listed.
async function confirmAllDue() {
  if (confirmingAll) return;
  const items = dueSelected(dueItems(recurringCache, todayISO()));
  if (items.length === 0) return;
  confirmingAll = true;
  dueConfirmAll.disabled = true;
  showDueStatus(null);

  let stopped = null;
  let confirmed = 0;
  let alreadyDone = 0;
  for (const [i, item] of items.entries()) {
    dueConfirmAll.textContent = `Confirming ${i + 1} of ${items.length}…`;
    const outcome = await doConfirm(item, Number(item.amount), { refreshAfter: false });
    if (outcome === "declined") {
      stopped = `Stopped at ${item.name}, which looks like a duplicate. ${confirmed} confirmed, the rest are still here.`;
      break;
    }
    if (outcome === "failed") {
      // doConfirm has already said why; this adds where it got to
      stopped =
        confirmed > 0
          ? `${dueStatus.textContent} ${confirmed} confirmed before that, the rest are still here.`
          : dueStatus.textContent;
      break;
    }
    if (outcome === "already") alreadyDone += 1;
    else confirmed += 1;
  }

  await Promise.all([refreshRecurring(), refresh()]);
  confirmingAll = false;

  // A failed refresh leaves the old list up, so then the message has to
  // say what went through, or it looks as if nothing did.
  const problem = sources.recurring.failed;
  const parts = [];
  if (stopped) {
    parts.push(stopped);
  } else {
    if (problem && confirmed > 0) parts.push(`${confirmed} confirmed.`);
    // the other phone got there first on some: nothing went wrong, and the
    // pinned due dates mean nothing was logged twice
    if (alreadyDone > 0) parts.push(`${alreadyDone} already done on the other phone${problem ? "." : " — refreshed."}`);
  }
  if (problem) parts.push(`${problem} This list may be out of date.`);
  showDueStatus(parts.join(" ") || null, { news: !stopped && !problem && alreadyDone > 0 });
  // the refresh re-renders only when it succeeds; this hands the button
  // back either way, so it can't stay on "Confirming…"
  renderDue();
}

dueConfirmAll.addEventListener("click", confirmAllDue);

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
  input.value = amountDrafts.get(item.id) ?? Number(item.amount).toFixed(2);
  input.setAttribute("aria-label", `Amount charged for ${item.name}`);
  input.addEventListener("input", () => amountDrafts.set(item.id, input.value));
  const save = smallButton("Confirm", "btn-primary", async () => {
    const parsed = evaluateAmount(input.value);
    if (parsed === null || parsed <= 0) {
      showDueStatus("Enter an amount greater than zero.");
      return;
    }
    editingAmount.delete(item.id);
    const outcome = await doConfirm(item, parsed);
    // A declined duplicate or a failed confirm puts the row back as it
    // was, typed amount and all, so trying again is one tap. Once it's
    // done, here or on the other phone, the typed amount has had its say.
    if (outcome === "declined" || outcome === "failed") editingAmount.add(item.id);
    else amountDrafts.delete(item.id);
    renderDue();
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
// Says how it went, because Confirm all needs to know whether to carry on.
async function doConfirm(item, amount, { refreshAfter = true } = {}) {
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
      if (!proceed) return "declined";
    }
  } catch {
    // the duplicate check is a courtesy; never let it block a confirm
  }
  return guardDue(() => confirmRecurring(item.id, amount, item.next_due), { refreshAfter });
}

function showRunningStatus(message) {
  runningStatus.textContent = message ?? "";
  runningStatus.hidden = !message;
}

// One place to turn an RPC failure into something readable. The
// serialization_failure the function raises means the other phone got
// there first — that is not an error the user caused, so it reads as
// news rather than a fault.
async function guardDue(action, { refreshAfter = true, show = showDueStatus } = {}) {
  show(null);
  try {
    await action();
    if (refreshAfter) await Promise.all([refreshRecurring(), refresh()]);
    return "done";
  } catch (error) {
    const message = error?.message ?? String(error);
    // Refresh first and say why last (v1.22): when the refresh fails too,
    // its "couldn't load" used to replace the reason this didn't go
    // through, which left it unclear whether anything was saved.
    if (refreshAfter) await refreshRecurring();
    if (/already confirmed|already moved on/i.test(message)) {
      const refreshed = refreshAfter && !sources.recurring.failed;
      show(`Already done on the other phone${refreshed ? " — refreshed." : "."}`, { news: refreshed });
      return "already";
    }
    show(
      isOffline(error)
        ? "No connection — that didn't go through."
        : `Couldn't do that: ${message}`,
    );
    return "failed";
  }
}

// v1.23: three tight lines, the actions as links on the last one. The old
// stacked pill buttons left white space under every item and crowded the
// right side.
function registryRow(item) {
  const row = el("div", item.active ? "reg-row reg-grid" : "reg-row reg-grid reg-off");

  const when =
    item.active && item.next_due ? `Next ${shortDateFmt.format(isoToDate(item.next_due))}` : "Stopped";
  const status = item.last_confirmed
    ? `last ${shortDateFmt.format(isoToDate(item.last_confirmed))}`
    : "never confirmed";
  let cadence = CADENCE_LABEL[item.cadence] ?? item.cadence;
  if (item.cadence !== "monthly" && item.cadence !== "once") {
    cadence += ` · ${sgd.format(monthlyEquivalentCents(item) / 100)}/mo`;
  }

  const actions = el("div", "due-links");
  if (item.active) {
    const link = (text, className, onClick) => {
      const button = el("button", className, text);
      button.type = "button";
      button.addEventListener("click", onClick);
      return button;
    };
    actions.append(
      link("Edit", "due-link", () => openRecDialog(item)),
      document.createTextNode(" · "),
      link("Stop", "due-link due-link-danger", async () => {
        if (!window.confirm(`Stop ${item.name}? It stays in the list with its history.`)) return;
        await guardDue(() => deactivateRecurring(item.id), { show: showRunningStatus });
      }),
    );
  }

  row.append(
    el("div", "reg-name", item.name),
    el("div", "reg-amt", sgd.format(Number(item.amount))),
    el("div", "reg-meta", `${when} · ${categoryLabel(item.categories)}`),
    el("div", "reg-cad", cadence),
    el("div", "reg-meta", [item.cards?.name, status].filter(Boolean).join(" · ")),
    actions,
  );

  // "$X every month until age Y" as a live number instead of a fact
  // somebody has to remember
  const left = item.cadence === "once" ? null : remaining(item);
  if (left) {
    row.append(el("div", "runway", `${left.payments} left · ${sgdWhole.format(Math.round(left.cents / 100))} to go`));
  }
  return row;
}

// v1.21: the registry's first editor. Before it, a wrong amount or name
// could only be fixed through the SQL editor, or at Confirm for the amount.
// The registry predicts and the ledger records, so an edit changes what
// comes next and never rewrites an entry already logged.
let recDialogItem = null;

function openRecDialog(item) {
  recDialogItem = item;
  recEditForm.name.value = item.name;
  recEditForm.amount.value = Number(item.amount).toFixed(2);
  recEditForm.category_id.value = String(item.category_id);
  recEditForm.next_due.value = item.next_due;
  showRecEditStatus(null);
  recDialog.showModal();
}

function showRecEditStatus(message) {
  recEditStatus.textContent = message ?? "";
  recEditStatus.hidden = !message;
}

recEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error, fields } = recurringEdit(recDialogItem, {
    name: recEditForm.name.value,
    amount: evaluateAmount(recEditForm.amount.value),
    categoryId: Number(recEditForm.category_id.value),
    nextDueDate: recEditForm.next_due.value,
  });
  if (error) {
    showRecEditStatus(error);
    return;
  }
  if (Object.keys(fields).length === 0) {
    recDialog.close();
    return;
  }
  recEditSave.disabled = true;
  recEditSave.textContent = "Saving…";
  try {
    await updateRecurring(recDialogItem.id, fields);
    recDialog.close();
    await refreshRecurring();
  } catch (failure) {
    showRecEditStatus(
      isOffline(failure)
        ? "No connection — not saved."
        : `Couldn't save: ${failure.message}`,
    );
  } finally {
    recEditSave.disabled = false;
    recEditSave.textContent = "Save";
  }
});

document.getElementById("rec-edit-cancel").addEventListener("click", () => recDialog.close());

// Tucked until asked for: this tab is for reading, and adding a commitment
// is a monthly act at most.
function showRecForm(open) {
  recForm.hidden = !open;
  recAddOpen.setAttribute("aria-expanded", String(open));
}

function closeRecForm() {
  recForm.reset();
  recCadence.value = "monthly";
  syncRecEnd();
  showRecForm(false);
}

recAddOpen.addEventListener("click", () => {
  if (recForm.hidden) showRecForm(true);
  else closeRecForm();
});
document.getElementById("rec-cancel").addEventListener("click", closeRecForm);

// One time has no choice of end date, so the field steps aside.
function syncRecEnd() {
  const once = recCadence.value === "once";
  recEnd.disabled = once;
  if (once) recEnd.value = "";
}

recCadence.addEventListener("change", syncRecEnd);

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
  const endValue = recEnd.value;
  if (endValue && endValue < nextDueValue) {
    recStatus.textContent = "The end date can't be before the next due date.";
    recStatus.hidden = false;
    return;
  }
  const cadenceValue = recCadence.value;
  try {
    await addRecurring({
      name: document.getElementById("rec-name").value.trim(),
      amount,
      cadence: cadenceValue,
      // the anchor comes from the first due date: it is what re-anchors
      // a 31st item after a short month instead of drifting
      anchor_day: Number(nextDueValue.slice(8, 10)),
      next_due: nextDueValue,
      // a one-time charge ends on its own due date: that is what makes
      // confirm_recurring stop it after one confirm (the database insists)
      end_date: cadenceValue === "once" ? nextDueValue : endValue || null,
      category_id: Number(recCategorySelect.value),
      card_id: recCardSelect.value ? Number(recCardSelect.value) : null,
      paid_by: recForm.querySelector('input[name="rec_paid_by"]:checked').value,
    });
    closeRecForm();
    // show them the row they just added
    overviewOpen.add("running");
    syncRunning();
    await refreshRecurring();
  } catch (error) {
    recStatus.textContent = isOffline(error) ? "No connection — not added." : `Couldn't add it: ${error.message}`;
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
  recCadence.value = "monthly";
  syncRecEnd();
  showRecForm(true);
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

// ── Overview (v1.20) ─────────────────────────────────────────────────
// One picture of the household from data the app already holds: what a
// normal month takes, what's inside each part, and how the last six months
// compare (v1.27; until then, when the big charges would land). All of it
// joint, so no names, pills or per-person totals here:
// between the two of them money is shared and nobody tracks who spent
// what. No budgets either. Visibility, not budgets.

const MONTH_BAR_PX = 112; // the tallest bar; the rest of .mm-col holds its figure and label
const ovHeadline = document.getElementById("ov-headline");
const ovSource = document.getElementById("ov-source");
const ovStatus = document.getElementById("ov-status");
const ovStack = document.getElementById("ov-stack");
const ovLayers = document.getElementById("ov-layers");
const mmSentence = document.getElementById("mm-sentence");
const mmBars = document.getElementById("mm-bars");
const mmPanel = document.getElementById("mm-panel");
const oneOffTotal = document.getElementById("oneoff-total");
const oneOffEmpty = document.getElementById("oneoff-empty");
const oneOffList = document.getElementById("oneoff-list");
const oneOffHint = document.getElementById("oneoff-hint");
const oneOffStatus = document.getElementById("oneoff-status");

// What's open survives a re-render: a confirm on the other tab, or a save,
// rebuilds these rows, and that shouldn't fold what someone was reading.
const overviewOpen = new Set();
// The month someone tapped in Month by month; until then, this one. Kept in
// memory only, so every launch opens on this month.
let monthPicked = null;
let oneOffRows = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // names are user input
  return node;
}

function wireDisclosure(toggle, body, key) {
  const sync = () => {
    const open = overviewOpen.has(key);
    toggle.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
  };
  toggle.addEventListener("click", () => {
    if (overviewOpen.has(key)) overviewOpen.delete(key);
    else overviewOpen.add(key);
    sync();
  });
  sync();
  return sync;
}

wireDisclosure(
  document.getElementById("oneoff-toggle"),
  document.getElementById("oneoff-body"),
  "oneoffs",
);
const syncRunning = wireDisclosure(
  document.getElementById("running-toggle"),
  document.getElementById("running-body"),
  "running",
);
wireDisclosure(
  document.getElementById("stopped-toggle"),
  document.getElementById("stopped-body"),
  "stopped",
);

function disclosure(key, wrapClass, toggleClass, headNodes, bodyNodes) {
  const wrap = el("div", wrapClass);
  const toggle = el("button", `ov-toggle ${toggleClass}`);
  toggle.type = "button";
  const chev = el("span", "chev", "›");
  chev.setAttribute("aria-hidden", "true");
  toggle.append(...headNodes, chev);
  const body = el("div", "ov-body");
  body.append(...bodyNodes);
  wireDisclosure(toggle, body, key);
  wrap.append(toggle, body);
  return wrap;
}

// With onTap the whole row is the button: tap an item, change the item.
function miniRow(name, meta, amount, charge, onTap) {
  const row = el(onTap ? "button" : "div", onTap ? "reg-row mini reg-tap" : "reg-row mini");
  if (onTap) {
    row.type = "button";
    row.setAttribute("aria-label", `Edit ${name}`);
    row.addEventListener("click", onTap);
  }
  const main = el("div", "reg-main");
  main.append(el("div", "reg-name", name));
  if (meta) main.append(el("div", "reg-meta", meta));
  const right = el("div", "reg-right");
  right.append(el("div", "reg-amt", amount));
  if (charge) right.append(el("div", "reg-cad", charge));
  row.append(main, right);
  if (onTap) {
    const chev = el("span", "chev", "›");
    chev.setAttribute("aria-hidden", "true");
    row.append(chev);
  }
  return row;
}

// Spread over a month where it isn't monthly, with the real charge below:
// the ledger only ever sees the real one.
function monthlyRow(item, meta) {
  const charge =
    item.cadence === "monthly"
      ? null
      : `${sgd.format(Number(item.amount))} ${CADENCE_LABEL[item.cadence]}`;
  return miniRow(item.name, meta, sgd.format(item.monthlyCents / 100), charge, () => openRecDialog(item));
}

const nextDueText = (item) => `Next ${shortDateFmt.format(isoToDate(item.next_due))}`;
const monthYearText = (iso) =>
  `${monthShortFmt.format(isoToDate(iso))} ${isoToDate(iso).getFullYear()}`;
const averageText = (months) => (months.length === 1 ? "Last full month" : `${months.length}-month average`);

function layerRow(key, colour, name, sub, cents, bodyNodes) {
  const label = el("span", "lay-n", name);
  if (sub) label.append(el("span", "lay-sub", sub));
  return disclosure(
    `layer:${key}`,
    "lay",
    "lay-toggle",
    [el("span", `dot ${colour}`), label, el("span", "lay-v", wholeDollars(cents))],
    bodyNodes,
  );
}

function billsBody(bills) {
  return [
    ...bills.groups.map((group) =>
      disclosure(
        `bills:${group.id}`,
        "grp",
        "grp-toggle",
        [el("span", "ov-grow", group.label), el("span", null, wholeDollars(group.cents))],
        group.items.map((item) => monthlyRow(item, nextDueText(item))),
      ),
    ),
    el("p", "hint", "Items that aren't monthly show their monthly equivalent, with the real charge below."),
  ];
}

function everydayBody(typical) {
  const { everyday, months } = typical;
  if (months.length === 0) return [el("p", "hint", "The ledger doesn't hold a full month to average yet.")];
  const list = el("ul", "dash-cats ov-cats");
  const biggest = everyday.groups[0]?.cents || 1;
  list.append(
    // a category that rounds to nothing has nothing to say here
    ...everyday.groups.filter((group) => group.cents >= 50).map((group) => {
      const li = el("li");
      const row = el("div", "cat-row");
      row.append(el("span", null, group.label), el("span", null, wholeDollars(group.cents)));
      const bar = el("div", "cat-bar");
      const fill = el("div", "cat-bar-fill");
      fill.style.width = `${Math.max(2, Math.round((group.cents / biggest) * 100))}%`;
      bar.append(fill);
      li.append(row, bar);
      return li;
    }),
  );
  return [
    list,
    el(
      "p",
      "hint",
      `${averageText(months)}. On a group bill only your share counts, not the full card charge. Only as complete as what gets logged.`,
    ),
  ];
}

function setAsideBody(setAside, notCounted) {
  const oneTime = recurringCache.filter(
    (item) => item.active && item.cadence === "once" && item.categories?.kind === "invest",
  );
  const notes = oneTime.map(
    (item) =>
      ` The ${wholeDollars(toCents(item.amount))} ${item.name} in ${monthYearText(item.next_due)} is a one-time charge, so it isn't in a typical month.`,
  );
  return [
    ...setAside.items.map((item) =>
      monthlyRow(
        item,
        item.end_date
          ? `${nextDueText(item)} · Ends ${monthYearText(item.end_date)}`
          : nextDueText(item),
      ),
    ),
    el(
      "p",
      "hint",
      `${notCounted ? "Not counted as spending. " : ""}Items that aren't monthly show their monthly equivalent, with the real charge below.${notes.join("")}`,
    ),
  ];
}

// Until both sources have loaded once there are no figures, only why: an
// empty list from a failed load would read as a real answer. After that,
// a failed refresh keeps the last good figures and says so.
function renderOverview() {
  const failed = sources.recurring.failed ?? sources.ledger.failed;
  const ready = sources.recurring.loaded && sources.ledger.loaded;
  ovStatus.textContent = failed && ready ? `${failed} Showing what loaded earlier.` : (failed ?? "");
  ovStatus.hidden = !failed;

  if (ready) {
    renderTypicalMonth();
  } else {
    ovHeadline.textContent = "—";
    const missing = [!sources.recurring.loaded && "Recurring", !sources.ledger.loaded && "the ledger"];
    ovSource.textContent = failed ? `Needs ${missing.filter(Boolean).join(" and ")} to load.` : "Loading…";
    ovStack.hidden = true;
    ovLayers.replaceChildren();
  }
  renderMonthByMonth();
}

function renderTypicalMonth() {
  const typical = typicalMonth(recurringCache, expensesCache, new Date());
  ovHeadline.textContent = `About ${sgdWhole.format(typical.headlineDollars)}`;
  const count = typical.months.length;
  ovSource.textContent =
    count === 0
      ? "From Recurring. The ledger doesn't hold a full month yet."
      : `From Recurring and the last ${count === 1 ? "month" : `${count} months`} of the ledger`;

  // Named after the category it reads, so a rename in the manager shows
  // here too, and only called "not counted" while the category says so.
  const setAsideCategories = [
    ...new Map(typical.setAside.items.map((item) => [item.category_id, item.categories])).values(),
  ];
  const setAsideName = (setAsideCategories.length === 1 && setAsideCategories[0]?.name) || "Set aside";
  const notCounted = setAsideCategories.every((category) => category?.excluded_from_totals);

  // A layer with nothing in it says nothing.
  const layers = [
    { key: "bills", colour: "l1", name: "Regular commitments", cents: typical.bills.cents, body: () => billsBody(typical.bills) },
    { key: "everyday", colour: "l2", name: "Everyday", cents: typical.everyday.cents, body: () => everydayBody(typical) },
    {
      key: "set-aside",
      colour: "l3",
      name: setAsideName,
      sub: notCounted ? "Not counted as spending" : null,
      cents: typical.setAside.cents,
      body: () => setAsideBody(typical.setAside, notCounted),
    },
  ].filter((layer) => layer.cents > 0);
  ovStack.hidden = typical.totalCents === 0;
  ovStack.setAttribute(
    "aria-label",
    `Split of a typical month: ${layers.map((l) => `${l.name} ${wholeDollars(l.cents)}`).join(", ")}`,
  );
  ovStack.replaceChildren(
    ...layers.map((layer) => {
      const segment = el("span", `ov-seg ${layer.colour}`);
      segment.style.flex = `${layer.cents} 1 0`;
      return segment;
    }),
  );

  ovLayers.replaceChildren(
    ...layers.map((layer) =>
      layerRow(layer.key, layer.colour, layer.name, layer.sub, layer.cents, layer.body()),
    ),
  );
}

// A bar's figure, short enough for seven bars side by side on a phone.
function barFigure(cents) {
  return cents >= 100000 ? `$${(cents / 100000).toFixed(1)}k` : wholeDollars(cents);
}

// Six months back and this one, each bar the same figure as Money's total
// for its month. Stacked from the bottom: Commitments, which barely move,
// then Everyday, then One-offs, so what changed sits on top.
function renderMonthByMonth() {
  if (!sources.ledger.loaded) {
    mmSentence.textContent = sources.ledger.failed ? "Needs the ledger to load." : "Loading…";
    mmBars.replaceChildren();
    mmPanel.replaceChildren();
    return;
  }
  const months = monthByMonth(expensesCache, new Date());
  const current = months[months.length - 1];
  const selected = months.find((month) => month.key === monthPicked && month.split) ?? current;
  // Money's total, not its Out figure: Out also counts Investment & Insurance.
  const matching = "Spending each month, matching Money's total. Investment & Insurance isn't counted.";
  mmSentence.textContent = months.some((month) => !month.split)
    ? `${matching} Months before the ledger's first full month stay blank.`
    : matching;

  const name = (month) =>
    `${monthShortFmt.format(month.date)} ${month.date.getFullYear()}${month.current ? " so far" : ""}`;
  // One scale for all seven. Heights in pixels, not percentages: a percent
  // height inside nested flex boxes renders differently on the phone than
  // in a desktop preview.
  const tallest = Math.max(1, ...months.map((month) => month.totalCents));
  const height = (cents) => `${Math.max(2, Math.round((cents / tallest) * MONTH_BAR_PX))}px`;
  mmBars.replaceChildren(
    ...months.map((month) => {
      const column = el("button", month.current ? "mm-col mm-now" : "mm-col");
      column.type = "button";
      column.setAttribute("aria-pressed", String(month === selected));
      const bar = el("span", "mm-bar");
      if (month.split) {
        column.setAttribute("aria-label", `${name(month)}: ${wholeDollars(month.totalCents)}`);
        const parts = [
          [month.split.oneOffCents, "mm-one"],
          [month.split.everydayCents, "l2"],
          [month.split.commitmentCents, "l1"],
        ];
        for (const [cents, colour] of parts) {
          if (cents <= 0) continue;
          const segment = el("span", `mm-seg ${colour}`);
          segment.style.height = height(cents);
          bar.append(segment);
        }
        column.addEventListener("click", () => {
          monthPicked = month.key;
          renderMonthByMonth();
        });
      } else {
        column.disabled = true;
        column.setAttribute("aria-label", `${name(month)}: not in the ledger`);
      }
      column.append(
        el("span", "mm-fig", month.split ? barFigure(month.totalCents) : ""),
        bar,
        el("span", "mm-lab", monthShortFmt.format(month.date)),
        el("span", "mm-sub", month.current ? "so far" : ""),
      );
      return column;
    }),
  );

  const head = el("div", "mm-head");
  head.append(el("span", null, name(selected)), el("span", null, wholeDollars(selected.totalCents)));
  const line = (colour, label, cents) => {
    const row = el("div", "mm-line");
    const named = el("span");
    named.append(el("i", `mm-key ${colour}`), label);
    row.append(named, el("span", null, wholeDollars(cents)));
    return row;
  };
  mmPanel.replaceChildren(
    head,
    line("mm-one", "One-offs", selected.split.oneOffCents),
    line("l2", "Everyday", selected.split.everydayCents),
    line("l1", "Commitments", selected.split.commitmentCents),
  );
}

// Every figure here is one tap from its rows. It has its own query, which
// dates from when the ledger cache held only the newest 1000 entries; the
// cache is complete since v1.26 and the query stays as it is.
async function refreshOneOffs() {
  try {
    const lumpy = categoriesCache.filter((c) => c.kind === "lumpy").map((c) => c.id);
    oneOffRows = await fetchOneOffCandidates(oneOffsSince(todayISO()), ONE_OFF_CENTS / 100, lumpy);
    oneOffStatus.hidden = true;
    renderOneOffs();
  } catch (error) {
    oneOffStatus.textContent = isOffline(error)
      ? "No connection — couldn't load the one-offs."
      : `Couldn't load the one-offs: ${error.message}`;
    oneOffStatus.hidden = false;
  }
}

function renderOneOffs() {
  const { items, totalCents } = oneOffs(oneOffRows);
  oneOffTotal.textContent = wholeDollars(totalCents);
  oneOffEmpty.hidden = items.length > 0;
  oneOffList.replaceChildren(
    ...items.map((expense) =>
      miniRow(
        expense.note || categoryLabel(expense.categories),
        shortDateFmt.format(isoToDate(expense.date)),
        sgd.format(Number(expense.amount)),
      ),
    ),
  );
  const lumpyNames = categoriesCache.filter((c) => c.kind === "lumpy").map((c) => c.name);
  const threshold = sgdWhole.format(ONE_OFF_CENTS / 100);
  oneOffHint.textContent =
    `${lumpyNames.length ? `${lumpyNames.join(" or ")}, or anything` : "Anything"} ${threshold} and over that isn't a commitment. ` +
    "Group bills use your share, so a big dinner where your part was small stays in Everyday.";
}

document.getElementById("dash-overview").addEventListener("click", () => showTab("rec"));

// ── Money in (v1.24) ──────────────────────────────────────────────────
// Shawn knew what went out but only roughly that income was higher, so
// the app couldn't say what the household keeps each month. In, Out and
// Savings answer that for the month on screen. Out is total outflow,
// counted or not. Investment & Insurance stays in Out: it isn't savings
// until it matures, and then it is logged as money in (Shawn,
// 2026-11-08). Names show only in the
// list, never as per-person totals.
const flowInBox = document.getElementById("flow-in-box");
const flowIn = document.getElementById("flow-in");
const flowOut = document.getElementById("flow-out");
const flowLeft = document.getElementById("flow-left");
const flowLeftBox = document.getElementById("flow-left-box");
const flowHint = document.getElementById("flow-hint");
const inflowListDialog = document.getElementById("inflow-list-dialog");
const inflowListTitle = document.getElementById("inflow-list-title");
const inflowSalary = document.getElementById("inflow-salary");
const inflowOther = document.getElementById("inflow-other");
const inflowList = document.getElementById("inflow-list");
const inflowEmpty = document.getElementById("inflow-empty");
const inflowDialog = document.getElementById("inflow-dialog");
const inflowForm = document.getElementById("inflow-form");
const inflowDialogTitle = document.getElementById("inflow-dialog-title");
const inflowStatus = document.getElementById("inflow-status");
const inflowSave = document.getElementById("inflow-save");
const inflowDelete = document.getElementById("inflow-delete");
let inflowEditing = null; // the row being edited; null while adding
let inflowFromList = false; // reopen the list when the form closes

async function refreshInflows() {
  try {
    inflowsCache = await fetchInflows();
    sources.inflows = { loaded: true, failed: null };
  } catch (error) {
    sources.inflows.failed = isOffline(error)
      ? "No connection — couldn't load money in."
      : `Couldn't load money in: ${error.message}`;
  }
  renderFlow();
  if (inflowListDialog.open) renderInflowList();
}

// v1.25: the $ sheet carries the same three boxes. Both sets are painted
// from one reading, so Money and the sheet can never disagree.
const sheetIn = document.getElementById("sheet-in");
const sheetOut = document.getElementById("sheet-out");
const sheetLeft = document.getElementById("sheet-left");
const sheetLeftBox = document.getElementById("sheet-left-box");
const sheetPrev = document.getElementById("sheet-prev");
const sheetNext = document.getElementById("sheet-next");

function paintFlowBoxes([inEl, outEl, leftEl, leftBox], { inCents, outflowCents, leftCents, inflowsReady, ledgerReady }) {
  inEl.textContent = inflowsReady ? wholeDollars(inCents) : "—";
  outEl.textContent = ledgerReady ? wholeDollars(outflowCents) : "—";
  const showLeft = leftCents !== null;
  leftEl.textContent = showLeft
    ? (leftCents < 0 ? `−${wholeDollars(-leftCents)}` : wholeDollars(leftCents))
    : "—";
  leftBox.classList.toggle("flow-left-kept", showLeft && leftCents >= 0);
  leftBox.classList.toggle("flow-left-short", showLeft && leftCents < 0);
}

function renderFlow() {
  const key = monthKey(dashDate);
  const ledgerReady = sources.ledger.loaded;
  const inflowsReady = sources.inflows.loaded;
  const { outflowCents } = summarize(expensesCache, dashDate);
  const { inCents, rows } = monthInflows(inflowsCache, key);
  const leftCents = savingsCents({
    inCents,
    outflowCents,
    ready: ledgerReady && inflowsReady,
    hasRows: rows.length > 0,
  });
  const figures = { inCents, outflowCents, leftCents, inflowsReady, ledgerReady };
  paintFlowBoxes([flowIn, flowOut, flowLeft, flowLeftBox], figures);
  paintFlowBoxes([sheetIn, sheetOut, sheetLeft, sheetLeftBox], figures);

  const lines = [];
  if (sources.inflows.failed) {
    lines.push(sources.inflows.failed);
  } else if (inflowsReady && rows.length === 0) {
    lines.push("Log what comes in to see the month's savings.");
  }
  if (rows.length > 0) lines.push("Tap In for the list.");
  flowHint.textContent = lines.join(" ");
  flowHint.hidden = lines.length === 0;
}

function renderInflowList() {
  const { rows, salaryCents, otherCents } = monthInflows(inflowsCache, monthKey(dashDate));
  const otherYear = dashDate.getFullYear() !== new Date().getFullYear();
  inflowListTitle.textContent = `Money · ${monthFmt.format(dashDate)}${otherYear ? ` ${dashDate.getFullYear()}` : ""}`;
  // the same bounds as Money's own ‹ ›, which renderDashboard has just set
  sheetPrev.disabled = dashPrev.disabled;
  sheetNext.disabled = dashNext.disabled;
  renderFlow();
  inflowSalary.textContent = `Salary ${sgd.format(salaryCents / 100)}`;
  inflowOther.textContent = `Other ${sgd.format(otherCents / 100)}`;
  inflowEmpty.hidden = rows.length > 0;
  if (sources.inflows.failed) {
    inflowEmpty.hidden = false;
    inflowEmpty.textContent = sources.inflows.failed;
  } else {
    inflowEmpty.textContent = "Nothing logged as coming in this month.";
  }
  inflowList.replaceChildren(...rows.map(inflowRow));
}

function inflowRow(inflow) {
  const li = document.createElement("li");
  const own = inflow.created_by === currentUser?.id;
  const row = document.createElement(own ? "button" : "div");
  row.className = "inflow-row";
  if (own) {
    row.type = "button";
    row.addEventListener("click", () => {
      inflowListDialog.close();
      openInflowForm(inflow, { fromList: true });
    });
  }
  const text = el("span", "inflow-text");
  const title = el("span", "inflow-title", inflowTitle(inflow));
  const tag = el("span", `inflow-tag inflow-tag-${inflow.whose.toLowerCase()}`, inflow.whose);
  const date = shortDateFmt.format(isoToDate(inflow.date));
  const meta = el(
    "span",
    "inflow-meta",
    inflowShowsKind(inflow) ? `${date} · ${KIND_LABEL[inflow.kind]}` : date,
  );
  text.append(title, tag, meta);
  const amount = el("span", "inflow-amount", sgd.format(Number(inflow.amount)));
  row.append(text, amount);
  li.append(row);
  return li;
}

function openInflowList() {
  renderInflowList();
  inflowListDialog.showModal();
}

function openInflowForm(inflow = null, { fromList = false } = {}) {
  inflowEditing = inflow;
  inflowFromList = fromList;
  inflowDialogTitle.textContent = inflow ? "Edit money in" : "Money in";
  inflowForm.amount.value = inflow ? Number(inflow.amount).toFixed(2) : "";
  inflowForm.date.value = inflow?.date ?? todayISO();
  // set each radio outright: assigning a value no radio has would leave
  // the last pick checked
  setRadio("whose", inflow?.whose ?? displayNameFor(currentUser));
  setRadio("kind", inflow?.kind ?? "salary");
  inflowForm.note.value = inflow?.note ?? "";
  inflowDelete.hidden = !inflow;
  showInflowStatus(null);
  inflowDialog.showModal();
}

function setRadio(name, value) {
  for (const radio of inflowForm.querySelectorAll(`input[name="${name}"]`)) {
    radio.checked = radio.value === value;
  }
}

function closeInflowForm() {
  inflowDialog.close();
}

// Closing the form, by any route (Cancel, Escape, a save), goes back to
// the list when that is where it was opened from.
inflowDialog.addEventListener("close", () => {
  if (inflowFromList) {
    inflowFromList = false;
    openInflowList();
  }
});

function showInflowStatus(message) {
  inflowStatus.textContent = message ?? "";
  inflowStatus.hidden = !message;
}

function inflowFailure(failure, verb) {
  return isOffline(failure)
    ? `No connection — not ${verb}.`
    : `Couldn't ${verb === "saved" ? "save" : "delete"}: ${failure.message}`;
}

inflowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error, fields } = inflowFields({
    amount: evaluateAmount(inflowForm.amount.value),
    date: inflowForm.date.value,
    whose: inflowForm.whose.value,
    kind: inflowForm.kind.value,
    note: inflowForm.note.value,
  });
  if (error) {
    showInflowStatus(error);
    return;
  }
  inflowSave.disabled = true;
  inflowSave.textContent = "Saving…";
  try {
    if (inflowEditing) await updateInflow(inflowEditing.id, fields);
    else await addInflow(fields);
    // a save for another month moves the view there, so it can be seen
    if (fields.date.slice(0, 7) !== monthKey(dashDate)) dashDate = startOfMonth(isoToDate(fields.date));
    await refreshInflows();
    renderDashboard(expensesCache);
    renderCards(expensesCache);
    closeInflowForm();
  } catch (failure) {
    showInflowStatus(inflowFailure(failure, "saved"));
  } finally {
    inflowSave.disabled = false;
    inflowSave.textContent = "Save";
  }
});

inflowDelete.addEventListener("click", async () => {
  if (!inflowEditing) return;
  if (!confirm(`Delete this inflow (${inflowTitle(inflowEditing)}, ${sgd.format(Number(inflowEditing.amount))})?`)) return;
  inflowDelete.disabled = true;
  try {
    await deleteInflow(inflowEditing.id);
    await refreshInflows();
    closeInflowForm();
  } catch (failure) {
    showInflowStatus(inflowFailure(failure, "deleted"));
  } finally {
    inflowDelete.disabled = false;
  }
});

document.getElementById("inflow-cancel").addEventListener("click", closeInflowForm);
document.getElementById("flow-add").addEventListener("click", () => openInflowForm());
flowInBox.addEventListener("click", openInflowList);
document.getElementById("inflow-list-close").addEventListener("click", () => inflowListDialog.close());
// v1.25: one tap from anywhere to the month's money. Stepping months in
// the sheet moves Money's month too, so closing it lands on the same month.
document.getElementById("money-jump").addEventListener("click", openInflowList);
sheetPrev.addEventListener("click", () => {
  showMonth(shiftMonth(dashDate, -1));
  renderInflowList();
});
sheetNext.addEventListener("click", () => {
  showMonth(shiftMonth(dashDate, 1));
  renderInflowList();
});
document.getElementById("inflow-list-add").addEventListener("click", () => {
  inflowListDialog.close();
  openInflowForm(null, { fromList: true });
});

// ── Coming up: the household horizon (v1.15) ─────────────────────────
// Not a calendar. The things the household jointly needs to see — a
// charge landing, a chore due, an evening booked — assembled from data
// the app already holds plus the few events worth sharing. A personal
// appointment belongs in the calendar already on the phone; the test
// for anything added here is whether both of you need to know.

const soonList = document.getElementById("soon-list");
const soonEmpty = document.getElementById("soon-empty");
const soonHint = document.getElementById("soon-hint");
const soonStatus = document.getElementById("soon-status");
const soonRecStatus = document.getElementById("soon-rec-status");
const soonWindow = document.getElementById("soon-window");
const soonCharges = document.getElementById("soon-charges");
const soonChargeList = document.getElementById("soon-charge-list");
let chargesOpen = false;
const eventForm = document.getElementById("event-form");
const eventStatus = document.getElementById("event-status");

let eventsCache = [];

async function refreshSoon() {
  try {
    eventsCache = await fetchEvents();
    soonStatus.hidden = true;
    renderSoon();
  } catch (error) {
    soonStatus.textContent = isOffline(error)
      ? "No connection — couldn't load what's coming."
      : `Couldn't load what's coming: ${error.message}`;
    soonStatus.hidden = false;
  }
}

// Reads from the caches the other tabs already fill, so switching to
// this tab costs no fetch — and it stays right when a to-do is checked
// off or a charge confirmed, because those call their own refresh.
function renderSoon() {
  const today = todayISO();
  const groups = horizon(
    { todos: todosCacheRows, recurring: recurringCache, events: eventsCache },
    today,
  );
  soonWindow.textContent = "next 30 days";
  // Until Recurring has loaded there are no charges to show, so "nothing
  // coming" would be a guess (v1.22). A failed load says so instead.
  const chargesMissing = !sources.recurring.loaded;
  const missingNote = chargesMissing ? sources.recurring.failed : null;
  soonRecStatus.textContent = missingNote ? `${missingNote} Charges aren't shown.` : "";
  soonRecStatus.hidden = !missingNote;
  // "nothing coming" must look at everything, not just the day list: with
  // only monthly charges ahead the list is empty and the line above isn't
  soonEmpty.hidden = groups.length > 0 || chargesMissing;

  const charges = upcomingCharges(groups, today);
  renderCharges(charges, today);

  soonList.replaceChildren(
    ...dayList(groups).flatMap((group) => [soonDay(group), ...group.items.map(soonItem)]),
  );

  const monthly = charges.items.filter(isMonthlyCharge).length;
  soonHint.hidden = monthly === 0;
  soonHint.textContent =
    monthly === 1
      ? "1 routine monthly charge stays inside the line above."
      : `${monthly} routine monthly charges stay inside the line above.`;
}

// The headline is the REST OF THIS MONTH, not the whole rolling
// window (v1.15.1, Shawn's catch): the window spans two months, and a
// figure that mixes them cannot be added to the dashboard's "spent
// this month" — which is exactly what anyone would do with it. The
// remainder of the window is still shown, as its own separate fact.
function renderCharges(charges, today) {
  const nothing = charges.items.length === 0;
  soonCharges.hidden = nothing;
  soonChargeList.hidden = nothing || !chargesOpen;
  if (nothing) return;

  const monthName = monthFmt.format(isoToDate(today));
  const parts = [`${sgd.format(charges.monthCents / 100)} more in ${monthName}`];
  if (charges.laterCount > 0) {
    parts.push(`${sgd.format(charges.laterCents / 100)} after that`);
  }
  soonCharges.textContent = `${parts.join(" · ")}  ${chargesOpen ? "▴" : "▾"}`;
  soonCharges.setAttribute("aria-expanded", String(chargesOpen));

  const monthEnd = charges.items.filter((i) => i.date <= endOfMonth(today));
  soonChargeList.replaceChildren(
    ...charges.items.map((item) => {
      const row = document.createElement("div");
      row.className = "charge-row";
      const when = document.createElement("span");
      when.className = "charge-when";
      when.textContent = shortDateFmt.format(isoToDate(item.date));
      const name = document.createElement("span");
      name.className = "charge-name";
      name.textContent = item.label;
      const amount = document.createElement("span");
      amount.className = "charge-amt";
      amount.textContent = sgd.format(item.amount);
      // the month boundary is drawn, so "more in September" is
      // checkable against the rows rather than taken on trust
      if (!monthEnd.includes(item)) row.classList.add("charge-later");
      row.append(when, name, amount);
      return row;
    }),
  );
}

soonCharges.addEventListener("click", () => {
  chargesOpen = !chargesOpen;
  renderSoon();
});

function soonDay(group) {
  const head = document.createElement("div");
  head.className = "soon-day";
  const when = document.createElement("span");
  const date = isoToDate(group.date);
  when.textContent = dateFmt.format(date);
  const rel = document.createElement("span");
  rel.className = "soon-rel";
  rel.textContent = relativeDay(group.date);
  head.append(when, rel);
  return head;
}

// "today" and "tomorrow" read faster than a date you have to compare
// against today's; past that, a day count is the honest form.
function relativeDay(iso) {
  const days = Math.round((isoToDate(iso) - isoToDate(todayISO())) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  return `in ${Math.round(days / 7)} week${days < 11 ? "" : "s"}`;
}

const SOON_ICON = { event: "📅", recurring: "🔁", todo: "✅" };

function soonItem(item) {
  const row = document.createElement("div");
  row.className = "soon-row";

  const icon = document.createElement("span");
  icon.className = "soon-icon";
  icon.textContent = SOON_ICON[item.kind];
  icon.setAttribute("aria-hidden", "true");

  const main = document.createElement("div");
  main.className = "soon-main";
  const title = document.createElement("div");
  title.className = "soon-title";
  title.textContent = item.label; // textContent: all three are user input
  if (item.kind === "todo" && item.urgent) {
    const tag = document.createElement("span");
    tag.className = "todo-urgent-tag";
    tag.textContent = " urgent";
    title.append(tag);
  }
  main.append(title);

  const bits = [];
  if (item.time) bits.push(item.time.slice(0, 5));
  if (item.note) bits.push(item.note);
  if (item.kind === "recurring") bits.push(item.who);
  if (item.kind === "event" && item.who) bits.push(`added by ${item.who}`);
  if (bits.length) {
    const meta = document.createElement("div");
    meta.className = "soon-meta";
    meta.textContent = bits.join(" · ");
    main.append(meta);
  }

  row.append(icon, main);

  if (item.kind === "recurring") {
    const amount = document.createElement("span");
    amount.className = "soon-amt";
    amount.textContent = sgd.format(item.amount);
    row.append(amount);
  }
  return row;
}

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  eventStatus.hidden = true;
  try {
    await addEvent({
      title: document.getElementById("event-title").value.trim(),
      date: document.getElementById("event-date").value,
      at_time: document.getElementById("event-time").value || null,
      note: document.getElementById("event-note").value.trim() || null,
      author: displayNameFor(currentUser) ?? "Shawn",
    });
    eventForm.reset();
    await refreshSoon();
  } catch (error) {
    eventStatus.textContent = isOffline(error) ? "No connection — not added." : `Couldn't add it: ${error.message}`;
    eventStatus.hidden = false;
  }
});

// ── Someday: things we want to do (v1.15) ────────────────────────────
// A third value on the todos list discriminator. A wish is not a task:
// no date, never overdue, and checking it off means "we did it" rather
// than "handled". It rides the to-do machinery because structurally it
// is the same row — but it earns no tab, because you add to it monthly,
// not daily.

const wishList = document.getElementById("wish-list");
const wishEmpty = document.getElementById("wish-empty");
const wishDoneToggle = document.getElementById("wish-done-toggle");
const wishDoneList = document.getElementById("wish-done-list");
const wishForm = document.getElementById("wish-form");
const wishStatus = document.getElementById("wish-status");

wishForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  wishStatus.hidden = true;
  const body = document.getElementById("wish-body").value.trim();
  if (!body) return;
  try {
    await addTodo({ body, list: "wish", author: displayNameFor(currentUser) ?? "Shawn" });
    wishForm.reset();
    await refreshTodos();
  } catch (error) {
    wishStatus.textContent = isOffline(error) ? "No connection — not added." : `Couldn't add it: ${error.message}`;
    wishStatus.hidden = false;
  }
});

document.getElementById("wish-done-toggle").addEventListener("click", () => {
  doneOpenWish = !doneOpenWish;
  renderTodos(todosCacheRows);
});
