# SPEC.md — The Nest v1.0

**One ledger, two people, joint money — visibility, not budgets.**

Working title: The Nest (rename later is cheap). Currency: SGD. Users: Shawn and Claire, exactly two accounts.

## Features — six, nothing else

1. **Log an expense** — amount (SGD), category, date (default today), who paid, optional note. Under 10 seconds on a phone.
2. **Shared ledger** — reverse-chronological list, both users see everything; edit/delete your own entries.
3. **Monthly dashboard** — this month's total, split by category, and a recent-months comparison: the past three months listed plus their average (amended 2026-07-16 — a single-month anchor confounds trend with variance; an average dilutes one-off big-ticket months; amended 2026-11-07 — the comparison is now Everyday against Everyday, see v1.19). Z-pattern layout: headline number top-left.
4. **Duplicate warning** — same amount within ±1 day prompts "possible duplicate — save anyway?" Warns, never blocks.
5. **Two-account auth** — email + password via Supabase; signups closed after both accounts exist.
6. **CSV export** — one button, full ledger download. This is the backup story.
7. **Idea box** (added 2026-07-16) — one-line friction/idea capture inside the app, so both users can log itches during real use without leaving it. Raw notes live in the `ideas` table (household reads all, add/delete own); curated into IDEAS.md at scoping time. Process tooling, not a product bet: its value is the usage-trial data itself.

## Data model

- `expenses`: amount, category_id, paid_by, date, note, created_by
- `categories`: name, sort order — seeded with placeholders; final list to be defined together at home. Edited via the Supabase Table Editor in v1.0 (amended 2026-07-16 — no UI for a twice-a-year task; in-app manager recorded in IDEAS.md)

## Known limitations (recorded, not fixed)

- Supabase free tier pauses after ~7 days of inactivity — daily use keeps it alive; unpause manually in the console if it happens.
- No offline entry: a failed save shows a visible error, nothing is queued.
- Single currency (SGD).
- The ledger view shows the most recent 1000 entries (API page cap); CSV export always contains the full history.
- iOS PWA installs via the share-sheet → Add to Home Screen (Safari or Chrome; both use WebKit on iOS).

## Out of scope for v1.0

AI parsing/Q&A (v1.1 via Edge Function), income tracking, recurring expenses, card/miles tagging, budgets, and every other Shared Brain module. Two weeks of real use decides what earns a place next.

## v1.1 — "Organise the nest" (LOCKED by Shawn 2026-07-29; build complete same day; **CLOSED 2026-08-02** — tagged `v1.1` as the new rollback anchor)

Build status 2026-07-29: pieces 1–4 all live and phone-verified (incl. the category-filter scope change).

**Recategorization outcome (2026-07-29) — the planned migration never ran.** Backups were taken (in-Supabase snapshot + CSV time-capsule) and a 7-entry proposal prepared; before it was applied, Claire had already recategorized 5 of them by hand using the manager shipped that morning. Two stragglers (the tithe and a book purchase; amounts redacted — public repo) deliberately left in Other at Shawn's call — Claire's sweep, Claire's finish line. **Lesson recorded:** shipping the tool made the migration mostly unnecessary; prefer giving users the lever over running the batch job. Her filing also settled the boundary in practice — money given (angbao, tithe, housewarming cash) = Blessing; purchased presents = Gifts — **confirmed by Shawn 2026-08-02; this was the written convention until 2026-11-07, when the two merged and both count as spending (see v1.20.1).**

Scope, in build order (each piece ships and gets phone-verified before the next starts):

