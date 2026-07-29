# JOURNEY.md — how The Nest got built

One dated entry per shipped step: what shipped, what was decided, and
why. Screenshots live in `docs/snapshots/` — **sample data only, never
real ledger amounts** (this repo is public). Raw material for a future
"how we iterated" deck.

## 2026-07-16 — Idea box: in-app friction capture

Shawn's ask: stop the Notes-app-and-copy-paste pipeline — let both
users log itches inside the app during the two-week trial. Built as
feature 7 (spec amended): `ideas` table (RLS: household reads,
add/delete own; no update — the inbox stays honest), one-line input
below the ledger, "log the itch, not the fix" in the UI copy.
**Decision:** this passed the build-now bar that filtering failed —
it is the instrument for the usage trial, so its value is front-loaded;
waiting would forfeit the data. **Lesson:** the usage-earns-scope rule
has a corollary: tooling that *harvests* usage is exempt from waiting
for it. **Same-day sequel:** shipping it before its table existed
blanked the ledger — the ideas fetch was coupled into the core load.
Fixed by isolating it (`3ff209f`); header 💡 button added after the
below-the-ledger placement failed the thumb test (`af25fff`).
Blast radius should match the importance of what failed.

## 2026-07-16 — Security audit + privacy correction (`39cd3ab`)

Full pass at v1.0 close. **Verified:** anon refused on every read/
write/delete/signup/admin call (grant layer, tested live with the
publishable key); owner-only insert/update/delete confirmed in
`pg_policies` (`created_by = auth.uid()`) and armed via
`pg_tables.rowsecurity = true` on both tables; no secrets in code or
git history; no XSS sinks (all DOM via `textContent`). **Fixed:** the
`HOUSEHOLD` map shipped both login emails in the public repo — removed;
display names now come from Supabase auth metadata via
`js/identity.js`. **Decisions:** git history scrub declined — emails
were public from step 2, force-push is irreversible and only partial
(GitHub retains commits by hash; caches/forks persist), low value for
the effort. **Lesson:** an email is a username, not a secret — brute-
force defense is closed signups + auth rate-limiting + strong unique
passwords, not email secrecy. Leaked-password protection (HaveIBeenPwned
check) enabled 2026-07-16; it applies when a password is set or changed.

## 2026-07-15 — Step 1: schema + RLS (`955f7d6`)

Two tables (`expenses`, `categories`) deployed to Supabase. Two-layer
security: table grants to `authenticated` only, then deny-by-default
RLS — household-wide reads, owner-only edits. Verified by attacking our
own API with the public key: 401 on read, write, and signup.
**Decision:** disable signups *before* creating the two accounts, so
the door was never open. **Lesson:** grants gate tables, RLS gates
rows; the publishable key is identification, not authorization.

## 2026-07-15 — Step 2: scaffold + auth (`f4d9eda`)

Vanilla ES-module scaffold, green × pastel-pink palette, supabase-js
via CDN (no build step), email/password login with visible errors.
Deployed to GitHub Pages; first real login on Shawn's phone.
**Decision:** `onAuthStateChange` as the single view-state machine.
**Lesson:** iOS Chrome is WebKit — Safari rules apply identically.

## 2026-07-15 — Step 3: expense form + shared ledger (`443a191`)

Log-an-expense form tuned for the 10-second budget (defaults: today,
logged-in payer; amount+note clear after save, the rest sticks).
Reverse-chron ledger, edit/delete own entries only. **Decision:** a
data-layer file (`js/data.js`) owns every query. **Lesson:** UI hides
buttons as courtesy; RLS is the actual enforcement. Notes render via
`textContent` — XSS killed by API choice.

## 2026-07-16 — Step 4: monthly dashboard (`bffc02e`, `e77cce7`)

Headline total top-left (Z-pattern), category split bars, last-month
comparison. Computed client-side from the ledger's own fetch — zero new
queries. **Decision:** bar style chosen by rendering four candidates
and picking by eye (green fill, pink track). **Lesson:** sum money in
integer cents; floats drift.

## 2026-07-16 — Ledger polish + IDEAS.md (`ebe29f1`)

