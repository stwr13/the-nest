# SPEC.md — The Nest v1.0

**One ledger, two people, joint money — visibility, not budgets.**

Working title: The Nest (rename later is cheap). Currency: SGD. Users: Shawn and Claire, exactly two accounts.

## Features — six, nothing else

1. **Log an expense** — amount (SGD), category, date (default today), who paid, optional note. Under 10 seconds on a phone.
2. **Shared ledger** — reverse-chronological list, both users see everything; edit/delete your own entries.
3. **Monthly dashboard** — this month's total, split by category, and a recent-months comparison: the past three months listed plus their average (amended 2026-07-16 — a single-month anchor confounds trend with variance; an average dilutes one-off big-ticket months). Z-pattern layout: headline number top-left.
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

## v1.1 — "Organise the nest" (LOCKED by Shawn 2026-07-29; build complete same day)

Build status 2026-07-29: pieces 1–4 all live and phone-verified (incl. the category-filter scope change).

**Recategorization outcome (2026-07-29) — the planned migration never ran.** Backups were taken (in-Supabase snapshot + CSV time-capsule) and a 7-entry proposal prepared; before it was applied, Claire had already recategorized 5 of them by hand using the manager shipped that morning. Two stragglers (tithe S$470, JP Books S$30) deliberately left in Other at Shawn's call — Claire's sweep, Claire's finish line. **Lesson recorded:** shipping the tool made the migration mostly unnecessary; prefer giving users the lever over running the batch job. Her filing also settled the boundary in practice — money given (angbao, tithe, housewarming cash) = Blessing; purchased presents = Gifts (awaiting Shawn's confirmation before this becomes the written convention).

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

Version direction — **superseded 2026-07-30, pending lock.** The 2026-07-29 direction was "v1.2 = zero-touch capture" (bank SMS/email alerts → pending entries → one-tap confirm; design sketch in IDEAS.md). Scoping on 07-30 proposed reordering: **v1.2 = the second module** (tab navigation + shared to-dos, Ship 1; notifications platform, Ship 2 — see IDEAS.md), pushing **zero-touch capture to v1.3**, which loses nothing since it is gated on the alert-channel fieldwork anyway and would inherit Ship 2's push plumbing. Neither is locked; the open-decisions board at the top of IDEAS.md is authoritative.

Not in v1.1, with reasons:

- **Zero-touch capture / AI entry** — deferred to v1.2, not rejected. (Evidence note corrected 2026-07-29: it wasn't raised in the idea box because both users assumed it was already the next build.) It needs the alert-channel discovery plus new server plumbing (Edge Function, pending-entry state, confirm UI) — bundling it into v1.1 would stall four small certain wins behind one large uncertain one; the ship-small rule says sequence them. Edge-Function-only rule stands.
- **Multi-currency** — no live raises (no trips in the window); stopgap stands.
- **Recurring payments / commitments registry** — parked by its own author ("may not be the immediate next fix") until re-raised.
- **Per-person emoji on "paid by"** — folded into the category-icons work only if free; not a scope item.