1. **Entry-first layout** — log box at the top, dashboard below. Reverses the v1.0 Z-pattern decision (headline top-left); both users independently asked on 2026-07-19. The app is an input tool first, a report second.
2. **Category system** — in-app manager (add / rename / edit; past entries keep their history — delete only via reassign to another category), expanded category list defined together at home, per-category icons, and an excluded-from-totals flag (first use: "Blessing" — giving is logged but not summed into household spending).
3. **Ledger de-clutter** — entries grouped by day, plus a filter by person. Scope change 2026-07-29, deliberate (Shawn, after piece 3's phone check, overruling the recorded defer): plus a category dropdown filter, combined with the person filter.
4. **Amount-field calculator** (agreed 2026-07-29) — the amount field accepts + − × ÷ and shows the computed amount live ("405/4 = S$101.25"). Inline only; no separate calculator screen. Shape note: the iOS decimal keypad has no operator keys, so four insert-chips (+ − × ÷) sit under the field; hardware keyboards can type expressions directly.

Baseline category proposal (drafted 2026-07-29 from the current six + live-use asks; a starting point for the decide-together-at-home conversation, not a decision — the manager makes the list editable forever anyway):

| | Category | Status / note |
|---|---|---|
| 🛒 | Groceries | keep |
| 🍜 | Eating out | keep |
| 🚌 | Transport | keep |
| 🏠 | Home | keep — utilities, household, furniture |
| 🎉 | Fun | keep, now narrower — entertainment, outings, hobbies |
| 🎁 | Gifts | new (Claire's ask) — presents, weddings, birthdays |
| 💆 | Wellness | new (Claire's ask) — health, fitness, self-care |
| 📚 | Learning | new (Claire's ask) — courses, books, classes |
| 🙏 | Blessing | new (Shawn's ask) — giving; excluded from totals |
| 📦 | Other | keep — should shrink now |

Approved by Shawn 2026-07-29 as the seed list (piece 1 verified on his phone the same day); Claire amends freely via the manager once it ships. Still a you-two convention, not code: (a) Gifts vs Blessing boundary — a present is a Gift (counts as spending), giving/tithing is Blessing (doesn't); (b) Travel gets added via the manager when the first trip happens. Migration: `db/migrations/2026-07-29-categories-v1_1.sql` (additive, idempotent; no RLS changes needed — v1.0's household category policies already cover the manager).

Category-edit semantics (recorded 2026-07-29, raised by Shawn pre-go):

- **Rename / icon change** never touches expenses — entries reference category *ids*, names are looked up at display time. History is safe by construction.
- **Delete-via-reassign is atomic** — the server function runs as one transaction: either all entries move AND the category disappears, or nothing happens. No half-states.
- **The taxonomy is retroactive by design.** Reassign rewrites which category old entries belong to, and the excluded-from-totals flag applies to all history at display time. Consequence: every view answers "under today's rules, what did we spend?" — month-on-month comparisons are always apples-to-apples under the current taxonomy, but "what we called it at the time" is not preserved in-app. CSV exports are the time-capsules: an export taken today freezes today's labels.
- Alternatives considered and rejected: loosening expenses RLS so either user can edit all rows (weakens the core protection everywhere to serve a rare operation); archive-instead-of-delete (avoids rewriting history but contradicts the actual need, which is moving entries into better categories — and adds a second mode).

Attached to item 2, agreed in direction 2026-07-29:

- **One-time recategorization migration** — when the new category set exists, existing ledger entries get moved to it without anyone re-entering data: Claude proposes a new category per entry (reading the ledger through Shawn's logged-in Supabase session, as in the idea harvest), both users review the proposed mapping, then it applies in one SQL pass. A migration, not an app feature. Entries with empty/thin notes will need human eyes — the review step is the safety net. Real ledger data never enters the repo (public-repo rule).

Rollback / audit discipline for v1.1 (agreed 2026-07-29):

- **Code**: at lock, the current deployed main is tagged `v1.0` as the rollback anchor. Every v1.1 piece ships as its own commit with a JOURNEY.md entry (the audit trail). Rolling back = point main back at the tag and push; GitHub Pages redeploys v1.0 in minutes.
- **Database**: v1.1 schema changes are additive only (new columns / new rows — no renames, no drops), so v1.0 code keeps working against a v1.1 database. Rolling back the code never strands the data.
- **The one destructive step** — the one-time recategorization — gets its own undo: before it runs, (a) a CSV export (the existing backup story) and (b) an in-Supabase snapshot of `expenses` + `categories` plus the old→new mapping, so the whole move reverses with one SQL statement. Snapshots live only in Supabase, never in the repo (public-repo rule).

Version direction — ~~superseded 2026-07-30, pending lock~~ **LOCKED by Shawn 2026-08-12: v1.2 = the second module, Ship 1 only.** The 07-30 reorder is confirmed: tab navigation + shared to-dos now; the notifications platform (Ship 2) waits for real use to demand it; **zero-touch capture moves to v1.3** (loses nothing — it is gated on the alert-channel fieldwork anyway and would inherit Ship 2's push plumbing when that lands).

## v1.2 — "The second module" (LOCKED by Shawn 2026-08-12; built same day on branch `v1.2`)

Decisions at lock, all four open board calls in one sitting: Ship 1 only · piece 0 first · branch-then-merge workflow (build on a branch, verify, merge to main = deploy; `v1.1` tag is the rollback anchor — a separate "2.0" app was rejected: git protects the code, a fork would split the shared database) · scroll-jank one-liner waived (neither phone feels it).

Scope, in build order:

0. **Platform hygiene (piece 0)** — in-app version marker (footer, fed by `js/version.js`, single source shared with the service worker's cache name) + **cache-first service worker** with background revalidate. Opens are instant and work offline; an update lands one launch late, and the version marker is what makes that lag diagnosable instead of ambiguous. Supabase requests stay uncached (data failures must stay visible).
1. **Tab navigation** — bottom tab bar: Money / To-dos / Ideas. Money keeps the whole v1.1 surface; Ideas moves to its own tab (💡 header jump switches tabs); the app always opens on Money (input tool first — the v1.1 entry-first rationale).
2. **To-dos core** — one shared household list: one-line add at messaging speed, optional due date, due-first sort (dateless last), overdue highlighted, check off / reopen by either account, collapsible done history. No push notifications in this version.

Data model addition: `todos` (body, due_date, author, done_at, done_by, created_by) — RLS deviates deliberately from the expenses precedent: **household-wide update/delete**, because completing or clearing the other person's item is the core loop of a shared list. Additive only; v1.1 code runs unchanged against the v1.2 database.

Not in v1.1, with reasons:

- **Zero-touch capture / AI entry** — deferred to v1.2, not rejected. (Evidence note corrected 2026-07-29: it wasn't raised in the idea box because both users assumed it was already the next build.) It needs the alert-channel discovery plus new server plumbing (Edge Function, pending-entry state, confirm UI) — bundling it into v1.1 would stall four small certain wins behind one large uncertain one; the ship-small rule says sequence them. Edge-Function-only rule stands.
- **Multi-currency** — no live raises (no trips in the window); stopgap stands.
- **Recurring payments / commitments registry** — parked by its own author ("may not be the immediate next fix") until re-raised.
- **Per-person emoji on "paid by"** — folded into the category-icons work only if free; not a scope item.

## v1.19 + v1.20 — "One picture of the household" (LOCKED by Shawn 2026-11-07, from a reviewed mockup)

Turn a one-time spending audit into a living part of the app, without moving the report into it. It answers three questions from data the app already holds: what does a normal month take, what's inside each part, and when do the big charges land. Built in two ships, because the registry's growth had already hurt the daily screens.

**The rules, which hold on every screen:**

- **Spending is the share.** Always `expenses.amount`, never `card_charged`. Only `js/cards-math.js` reads the card charge, for miles caps, because the bank's cap counts the whole bill.
- **Every entry classes one way, in this order:** kind `invest` is set aside; a `recurring_id` makes it a commitment; kind `lumpy`, or $300 or more, makes it a one-off; everything else is everyday. Kind `give` meant giving until v1.22; nothing used it after v1.20.1, and it now reads as everyday. Code never matches on category names or note text, because categories can be renamed.
- **No per-person view on Overview.** Between the two of them money is joint and they don't track who spends what. `recurring.paid_by` stays only because Confirm needs it for the ledger. One deliberate exception (Shawn, 2026-11-07): the two tithe rows keep their people's names, so they can be told apart and tracked.
- **One-offs get no monthly average,** and one-time charges never count in a typical month.
- **No budgets.** Visibility, not budgets. (Income tracking was ruled out here too, until v1.24 below.)

**Ship 1, v1.19: protect the daily screens.**

1. **Due now folds** to one line, hidden when nothing is due. Opened: compact rows and Confirm all, which runs the existing per-item confirm and its duplicate check, and stops if a possible duplicate is declined.
2. **Coming up's day list drops monthly charges.** They stay inside the expandable summary line. Quarterly, half-yearly, yearly and one-time charges still show by date.
3. **Money splits its total** into Everyday, Commitments and One-offs for the viewed month. The total keeps its meaning. Everyday compares with the Everyday average of up to 3 earlier full months, skipping a part-month at the start of history.

**Ship 2, v1.20: Overview replaces the Recurring tab.** The tab is relabelled, and there is no sixth tab. In order: a typical month as one rounded figure with a stacked bar and four rows that open (Regular commitments; Everyday; Investment & insurance; Giving when anything is in it); Year ahead, twelve months of regular and lump charges with Everyday left out; Big one-offs over the last 12 months, listed with a total; the Running list and add form, tucked away; Stopped.

**A typical month has up to three layers, and an empty one hides:** Regular commitments is every active Recurring item not of kind invest, at its monthly equivalent. Everyday is the average of the last 3 full calendar months of entries classed as everyday. The set-aside layer is active Recurring items of kind invest, named after their category (Investment & Insurance). A fourth, Giving, went in v1.22, unused since v1.20.1. Overview shows no figures until Recurring and the ledger have both loaded.

Data model additions (`db/migrations/2026-11-07-overview-v1_19.sql`, additive): `categories.kind`; cadences `half-yearly` and `once`, the latter required to end on its own due date so it stops after one confirm. Household data changes (new categories, past entries moved and linked) ran through the SQL editor and are not in this repo. They had the SPEC's undo: a CSV export plus an in-Supabase snapshot. Rows moved to the new cadences only after both phones had the new code, because older clients don't know them.

Not in scope: setting a category's kind in the manager (new categories default to everyday; a rare enough act to stay in the SQL editor until it's raised), budgets, income, and any per-person split.

**v1.20.1, categories (Shawn, 2026-11-07): ten, not eighteen.** Groceries, Eating out, Transport, Home, Health & Wellness, Shopping, Bills & Commitments (including loans, tax, subscriptions and tithes), Travel, Investment & Insurance, Gifts/Blessings. Only Investment & Insurance stays out of totals (v1.20.2, Shawn: "in a way its investment"), so tithes and gifts count as spending, insurance premiums don't, and nothing currently has kind `give`. Run through the SQL editor with a fresh CSV and in-Supabase snapshot.

**v1.20.3, outflow (Shawn, 2026-11-07):** Money's headline stays spending. A line under it shows total outflow, including what isn't counted, whenever the two differ.

**v1.21, editing the registry (Shawn, 2026-11-07):** a Recurring item's name, amount, category and next due date can be edited from Overview or the Running list. Edits apply from the next charge and never change logged entries. How often an item repeats and which card pays it aren't editable yet.

**v1.22, repairs (Shawn, 2026-11-08):** no new scope. When Recurring or the ledger can't load, Overview and Coming up say so instead of showing figures or "nothing". A failed confirm keeps its reason and the typed amount. Every "no connection" message reads the same on the iPhone. Deleting a category moves its Recurring items too. Logged-out users hold no table rights at all, and signed-in users only the reads and writes each table grants (`db/migrations/2026-11-08-category-delete-v1_22.sql`).


## v1.24 — Money in (LOCKED by Shawn 2026-11-08, from a mockup)

Amends "no income tracking" (v1.0 and v1.19). Why: the app knew what went out, but only roughly that income was higher, so it couldn't say what the household keeps each month. With that number a projection is possible, and spending can be reined in when needed. "It doesn't have to be a full-blown feature." Still no budgets.

1. **Logging.** "+ Money in" on Money opens a form: amount, date, whose (Shawn / Claire / Both, Both for money given to the household or a joint dividend), type (Salary / Other), optional note. Each inflow is logged as it lands; a month's In is the sum. Only salary is marked; dividends, payouts and gifts are Other with a note.
2. **Money, for the month being viewed.** Spending stays the big number with the total outflow line under it. Below it, three boxes: In · Out · Left over. Out is total outflow, counted or not. A hint says how much of Out went to Investment & Insurance, since that is saving too. Left over waits for the month's first inflow rather than show minus the outflow.
3. **Tap In:** the month's inflows, Salary and Other subtotals at the top, each row with its date and a Shawn / Claire / Both tag. Tap a row you logged to edit or delete it. Names show only in this list, never as per-person totals.
4. **Data:** `inflows` (amount, date, whose, kind salary/other, note, created_by), `db/migrations/2026-11-08-inflows-v1_24.sql`. RLS like expenses: the household reads every row, each person adds, edits and deletes their own. Salary is marked so a later projection can lean on the steady part; no projection screen in this ship.