Category bold, note muted — same line, clear hierarchy. IDEAS.md
created for deferred candidates (multi-currency, filtering).
**Decision:** polish shipped features immediately; new scope waits for
usage evidence.

## 2026-07-16 — Step 6: PWA install + service worker

Manifest (standalone display, relative start_url/scope for the Pages
subpath), icon — two eggs in a nest, one green one pink — and a
service worker with a deliberate strategy: network-first for our own
files (staleness impossible while online, cache is the offline
fallback), stale-while-revalidate for the CDN, and no caching at all
for Supabase so data failures stay visible. **Decision:** categories
stay table-editor-edited in v1.0; in-app manager deferred to IDEAS.md.
v1.0 feature-complete.

## 2026-07-16 — Comparison redesign: 3-month view + average

Shawn's critique from real use: one reference month is noise — a
big-ticket June makes the anchor moot. **Decision** (from two rendered
candidates): past-3-months row under the headline plus a 3-month
average top-right; the average dilutes one-off months, the row shows
the distribution. Whole dollars in trend text, cents stay in the
ledger. Month-window logic unit-tested in Node (first-month, partial
history, zero-spend months). SPEC.md feature 3 amended — first
usage-driven spec change. Also: JOURNEY.md + snapshot practice added
to CLAUDE.md process standards.

## 2026-07-16 — Step 5: duplicate warning + CSV export (`93496cf`)

±1-day same-amount check against the database (catches the other
phone's entry), warns via confirm and never blocks — even when the
check itself fails. CSV export pages past the 1000-row API cap,
escapes properly, BOM for Excel. **Lesson:** a backup that silently
truncates is worse than none.

## 2026-07-16 — Privacy correction: login emails out of client code

Review found both real login emails hard-coded in `js/config.js` — a
public repo, and Pages serves every client file to anyone regardless.
Removed the `HOUSEHOLD` email map; display names now come from Supabase
auth metadata (`user_metadata.display_name`, set once per account) via
`js/identity.js`, unit-tested in Node (`node --test tests/*.test.mjs`).
Fallbacks stay visible: header shows the login email until metadata is
set; the
paid-by radio keeps `required` and simply asks. **Decision:** personal
identifiers never ship in repo or client code — rule added to CLAUDE.md.
**Lesson:** RLS protects rows, not facts printed in source; "no secrets"
and "no real amounts" weren't rules enough to catch PII. Still pending
(separate, deliberate steps): set `display_name` on both accounts,
scrub the two old commits from public history, then deploy.

## 2026-07-29 — v1.1 locked + piece 1: entry-first layout

Harvested the idea box (11 captures, both authors) into IDEAS.md and
scoped v1.1 with Shawn: entry-first layout, category system (+ one-time
recategorization, Blessing excluded-from-totals), ledger day-grouping +
person filter, inline amount calculator. v1.2 direction: zero-touch
capture from bank alerts (discovery fieldwork runs during the build).
**Decision:** receipt parsing's "zero raises" was anticipation, not
absence of demand — silence only counts as evidence when users don't
think the thing is already promised. Tagged `v1.0` as rollback anchor;
DB changes additive-only. Piece 1 shipped: the log form now sits above
the dashboard — both users independently asked for it on 07-19; the app
is an input tool first, a report second. Verified: section order + no
console errors in local preview, node tests green.

## 2026-07-29 — v1.1 piece 2a: categories in the database + icons + Blessing

Ran the first production migration through Shawn's Supabase session
(after his explicit go): icons + excluded_from_totals columns, four new
categories (🎁 Gifts, 💆 Wellness, 📚 Learning, 🙏 Blessing), Other
sorted last. Additive + idempotent, verified by read-back — 10 rows.
App side: icons render in dropdown, ledger, and dashboard; dashboard
math moved to js/dashboard-math.js (pure, Node-tested) and now honours
excluded_from_totals — Blessing shows on the dashboard as "not counted"
and never inflates the monthly total or past-month sums. **Decision:**
piece 2 split 2a (data + display) / 2b (manager UI) to keep ships
small. Tests 4/4; preview console clean.

## 2026-07-29 — v1.1 piece 2b: in-app category manager

Categories card + native dialogs: add / rename / icon / excluded flag,
delete-via-reassign. Cross-user reassign runs through a SECURITY
DEFINER function (reassign_and_delete_category) — the one narrow door
past the own-rows RLS policy; grants verified by read-back: execute
for authenticated only, anon/public revoked, prosecdef true.
**Decision:** category taxonomy is retroactive by design (renames free,
reassigns rewrite history, excluded flag applies at render time); CSV
exports are the time-capsules. Recorded in SPEC.md after Shawn's
pre-go design review; per-category month-on-month comparison logged in
IDEAS.md from the same conversation. **Process note:** the SQL editor's
autocomplete corrupted a typed migration ("returns void" became
"returns storage.vector_indexes") — caught by the screenshot-verify-
before-run rule; retyped single-line. Verify before run is not
optional.

## 2026-07-29 — 2b polish from phone check: header 🏷️ jump

Shawn couldn't find the Categories card (below the full ledger — right
home for a rare-use feature, wrong reachability). His fix shipped: a
🏷️ header button jumping to the card, mirroring the 💡 idea-jump
pattern. Shopping category added by Shawn himself via the manager —
the feature validating itself. Reordering wart (new categories land
after Other) recorded in IDEAS.md.

## 2026-07-29 — three phone-check fixes: 🔖 contrast, instant jump, sort bug

Shawn's second phone pass found: (1) 🏷️ faded into the pastel header
— now 🔖; (2) the jump didn't scroll at all on iOS — smooth
scrollIntoView silently no-ops in the PWA (💡 only works because
focusing its input makes iOS scroll to the keyboard); instant jump
now, reliable everywhere; (3) real bug: fetchCategories omitted
sort_order, so the manager's "append at end" computed from undefined
and sent 🛍️ Shopping to position 1 (tied with Groceries, displayed
second). Fetch fixed + deterministic tie-break; Shopping/Other
sort_order repaired by one-off SQL (the reorder-on-request precedent).
**Lesson:** the phone check catches what unit tests structurally can't
— the tests never fetch.

## 2026-07-29 — the glide, done properly: 🗃️ + hand-rolled scroll animation

Shawn wanted the 💡-style glide for the category jump — rightly. Root
cause finally clear: iOS PWAs silently ignore smooth scrollIntoView;
💡's glide was never our code, it's iOS animating toward a focused
input's keyboard. Fix: hand-rolled rAF glide (ease-out cubic, 400ms)
with a 100ms no-frame fallback to an instant jump — verified in the
frame-suspended preview (fallback) and awaiting phone check (glide).
Icon now 🗃️ (Shawn's pick for backdrop contrast). Back-to-top:
explicitly NOT built — iOS status-bar tap covers it (recorded in
IDEAS.md). Two lessons: platform quirks hide behind lookalike
behaviour, and the cheapest feature is the one the OS already ships.

## 2026-07-29 — v1.1 piece 3: ledger day-grouping + person filter

The Claire-and-Shawn de-clutter ask, live: entries now group under
uppercase day headers (per-entry dates dropped as redundant), and an
All / Shawn / Claire segmented filter sits under the Ledger title —
view-only state, re-rendered from cache, dashboard untouched. Logic
extracted pure (js/ledger-view.js, 3 Node tests: grouping order,
filter dropping empty days, empty states). Filter wiring verified
end-to-end in preview; day-header styling checked dressed at mobile
width. Tests 7/7.

## 2026-07-29 — v1.1 piece 4: inline calculator + category filter (scope change)

The amount field is now a calculator: + − × ÷ with standard
precedence, cent rounding, live "= S$x" preview, strict hand-rolled
parser (no eval — form input stays inert). iOS reality shaped the UX:
the decimal keypad has no operator keys, so four insert-chips sit
under the field (pointerdown+preventDefault keeps the keypad open).
Same ship: ledger **category dropdown filter**, combined with the
person filter — a deliberate scope change ("Build it") minutes after
Shawn raised it post-piece-3; the defer was recorded, he overruled,
IDEAS/SPEC updated in step. Tests 14/14; calculator flow verified
end-to-end in preview (chip insert → live result).
