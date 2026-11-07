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

## 2026-07-29/30 — recategorization dissolved; second module scoped

The one-time recategorization was prepped (snapshot + CSV backup,
87 rows read, 7-entry proposal) and then **not needed**: Claire had
already fixed 5 of the 7 herself in the manager shipped that morning,
including the largest-single-entry judgement call I'd flagged as
"yours to make" (housewarming → Blessing; amount redacted — public
repo). Two stragglers left in Other at Shawn's
call. Her filing settled the Gifts/Blessing boundary in practice.
Scoping 07-30: The Nest's multi-module vision restated by Shawn, so
the to-do module arrives with tab navigation (Money / To-dos / Ideas)
as Ship 1 and a notifications *platform* as Ship 2 — proposed as v1.2,
reordering zero-touch capture to v1.3. Nothing locked; open-decisions
board added to the top of IDEAS.md so any session can resume cold.

## 2026-08-01 — month-navigable dashboard (Claire's find, fixed same day)

Second idea-box harvest (3 captures, all Claire) surfaced a real hole:
on 1 August the dashboard rolled over and July's category breakdown
vanished — past months survived only as totals. The moment you most
want a month's breakdown is the moment the app stopped showing it. She
found it by tapping a month name expecting drill-down, an affordance
we never built. Fix shipped the same day at Shawn's call ("can we fix
that now, first"): ‹ › month stepping on the dashboard label, plus the
comparison-row months made tappable — honouring the interaction she
reached for. Bounded to real history (no stepping before the first
entry or into the future); saving an expense now jumps the dashboard
to that entry's month so a save is never invisible while browsing an
older month. summarize() already accepted an arbitrary target date, so
the math needed no change — one new Node test pins past-month
breakdowns (15/15). Layout caught in preview: the arrows pushed the
"3-mo avg" line off the card; fixed by tucking the ‹ to the card edge
and letting the line wrap. Also decided: alphabetical category
reordering dropped (Shawn); Claire's collapse/expand capture still
ambiguous — he reads it as minimising the whole Ledger card, and we
can't tell which build she was on because the app shows no version.

## 2026-08-01 — cold-open fix: Supabase client vendored

Shawn: "slow to open… 2-3 seconds." Measured before guessing, and his
hypothesis (rendering the whole ledger) was wrong — 90 entries render
in 20ms, 500 in 20ms, 2000 in 71ms. The real cost was the CDN: the
client was imported from esm.sh, which expanded into **16 chained
cross-origin requests**, starting at ~850ms and finishing at ~1.19s,
with the last resource at 1.35s — before a single row of data was
requested. 17.5 KB total, so pure latency, not bandwidth.
Fix: vendored the official single-file UMD build (2.111.0, no external
imports) into js/vendor/, loaded with `defer` ahead of the module, and
precached with the shell (cache bumped nest-v1 → nest-v2, esm.sh
branch deleted from the SW). One same-origin request replaces sixteen
cross-country ones. The version is pinned in the filename — upgrades
are a deliberate drop-in, not a silent CDN roll. Note: this doesn't
breach the no-build-tools rule — the dependency already shipped, it
just came from someone else's server.
Two other findings recorded, not yet acted on: the SW is network-first
for the shell (every open waits on the network even when cached — a
deliberate v1.0 trade-off, and the reason a version can lag on a
phone), and `background-attachment: fixed` on the body gradient is a
known iOS scroll-jank source. Both await Shawn's call.

## 2026-08-02 — security audit: clean bill, two fixes shipped

Full audit at Shawn's ask ("no backdoor capable of accessing my Mac
Mini or just screwing things up"). Verdict: no backdoor, and nothing
in the project can reach the Mini — static files on Pages, dev server
loopback-only, network calls go to Supabase and nowhere else. The
vendored client is byte-identical to the official 2.111.0 build
(SHA-256 matched against the npm registry). Live probes from outside:
anon reads of expenses/ideas and the anon RPC call all refused (401),
and the decisive one — account signup — returns `signup_disabled`, so
"authenticated", the role every RLS policy trusts, stays a two-person
club. First-party code has zero innerHTML/eval sinks; rendering is
textContent throughout.
Two findings, both about the public repo, both fixed today:
1. **Real ledger amounts had leaked into the narrative docs** —
   SPEC/JOURNEY/IDEAS named real figures while the code obeyed the
   no-real-data rule. Amounts redacted forward (history not scrubbed —
   accepted); CLAUDE.md now says explicitly that the rule binds the
   docs too.
2. **CSP added** (meta tag — Pages can't set headers): only own-origin
   scripts/styles run, the page can only talk to itself + Supabase,
   object-src none. Verified in preview: app renders clean, Supabase
   reachable, foreign fetch / eval / injected inline script all
   refused by the browser. XSS defence is now two independent layers.
Noted, not done: CSV formula-escaping (theoretical — only the
household writes notes).
**Record corrected:** the 07-16 entry says leaked-password protection
was enabled — the dashboard (checked live via Chrome today) shows it
DISABLED and **Pro-plan-gated**; on Free it cannot be on, so either
the save never took or it was misrecorded. Accepted as-is: the
compensating controls are closed signups, Supabase auth rate limits,
and two strong unique passwords. Also observed on the email provider
panel, left untouched pending Shawn's call: minimum password length 6
with no character requirements, and "secure password change" off.

## 2026-08-02 — v1.1 closed; category audit; debrief

Debrief held, then closure: Shawn's phone check confirmed the
cold-open fix is felt, so v1.1 was declared done — tagged `v1.1` as
the new rollback anchor. The Gifts/Blessing boundary is ratified into
SPEC (money given = Blessing, purchased presents = Gifts). The
one-off category reorder was waived; in its place, a discrepancy
audit of the live categories (12 categories, 119 entries). Verdict:
**nothing alarming.** No duplicates, no orphans, icons complete,
exactly one excluded-from-totals category (Blessing). Notables, for
the record: Eating out dominates (86 of 119 entries — 72%); Fun and
Gifts have zero entries ever; the two in-app additions (Shopping,
Essentials) sit semantically close to each other and to Home — worth
a shared definition if misfiles appear; Other still holds 3 entries
including the tithe, so July's counted total stays high until it
moves (standing household item). Cosmetic only: Shopping's sort_order
slots before Other, breaking the append-after-Other pattern.
Claire's collapse ask resolved by asking her: the whole ledger is too
long. Parked with a shape (last 20–30 entries + expand all) at
Shawn's call — "not important or crucial now."
Ops note: the backup-table drop was first blocked by Claude's
permission layer (destructive SQL), then went through on Shawn's
explicit retry instruction — with Supabase's own destructive-query
dialog as the second gate. Verified after: public schema is back to
exactly categories/expenses/ideas.
A pattern from this closure worth naming: the permission layer's
denials (auth-settings typing, destructive SQL) map onto "changes a
human should explicitly sanction" — one clear re-approval in chat is
what it takes, and that friction is a feature.

## 2026-08-12 — v1.2 locked and built on a branch: piece 0 + ship 1

Scope locked by Shawn (all four open board calls answered in one
sitting): **v1.2 = ship 1 only** — tab navigation + the to-dos core,
no push yet; **piece 0 first** (version marker + cache-first service
worker); **branch-then-merge** replaces build-on-main (the v1.1 tag
stays the rollback anchor — a separate "Nest 2.0" copy was considered
and rejected: git already protects the code, and a fork would split
the one thing git can't protect, the shared database); scroll-jank
one-liner **waived** — neither phone feels it.

Built on branch `v1.2`, all in one pass:

- **Piece 0.** `js/version.js` is the single version source — the page
  footer shows it (v1.2.0) and the service worker derives its cache
  name from it, so one bump does both jobs. The SW flips from
  network-first to **cache-first with background revalidate**: the
  shell opens instantly (and offline), the refresh lands one launch
  later. That lag stopped being scary the moment it became visible —
  and it proved itself during this very build: the first post-edit
  reload served the stale CSS, the second showed the fix, exactly as
  designed, with the footer version there to arbitrate.
- **Ship 1.** Bottom tab bar — Money / To-dos / Ideas. Money keeps
  everything that exists today; Ideas gets its own tab (the 💡 header
  jump now switches tabs and focuses the box); To-dos is new: one-line
  add at messaging speed, optional due date, due-first sort with
  dateless items sinking (pure logic in `js/todos-view.js`,
  Node-tested like its siblings), overdue in red, round-checkbox
  check-off, collapsible done list. The app always opens on Money —
  same rationale as v1.1's entry-first layout.
- **RLS deviation, deliberate.** `todos` allows household-wide
  update/delete (expenses are edit-your-own): completing — or
  clearing — the other person's item is the entire point of a shared
  list. Recorded in the migration file itself.

Verified locally (mobile viewport, tab switching, sort/overdue logic
in-browser, zero console errors, 19/19 Node tests). NOT yet merged:
the migration (`db/migrations/2026-08-12-todos-v1_2.sql`) must run in
the Supabase SQL editor first, then merge → Pages deploy → phone
check. Note for that check: cache-first means the SECOND launch after
deploy shows v1.2.0 in the footer — the first launch still serves the
old build. That's the feature working, not the deploy failing.

## 2026-08-12 (later) — v1.2.1: the form opens on your usual category

Raised by Shawn during the v1.2 phone-check wait: "can we have Eating
out as the default — on a daily we use that in comparison to others."
Built as a smart default rather than a hardcode: the expense form's
cold open lands on the category the signed-in user logs most (their
own entries, last 60 days, all-time fallback — pure logic in
`js/category-default.js`, Node-tested). Today that IS Eating out for
both accounts (72% of the ledger); if habits change or the category
is renamed, the default follows without a code change. Per-person by
design — Claire's habit sets Claire's default. Within a session the
last pick still sticks (existing behaviour). Version bumped to 1.2.1
— the phone-check target in the footer moves accordingly.

## 2026-08-12 (close) — phone check: Shawn verified; the one-time re-add

The installed PWA would not pick up the deploy — WebKit's known sticky
cache on standalone home-screen apps, the exact disease piece 0 cures,
but the phone had to swallow the new build once to get the cure.
Browser-on-phone confirmed the deploy reached the device (isolating it
to the installed app's cache), so: delete icon → re-add from the share
sheet. One-time cost; data untouched in Supabase. Shawn is on v1.2.1
(Chrome on iOS — same WebKit), tabs live, smart default live, first
to-do added. Pending to fully close ship 1: Claire's cross-account
check-off (exercises the household-wide todos RLS) and her own
re-add, no urgency — her old build keeps working against the
migrated database.

## 2026-08-12 (v1.2.2) — ship 1 CLOSED by the household test; urgent flag

Claire checked off Shawn's to-do from her account — the
household-wide todos RLS verified in real use, closing ship 1's last
gate. First live-use raises arrived within the hour, and the fast one
shipped same-session: **urgent flag** — checkbox on the add form,
urgent items pin above everything (even dateless ones above overdue
dated ones — that gap was the ask), red URGENT tag, and an
Urgent/Not-urgent toggle on open items for either account, because
"this became urgent" is half the value. Column added additively
(boolean default false — old clients unaffected); sort logic stays
pure and Node-tested (26/26). Version 1.2.2.

The second raise — a separate to-buy/shopping list against future
overcrowding — was deliberately NOT built: the list is hours old, and
the SPEC rule (usage, not imagination, earns a place) exists for
exactly this. Parked in IDEAS with its reasoning.

## 2026-08-12 (v1.3.0) — To-buy list: the Telegram workflow comes home

The shopping list parked hours earlier under the two-week rule got
unparked by better evidence: Shawn surfaced that the household ALREADY
runs a shopping/reminder list — over Telegram. That flips the entry
from prediction to observed behaviour predating the app; the rule is
"usage earns a place," and the usage existed, just elsewhere. Built as
a fourth tab (🛒 To-buy): same table with an additive `list`
discriminator ('todo'|'shopping'), same check-off/urgent/delete
machinery, lean form (item + urgent, no due date), check-offs read
"bought by". Pre-migration rows count as to-dos; old clients
unaffected. 27/27 tests. Version 1.3.0.

Also scoped in conversation: **reminders**. Two routes on the table —
Telegram bot (pg_cron + Edge Function posting into the household chat;
token server-side per the no-secrets rule; recommended first: it's the
channel they already use, and it opens the later bot→Nest capture
lane) vs iOS Web Push (the Ship 2 spec; heavier, per-device permission
+ VAPID + subscription storage). Awaiting Shawn's go on the Telegram
route.

## 2026-08-12 (v1.3.1) — rows uncrowd: Edit/Delete replaces the toggle

Shawn, minutes into using the urgent flag: the checkbox at add-time is
right, but the per-row Urgent/Not-urgent toggle crowds the list — "once
it's logged, edit/delete should be there." Replaced with the
expense-form pattern both users already know: open rows carry Edit and
Delete only; Edit loads the item back into its list's form (body, due
date, urgent), the button flips to Update with a cancel. Urgency,
wording, and due-date changes are now one affordance instead of three.
No schema change. 27/27 tests. Version 1.3.1.

## 2026-08-12 (v1.3.2) — three tabs, money bag

Shawn's trim after a day of tabs: the Ideas tab goes — "no point, it's
a smaller function" — the capture box returns to the bottom of Money
where it lived pre-tabs, still one 💡 header tap away (the tap now
switches to Money, focuses the box, and lets the iOS keyboard animation
do the scrolling). And the Money icon swaps 💸 → 💰 — a money bag, not
money flying away, which on reflection was the wrong omen for a
household ledger. Tab bar: Money · To-dos · To-buy. 27/27 tests.
Version 1.3.2.

## 2026-08-13 — v1.4.0: cards + miles-cap tracking (the deadline build)

The sign-off ask, built next morning, well before the Sep 1 deadline.
Shawn's lock answers reframed the feature: not "tag entries with a
card" but CAP TRACKING — the at-the-shop question is "which card
still has bonus headroom?" Shipped: in-app cards manager (name,
monthly cap, earn-rule note; seeded "PayNow / transfer" so the
required select works from launch); required card on every new entry
with the per-person smart default (defaults generalized in
category-default.js); a Cards area on Money — per card for the viewed
month (follows the dashboard's ‹ › nav): spent vs cap, progress bar,
red "cap hit" flag, and a "Most headroom" line, which IS the v1
recommend feature (cap-aware; merchant-aware earn rules stay out
until real use demands them — the note field carries the rule for
human eyes instead). Card sums deliberately include
excluded-from-totals categories: Blessing spend still earns miles.
Editing a pre-v1.4 entry shows a temporary "(unspecified)" option —
old entries stay honest (clean-start decision), new entries must
pick. CSV export gains a card column. FK on-delete-restrict; deleting
a card with history maps to "rename it instead". 31/31 tests.

## 2026-08-13 (v1.5.0) — "which card at this shop?" answered with chips

Shawn pushed back on the v1.4 deferral with two concrete cases
(Watsons; an F&B place) — and the pushback was right: what stays out
is merchant DETECTION (no data source), but the decision logic itself
is buildable. Shipped: **earn tags** per card — free-form,
comma-separated, the household's own vocabulary, deliberately not a
fixed menu (a fixed set would inevitably be wrong for specific cards;
this way the model can't disagree with reality, because the user IS
the model — the app contributes ranking and cap math). The Cards area
grows a **"Which card for…" chip row** built from the union of all
tags: tap `retail` at Watsons → answer pill names the best card and
its headroom, matching cards float up ranked by remaining cap,
cap-hit matches stay VISIBLE flagged "cap hit" (that's the warning
that saves wasted spend), non-earning cards dim. All-capped-out gets
said plainly. Chips can never go stale — they come from the cards'
own data. 34/34 tests. Version 1.5.0.

## 2026-08-13 (v1.5.1) — cards ordered by month spend; buckets split (data-only)

Two refinements from live strategy use. (1) Data-only, no deploy:
Shawn caught that pooled caps hide the moment that matters — "I won't
know when I hit $750 dining" — so Solitaire and PPV became two card
rows each (Dining/Transport at $750, Mobile-tap/Online at $600), true
per-bucket caps with no schema change. (2) This release: the Cards
area now orders by the viewed month's spend, busiest first, ties by
manager order; with a chip active, tag-ranked matches still lead. The
form's card dropdown deliberately keeps fixed order — pickers that
reshuffle break muscle memory, and the smart default already does the
speed work. 34/34 tests. Version 1.5.1.

## 2026-08-14 (v1.6.0) — mini card faces

Shawn: "just words gets boring after a while" — right, and cheap to
fix. Each card row now leads with a CSS-drawn mini card: the card's
own colour (a new `color` column, editable via a colour picker in the
card dialog), a diagonal sheen, gold chip, and network circles.
Deliberately NOT real card artwork — copyright, plus the repo is
public and the CSP is self-only by design; a colour evokes the
physical card without importing anyone's brand assets. Colours loaded
for all 12 rows (rose-gold Solitaires, OCBC/HSBC twin reds, Citi/
KrisFlyer navies, DBS pink, platinum PPVs, graphite PRVI, PayNow
purple). Base colour paints everywhere; the gradient layers on where
color-mix is supported. 34/34 tests. Version 1.6.0.

## 2026-08-14 (v1.7.0) — real card faces, kept private

Shawn asked for actual card pictures in the entry form and the card
list. The line that made it buildable: bank card art must never enter
the PUBLIC repo (that's republishing copyrighted assets) — but a
PRIVATE Supabase Storage bucket behind auth is personal use, same
boundary as the card names and caps themselves. Shipped: `cards`
bucket (private; household-read policy; uploads owner-only via
dashboard), `image` column, signed-URL loading (12h expiry, batch,
falls back silently to the v1.6 CSS minis on any failure — art must
never block the ledger), CSP img-src widened to the app's own
Supabase domain only. The form's card dropdown became a **visual
picker** — a scrollable strip of tappable card faces driving the
hidden select, so validation, smart default, and the "(unspecified)"
edit case all survive unchanged. Cards area rows show the real faces.
All 9 official card images sourced from the banks' own sites by
research agents (UOB PRVI ships only as an animated GIF cycling
networks — first frame extracted), normalized, uploaded, and wired;
both Solitaire buckets share the physical card's face, ditto the PPV
pair; PayNow keeps its purple CSS mini. 34/34 tests. Version 1.7.0.

## 2026-08-14 (v1.7.1) — picker strip → grid

Shawn, on first phone contact with the strip: "drop down is faster to
select isn't it? Sliding left and right may not be most efficient."
Half right — a dropdown is actually three interactions (open, wheel,
pick); the strip's real sin was hiding most cards off-screen. Fix:
a wrapped 4-across GRID — every card visible, one tap, no sliding —
ordered by the current user's own usage (pure `usageRank`,
Node-tested; never-used cards keep manager order at the back), with
qualifier labels on shared faces (the two Solitaire buckets both wear
the rose card; their tiles now read just "Dining" / "Transport").
The "(unspecified)" tile stays first while editing a pre-card entry.
35/35 tests. Version 1.7.1.

## 2026-08-14 (v1.8.0) — the group-bill split, and two SW bugs it flushed out

Shawn: what about group dining — what the card was charged vs what I
actually spent? A real hole: one number was doing two diverging jobs.
Shipped: **amount stays the household's true expense** (dashboards,
categories); a new optional **"Charged to card"** field records what
hit the card (blank = same as amount, so the everyday flow is
unchanged); card caps and the which-card chips now count the charged
figure — the bank neither knows nor cares who PayNow'd you back.
Same calculator rules in both fields. CSV gains the column.
Deliberately NOT built: IOU/who-owes tracking — the field records the
split's effect on caps, not the debts.

Preview testing flushed out two real service-worker bugs, both fixed
in this release: (1) the background refresh wasn't under
event.waitUntil, so a quickly-closed page could let the browser kill
the SW mid-write and the cache never advanced; (2) install's addAll
went through the HTTP cache, so a SW installing inside the CDN's
10-minute max-age window could bake STALE files into its new cache —
a torn build (fresh version.js, stale index.html — watched it happen
live). Install now uses cache:"reload" Requests; the runtime refresh
uses cache:"no-cache" revalidation. 36/36 tests. Version 1.8.0.

## 2026-08-14 (v1.8.1) — group split goes total-first

Shawn, within the hour: "why not a simple checkbox — in Log an
expense I will put the total amount first." Right about the capture
order: at the terminal the number in your head is the TOTAL, and
v1.8.0 made you compute your share first. Reworked: Amount is always
what you paid; a "Group bill — I paid for others too" checkbox
reveals "Our share" (own calculator + live preview, so 200/4 shows
= $50.00). On save the total feeds the card's cap math, the share is
the recorded expense. Unticked = the everyday one-number flow,
untouched. Editing a split entry reopens total-first. Data model
unchanged from v1.8.0 — this was purely capture ergonomics.
36/36 tests. Version 1.8.1.

## 2026-08-14 (v1.8.2) — the split reads itself from the expression

Shawn, with a live screenshot mid-dinner-log: he types 815÷5×2
anyway — the total bill, five ways, times two for the household. "Not
me having to input the total again." He's right for the third time
today: the expression already CONTAINS both truths. Now the checkbox
is the whole interaction — ticked, the FIRST NUMBER of the expression
is what the card was charged (815) and the RESULT is the recorded
expense (326). No second field at all (v1.8.1's share field lived
four hours). A live legend under the checkbox spells out exactly what
will save: "Card charged $815.00 · our expense $326.00" — and nudges
when the expression is a plain number (no split expressed). Editing a
split entry synthesizes a sum with the same contract (charged-diff),
legend making it legible. leadingNumber() joins the pure calculator
module, tested. Data model untouched. 37/37 tests. Version 1.8.2.

## 2026-08-17 (v1.9.0) — the compact form: everything on one screen

Shawn, from a live phone screenshot: the Money form ran past the fold —
the screen ended at Group bill, with Date, Note and Save below it.
Ask: compact, mobile-first — "more is on the screen." Three iterations
in one sitting, each against a rendered iPhone-width preview (headless
Chromium on mock data — the preview-before-commit loop, no deploy
burned): (1) ops beside the amount input in one row — rejected, the box
got too small for sums like 3.5+6+2; (2) his counter-design: calc keys
stacked 2×2 beside a full-height amount box — the box grew ~2.4× wider
AND taller while the keys kept their footprint; (3) Paid by moved
beside Category on the same pattern — pills stacked like the keys,
select stretched to match. His final catch: the amount and category
boxes ended at different right edges — "visually it's ugly." Fixed with
one shared `--form-aside` width for both right-side columns; the two
blocks now mirror exactly. Density pass rode along: card padding
1.5→1.1rem on phones (desktop keeps 1.5), tighter labels/inputs/gaps —
font held at 1rem, the iOS auto-zoom floor. Placeholder shrank to
"0.00": the visible keys teach the calculator now. **Deliberate
tradeoff:** pills and keys sit at 36–38px, under Apple's 44px
guideline — they're chunky, isolated targets. **Lesson:** the user's
layout instinct beat the first implementation — he wasn't asking for
"ops on the right," he was asking for a bigger box; the stacked-keys
shape gave both. Whole form now fits one screen through Save. Other
surfaces verified by render (To-dos, ledger, dialogs — they inherit
the tightened primitives). 37/37 tests. Version 1.9.0.

## 2026-08-17 (v1.9.1) — the date box learns to stay in its lane

Shawn's phone check of v1.9.0: everything landed except the Date
field — wider than every other input, value centered. iOS renders
`type=date` at intrinsic width with centered text, ignoring the shared
input styling; the desktop-engine preview couldn't show it. Fix:
`-webkit-appearance: none` plus the `::-webkit-date-and-time-value`
text-align reset — the one field the mock can't vouch for is exactly
the one the phone check exists to catch. Version 1.9.1.

## 2026-08-17 (v1.9.2) — centered date, by choice this time

Correction from Shawn on v1.9.1: the centered date value was never the
bug — he wants it centered; only the overflowing width was wrong. The
left-align reset is now an explicit center (appearance:none left-aligns
on some WebKit versions, so stating it beats trusting the default).
Lesson: a quirk report names the symptom, not the verdict on every
symptom's sibling — the misalignment was the complaint, the centering
was the design. Version 1.9.2.

## 2026-08-17 (v1.10.0) — the ledger answers back: day totals + the saved-jump

Two asks in one sitting, both from real use. **Shawn:** after logging,
the verification trip to the ledger is a long scroll — give it a
button. Shipped as a "Saved ✓ — check it in the ledger ↓" line that
appears after every save: a tap glides to the new row and flashes it;
if the active filter would hide the row, the jump resets to All first —
a jump that lands nowhere reads as a lost entry. Deliberately a button,
not an auto-scroll: auto would hijack back-to-back logging. **Claire:**
see daily spending, and the past two days. Day headers now carry the
day's counted total beside the date (excluded categories stay
uncounted, matching the dashboard's "spent"; totals follow the active
filters), and the newest header's right side glances back two calendar
days in whole dollars, zero-filled — a quiet day is a fact, not a gap.
Three design rounds against rendered previews, all Shawn: total beside
the date, not far right; the freed right edge takes the two-day FYI;
an oval on the newest date so the eye anchors there first. Pre-push
audit: insert().select("id") verified against the household-read RLS
policy; the returned id made a courtesy, not a contract — if it ever
came back empty, throwing would report "couldn't save" on an entry
that DID save, the double-log trap; the jump falls back to the ledger
top; headers wrap on tiny screens. 41/41 tests. Version 1.10.0.

## 2026-08-17 (v1.10.1) — the oval takes the total in

Refinement on sight of v1.10.0: the anchor pill should hold the date
AND the day's amount as one unit — they're one fact ("today: this
much"), so they share one shape. Version 1.10.1.

## 2026-08-20 (v1.11.0) — Note grows, Date shrinks: the third mirrored row

Shawn, closing the compact-form thread: the date "doesn't need to be
so long", the note needs room — "we type the details often... so we
can see what we type". Note and Date now share the form's third
big-left/small-right row: Date drops into the shared --form-aside
column (same width as the calc keys and the Paid-by pills — three rows,
one rhythm), and Note takes the rest as a one-line textarea that grows
with its content. Growing beats the smaller-font idea he floated:
under 16px, iOS zooms the page on focus (the standing no-zoom floor),
and smaller text still scrolls out of a one-line input — wrapping is
what actually shows you what you typed. Newlines collapse to spaces on
save (a note is one thought); the ledger renders unchanged. resizeNote
fires on input, on edit pre-fill, and on both resets, so the box never
stays stretched after its content is gone. 41/41 tests. Version 1.11.0.

## 2026-08-20 (v1.11.1) — date left, note capped at two lines

Phone check of v1.11.0, two refinements from Shawn. Date moves to the
LEFT of the row — the rarely-touched field steps aside, the note takes
the prime slot — and its type drops to 0.9rem so the value sits in the
narrow box with air instead of cramping (idle-small, 16px on focus:
the iOS zoom trigger reads the focused size, so the floor is honoured
exactly when it matters). The note's growth is capped at two lines —
household fact, recorded as asked: we don't type more than two lines
of detail; past the cap it scrolls inside rather than stretching the
form. En route the mock exposed that flex-basis and the JS-set height
fight over a textarea differently per engine — flex:none ends the
argument. Version 1.11.1.

## 2026-08-20 (v1.12, code side) — the Nest learns to speak: Telegram reminders

The parked next lane gets built — Shawn's go after a cost/architecture
walkthrough (his sharp questions: does his Telegram need to be open
anywhere? No — cloud-to-cloud, the bot is its own account; does the API
burn tokens? No — Telegram's "token" is a password, not a currency;
zero AI anywhere). First server-side piece of the app: pg_cron (01:00
UTC = 09:00 SGT) → `send-reminders` Edge Function → one digest of
due-today + overdue to-dos to the household chat, silent when nothing's
due, ‼️ for the urgent flag, "today" computed in Asia/Singapore.
Security holds the standing lines: token/chat-id/cron-secret live in
the function's secret store only — the committed cron SQL carries a
`<CRON-SECRET>` placeholder because the repo is public; the function
answers 403 to anything but the matching header; plain-text sends (no
parse_mode) for the same reason the app only uses textContent. Not live
yet: activation is Shawn's ~10-minute paste run (docs/telegram-
reminders.md, written paste-by-paste). No client change, no version
bump — the footer version stays an app-build marker.

## 2026-08-20 (v1.12, addendum) — one topic, not the whole chat

Same-day follow-up to the Telegram lane, from Shawn's question about
where the digest would actually land: does a bot in the household chat
mean a bot *reading* the household chat? No — Telegram bots run in
privacy mode by default and receive only /commands and direct replies,
never normal conversation, so a plain-member bot is deaf to the couple
talk by design. That guarantee is now written into the setup doc rather
than left as something to trust, along with the sharper option: a small
dedicated group (us two + bot) buys separation that needs no guarantee
at all. Code side, `TELEGRAM_TOPIC_ID` became an optional secret — when
present the send carries `message_thread_id` so the digest lands in one
topic of a forum-style group; absent, it posts to the group root. The
doc explains where to find the id (tap a message → Copy Link, middle
number). Optional-by-absence, so nobody who doesn't use topics has to
think about it. No client change, no version bump.

## 2026-08-28 (v1.12.1) — the blank screen only a reopen could cure

A real symptom, finally understood: on the first launch of the day the
app sometimes came up blank — no login, no ledger — and closing and
reopening was the only fix. The cause sat in the boot path. Both views
start hidden and the auth handler is the ONLY thing that unhides one,
but supabase-js won't emit `INITIAL_SESSION` until it has refreshed an
expired token — a network round-trip. On a cold open, radio still
waking, that refresh can hang, and a hung refresh means no event, which
means no view, forever. The app wasn't broken; it was waiting, silently,
with nothing on screen to say so.

Fix is a 4-second watchdog: if neither view is visible by then, surface
the login view with a visible line — "Still connecting — this screen
will sort itself out in a moment." When auth does answer, the handler
wins: it clears the message and shows the correct view, so a slow
network costs a beat of honest text instead of a dead screen. The rule
underneath it is the same one the save path already follows: fail
visibly. A blank screen is the worst failure mode available — it is
indistinguishable from a broken app, and it teaches the user that the
thing is unreliable even when it isn't.

Reproduced before it was fixed, against a stand-in endpoint made to
hang, and verified in preview. Still wants one real cold-open
confirmation on the phone. Version 1.12.1.

## 2026-09-18 (v1.13.0) — the ledger gets shorter, the bars get a memory

Two long-standing raises shipped in one sitting, both cleared by a
session where Shawn was explicit about having no time to think: "strapped
for time... currently it's working and the tracking becomes a habit
already." A habit is the strongest signal this app has ever had — it
means the daily job is done and the remaining asks are about living with
the data, not capturing it.

**Ledger cap** (Claire, raised twice since July — the whole list is
"unnecessary and unsightly"; shape from Shawn: last 20–30 with an
expand). `capGroups` cuts at 25 entries but on WHOLE days only: a
part-day would print a day total that doesn't match the rows beneath it,
and a total that lies is worse than a long list. The newest day always
survives however big it is, so today is never what gets hidden. The
expand control appears only when something is genuinely hidden — a "show
all" over a list that already shows all is a lie about length. One trap
closed on the way: editing an old entry keeps its old date, so its row
can sit below the fold; the saved-jump now expands before giving up,
because a jump that lands nowhere reads as a lost entry.

**Per-category month-on-month** (Shawn, 2026-07-29, during the 2b
review). `summarize` now returns the previous month's per-category
totals from the same pass — the data model always supported this (every
entry keeps category_id + date forever), only the delta was missing.
Each bar carries its move: ▲ in the alert colour for a rise, ▼ in green
for a fall, "same as Aug" when flat, and nothing at all where last month
has no such category — a delta against nothing is not a 100% rise, it's
a category that didn't exist yet.

Pre-push catch: `.cat-row span:last-child` also matched the new delta
span nested inside the value wrapper and overrode its colour — the
classic descendant-selector collision. Scoped to a direct child, with
the wrapper carrying the colour so the amount still inherits it. Caught
by reading the existing CSS before writing the new rule, not by seeing
it break. 43/43 tests. Version 1.13.0.

## 2026-09-18 (v1.14 groundwork) — the registry that predicts, the ledger that records

Recurring commitments get their foundation, prompted by Shawn naming the
gap precisely: some things "I don't even input because I don't 'spend'"
— Spotify, ChatGPT, Claude, insurance. The diagnosis that shaped the
build: it isn't that recurring items are tedious to type, it's that
**there is no spend moment, so there is no trigger**. Subscriptions are
designed to be unconscious. No amount of habit fixes that; only a due
date can.

Settled first, in conversation, and worth keeping because it decides
everything else: **the ledger mirrors money movement.** One row per
actual charge, on the actual date, with the actual payment mode. Shawn's
own reconciliation instinct produced the rule — splitting an annual
premium into twelve phantom entries would break any attempt to check the
ledger against a statement. So amortisation (a yearly premium shown as a
monthly figure) is a REGISTRY view and never reaches the ledger. The
registry predicts; the ledger records; the only bridge is a person
tapping Confirm. Nothing auto-commits — the day you cancel Spotify is
the day auto-commit starts lying, and it's the day nobody is looking.

The third case settled itself on existing machinery: a $2,000/month
investment-linked premium must be in the ledger (it left the account,
reconciliation needs it) but must not count as spending (it would swamp
the household number every month and teach both of them to distrust the
total). That is exactly what `excluded_from_totals` already does for
Blessing — no new mechanism, and the card-cap math already counts
excluded spend because the bank does.

Shipped in this commit: the migration (recurring table, nullable
`expenses.recurring_id` with on-delete-restrict so a row with history is
deactivated rather than deleted, two RPCs) and the pure maths with
tests. `confirm_recurring` is atomic and pins the confirm to the due
date the caller SAW — the due strip is household-shared, so without that
guard both phones tapping at once write the charge twice. It dates the
expense on the DUE date, never today: confirming a week late must not
misdate the charge. `skip_recurring` is deliberately separate from
deactivating, because a cancellation mistaken for a skip returns as a
phantom next month while the reverse costs nothing.

`anchor_day` is stored apart from `next_due` for one reason: an item
anchored on the 31st must land on the 28th in February and RETURN to the
31st in March. Stepping from the previous due date instead would pin it
to the 28th permanently — tested both directions, leap years included.
51/51 tests. Screens still to build.

## 2026-09-19 (v1.15.0) — Coming up: a snapshot, deliberately not a calendar

Phase 3 of the founding vision ("shared calendar, things we want to
do") finally built, and the design was decided by Shawn doubting his
own request: "I'm not sure if I'm overbuilding this or over-engineering
it, because calendars already exist."

He wasn't — but only because of the word he reached for. He said "one
snapshot", not "a calendar", and the two are different objects. A
calendar holds your dentist appointment; Google already does that
better, on both phones, and building it again would be pointless. A
snapshot of what's coming *for the household* — a charge landing, a
chore due, an evening booked — is something Google structurally cannot
assemble, because it knows nothing about the money or the lists. The
test is written into the module so it survives the session: **would a
dentist appointment belong here? If yes, it belongs in Google.**

That decision paid for itself immediately in what got left out. A
forward-looking list, not a month grid. No recurrence rules, no
invites, no reminders, no Google sync — each is a step toward being a
worse copy of the calendar already on the phone, and the migration
comment says so, because the pressure to add them will come later from
someone who has forgotten why. Overdue items are excluded too: they
already have two homes (the To-dos tab, the due strip), and repeating
them here would quietly turn "what's coming" into "what's late", a
different question with two existing answers. What it does carry that
nothing else can: the figure the dashboard cannot know — what is still
to land before the month ends.

The risk, named to Shawn before building rather than discovered after:
if most of their joint events live in Google, the view will feel thin,
because adding them here is manual. Not solved with a sync build — too
big, too fragile. The precedent says wait: the shopping list migrated
out of Telegram once the app was a better home, and two weeks of use
will say whether events do the same.

**Someday** shipped alongside it as a third value on the todos `list`
discriminator. A wish is not a task — no date, never overdue, and
checking it off means "we did it" rather than "handled" — but it is
structurally the same row, so it rides the existing machinery rather
than earning a table. It earned a *section* inside To-dos, not a tab:
six bottom tabs is past what a phone carries, and a wishlist is a
monthly interaction, not a daily one. Five tabs verified legible at
375px before committing to the arrangement.

Migration run by Claude through the Supabase dashboard and verified in
the database (events: 8 columns, 4 policies; `todos_list_check` now
admits 'wish'). 58/58 tests. Version 1.15.0.

## 2026-09-19 (v1.15.1) — the number that mixed two months

Shawn, hours after v1.15.0 shipped, asking the right question about the
summary line: "is it showing $500 of recurring charges coming up in the
next 30 days?" It was — and that was the bug, though nothing was
broken. The horizon window is a ROLLING thirty days, so on 19 September
the figure quietly included a 2 October charge, while the words "still
to land" implied "before this month ends". Anyone would have added that
number to the dashboard's "spent this month". The result would have
meant nothing, and nothing would have flagged it.

The fix is a split, not a relabel. The headline is now the rest of the
current month — the figure that actually composes with the dashboard —
and whatever else sits in the window is shown beside it as its own
fact, never summed into the first.

His second question ("if I click that, will it show me what those
are?") had the answer "no, scroll down and mentally filter out the
chores and events", which is not an answer. The line is now a button:
it opens to every charge with its date and amount, the ones past the
month boundary greyed, so the headline is checkable against its own
rows rather than taken on trust.

Worth recording as a pattern, not just a fix: both catches came from
him reading a single line of summary text closely and asking what it
actually counted. A derived figure earns its place only if the reader
can get back to the rows behind it — that is the same rule the ledger
already follows, arriving late to the dashboard. 60/60 tests. No
migration. Version 1.15.1.

## 2026-09-20 (v1.16.0) — the card tells you it's full

Shawn, with a screenshot of the card picker: could the card be
clickable, so checking whether he'd maxed one out didn't mean two or
three scrolls down to the Cards area — "or an additional can be in the
picture to be red hue once max has been hit?"

Two ideas, and the second is the better one, because a jump still costs
a trip. The question "have I maxed this out?" is asked *while choosing
a card* — that is the only moment it matters — so the answer has to be
on the card. The real cost of three scrolls was never the scrolling; it
was that the question went unasked, and the spend landed on a card that
had stopped earning.

Each capped tile now carries a thin fill bar: green while there's room,
pink past 80% so the bar warns before the tile does, and at the ceiling
the whole tile turns — red border, greyed-out art, red name, FULL. The
desaturation is what does the work: a spent card reads as spent before
any word is processed. Uncapped cards get no bar, because a permanently
empty gauge would say "nothing spent here" rather than "no ceiling".

Exact headroom went into aria-label instead of onto the tile — four
columns at phone width leave no room for a figure, and that label is
the only form a screen reader would otherwise get. His clickable idea
survives as a small "caps ↓" link by the Card label, for when the
detail genuinely is what's wanted.

Computed against the current month always, even while editing an entry
from an older one: the cap question is about now, not about the month
the entry belongs to. Version 1.16.0.

## 2026-09-20 (v1.16.1) — one affordance, not two

Shawn on the v1.16.0 screenshot: "Why another link for the caps? Why
not just click card and it brings me there too? But make 'card' more
obvious that it's clickable."

Right on both counts. The separate "caps ↓" link was a second control
for a job the label was already sitting beside — and of the two, the
label is the one the eye lands on. The label is now the button.

What makes it non-trivial: it has to keep reading as a field label
while being visibly tappable, inside a form where every other label is
plain grey text. It keeps the label's exact metrics and spends the
difference on colour and a stated destination — "Card" in green with a
"see caps ↓" pill — so it is the only label in the form that looks like
it leads somewhere. Making it obvious was the harder half of his
request, not the merging.

Consequence worth noting: the <label> element went with it, so the
select carries its own aria-label now and keeps an accessible name in
both states (picker showing, or the raw select when no cards exist).
Version 1.16.1.

## 2026-09-20 (v1.16.2) — subtracting the word

Shawn, on sight of v1.16.1: "let's remove the FULL, the current red
border and grey out card is sufficient. Too many words gets messy
visually."

Four signals were carrying one state — red border, desaturated art, red
name, and the word. The word was the weakest of them and the only one
that cost a line of vertical space, so it went. A second benefit fell
out that wasn't asked for: every tile is the same height again, which
tightens the grid and pulls Save up the screen.

The pattern across v1.16.0 → .1 → .2 is worth naming, because all three
came from Shawn looking at a rendered screen rather than a description:
first put the state where the question is asked, then merge two
affordances into one, then subtract the redundant signal. Each step
removed something the previous one had added. The state still reaches a
screen reader through the aria-label — words belong there once the
visual carries the meaning. Version 1.16.2.

## 2026-09-20 (v1.17.0) — the rule that expires

Shawn, having just re-picked his UOB Lady's Solitaire bonus categories
for Q4 (dining and family), asked three things at once: should the app
preload those categories, should he simply keep them updated in the
app, and should it store the earn details of every miles card.

The first answer was already written down. v1.5's comment in
cards-math.js says tags are the household's own vocabulary
"deliberately not a fixed menu, so the model can't be wrong about how
a specific card earns; the app only contributes ranking and cap math."
That holds, and it is worth restating why: bank terms change without
announcement, carry MCC exclusions and minimum spends, and a wrong
rule costs real miles quietly for a whole quarter. A wrong rule
entered by the bank's own customer is a mistake; a wrong rule asserted
by the app is a betrayal of the one thing the Cards area is trusted
for. So the app still refuses to know.

But the question exposed a real defect, and it is not storage — it is
**staleness**. A card whose categories are re-picked each quarter will
go on being recommended under last quarter's rules with no error and
no flag. The failure has no symptom, which is what makes it expensive.

So: an optional "rules good until" date. Past it, the Cards area says
the rule needs a check, and the card sinks below every card with a
confirmed rule in both the generic recommendation and the per-tag
chips. Flagged, never hidden — a stale rule is usually still roughly
right, and hiding the card would replace a loud silence with a quiet
one. The test that matters guards exactly the inversion: an expired
card with MORE headroom must lose to a confirmed one.

The flag deliberately does not appear on the picker tile. That tile
answers "am I maxed out", and a second unrelated warning there is
precisely the clutter subtracted in v1.16.2 the same day.

Note widened 120 → 500 characters: "4mpd online only" fits in 120,
"10 mpd on dining + family, min $800/month, excludes utilities" does
not.

Refused, and recorded so it isn't revisited: a per-period earn-rules
table with valid_from / valid_to and per-category rates. That models
the *history* of rules, and the history has exactly one reader — no
one is ever going to ask which card was best last July. The rule in
force is the only one with a consumer, and what it needed was an
expiry, not a timeline. Version 1.17.0.

## 2026-10-31 (v1.18.0) — retiring a card without losing its history

The Lady's Solitaire converted to the standard Lady's, which has one
bonus category instead of two. The Dining bucket was renamed in place,
so its entries stayed attached. The second bucket couldn't be deleted
because past entries point at it, and the foreign key is
on-delete-restrict on purpose: history keeps its card. The data-only
fix was to strip its cap and tags. That took it out of every
recommendation, but its face stayed in the logging picker, one wrong
tap away from a new entry. Shawn saw it there in the live app and
asked for it gone.

So cards now have a **retired** flag, a checkbox in the card editor.
A retired card is left out of the logging picker, the recurring form's
card list, the tag chips, "Most headroom" and the per-tag ranking. It
stays attached to its old entries and its spend still counts in past
months. Editing one of those entries brings it back as a temporary
option, the same mechanism a pre-card entry already used. Without
that, the select would quietly fall back to another card and a save
would move the entry. It also stays in the Cards area, last and
dimmed, labelled "retired — not in the picker", because that list is
also the card manager and a card that can't be reached can't be
un-retired.

The delete error now says "Tick Retired instead" rather than "Rename
it instead". Renaming was the old workaround, and it is what left a
"· retired" tile in the picker in the first place.

Not built: hiding retired cards from the Cards area altogether, or a
separate archive view. One retired card doesn't justify a second
screen. Migration run against production and verified. 67/67 tests
(3 new, including the case that matters: a retired card with more
headroom never wins). Version 1.18.0.

## 2026-11-07 (v1.19.0) — the registry outgrew the daily screens

Recurring went from 7 active items to 26 in one sitting through the SQL
editor, and two screens that had been fine quietly stopped being fine.
The due strip sat above the log form on both phones at about 169px a
row, so a normal week's backlog would have undone the one-screen form
from v1.9. Coming up listed every charge in its window and read as a
bills list, burying the events and to-dos it exists for. Nothing was
broken, which is why it needed saying: the registry worked exactly as
built, and that was the problem.

**Due now folds to one line**, about 70px, hidden when nothing is owed.
Opened, each item is a compact row with its amount and how late it is,
and Edit and Skip behind the same amount editor and skip fork as before.
**Confirm all** only exists in the opened view, so the amounts have been
seen first, and it is not a new write path: it runs the same doConfirm
per item, so every item keeps its duplicate check and its pin to the due
date the phone saw. A possible duplicate is the one thing that
interrupts it. Answer no and the run stops with the rest still listed.
If the other phone got there first, nothing was logged twice, so that
reads as news and the run carries on. It hides while a row is mid-edit,
because otherwise it would confirm the old amount over the one being
typed.

**Coming up's day list drops monthly charges.** They stay inside the
summary line, which still opens to every charge, because the v1.15.1
rule holds: the headline has to be checkable against its own rows.
Anything rarer than monthly keeps its date, since those are the charges
worth a heads-up. The empty message now looks at everything rather than
the list, so it can't claim nothing is coming while charges sit in the
line above.

**Money gets three boxes under the total**: Everyday, Commitments and
One-offs. The total keeps its meaning and the boxes add up to it, a test
holds that. The comparison changed underneath them. It used to set a
month's total against the average of earlier totals, and months before
the bills were being confirmed hold almost no commitments, so every
month from here on would have looked like a jump. Everyday now compares
with the Everyday of up to three earlier full months, listed and still
tappable (Claire reached for that before it existed). A part-month at
the start of history doesn't count as one of them.

**The rule under all of it, from Shawn: spending is the share.** "Make
sure that the total amount spent on card is not the reference for
spending. There are dinners that we pay in advance but our actual
spending attributed to us is separate." So every sum reads the entry's
amount, and only cards-math.js reads the card charge, because a bank's
cap counts the whole bill. A group dinner counts at our part, in
Everyday, and is not a one-off just because the card took a big number.
A test holds both sides of that, and another fails if any other pure
module starts reading the charge.

Classification lives in one pure function and its order is the point:
giving, then set aside, then anything linked to a commitment, then
one-offs, then everyday. A confirmed tithe has a recurring link and must
stay giving. It reads a new `categories.kind` and never a category's
name or a note's text, because either of them can rename a category at
any time. Tithes, Tax and Subscriptions became categories, and past
entries were linked to their commitments so they stop counting as
Everyday. The cadences half-yearly and one-time arrived too, in the
database and in `CADENCE_MONTHS`, with a test that reads the migration
and compares them. A cadence with no step would break confirm_recurring,
so a new check also insists a running one-time row ends on its own due
date. Without that it would quietly come back a year later.

Before anything moved: a CSV export and a snapshot of expenses,
categories and recurring in a private schema the API can't reach, the
SPEC's undo rule. Real figures stayed out of this repo at every step,
including the tests, which meant not copying the example from the build
brief because it was a real ledger entry. The preview ran the real code
on an in-memory stand-in for Supabase kept outside the repo, so the
brief's numbers could be checked to the cent, and every flow tapped,
before production changed.

Worth recording: **Claire was using the app during the build.** Between
the snapshot and the data steps she added her own recurring item,
confirmed two months of it, logged the month before by hand, logged a
meal and recategorised an entry. None of it collided, because every step
named its rows by id, but the counts came back different from the brief
and it was worth stopping to find out why rather than assuming. Diffing
live tables against the snapshot by id explained every difference. An
expected-numbers table describes the data on the day it was written, and
this data has two people in it.

Also: production writes in this session were refused by an automated
guard until Shawn gave his own go-ahead in the conversation, even though
the brief already authorised them. A session started from another
session should bring that question to the first preview rather than
discover it halfway.

Not built: a way to set a category's kind in the manager. New categories
default to everyday, and there are four non-everyday ones in the whole
ledger. 88/88 tests. Migration run against production and verified.
Version 1.19.0. Snapshot, sample data:
`docs/snapshots/2026-11-07-v1.19.0-due-now-fold-sample-data.png`.

## 2026-11-07 (v1.20.0) — Overview: the picture, without the report

It began as a one-time spending audit, done outside the app and saved
privately. Shawn then asked for that picture to live inside The Nest,
not in the report's shape. So the goal became three questions the app
can answer from data it already holds: what does a normal month take,
what's inside each part, and when do the big charges land. He reviewed
two rounds of phone mockups before any of it was built.

**Overview replaces the Recurring tab.** There is no sixth tab, because
six is past what a phone carries (v1.15 found that). The list and the add
form are still there, tucked at the bottom, and "Make this recurring"
still lands on the open form.

**A typical month is one figure rounded to the nearest hundred, reading
"About".** Two of its four layers are promises (the registry) and two are
habits (the ledger), so a figure to the cent would claim a precision it
doesn't have. Under it sit one stacked bar and four rows that open:
Bills & insurance down to each item, Everyday by category, and Set aside
and Giving, both labelled "Not spending" because they are the household
choosing to do something with money rather than spending it. The bar's
blue and gold are there because four green-and-pink sets failed a
colour-blind check. They appear on this bar and nowhere else.

**No names, anywhere on the tab.** Shawn: "between claire and myself, we
dont track and scrutinize who spends what. so we can leave out the
separate pills." Opened Giving shows one line per category, never one per
person, and a test fails if this screen starts reading `paid_by`. That
column stays only because Confirm needs it for the ledger. One seam,
left on purpose at his call: two rows are named after people, and the
tucked Running list shows row names.

**Year ahead** is twelve months of what's already promised, with
everyday spending left out, and one sentence naming the heaviest month.
Tapping a month lists what's in it. A monthly item counts in full for
the current month even once it has been charged, and so does a rarer
item confirmed this month, or this month's bar would shrink with every
confirm and stop meaning anything. The bars are set in pixels rather
than the mockup's percentages, because a percent height inside nested
flex boxes is exactly what can differ between a desktop preview and the
phone.

**Big one-offs get a list and a total, never a monthly average.** Shawn:
"there are some one off items. we rarely travel that much, just that in
the past few months we've paid for travel items." Averaging them would
turn a few trips into a standing cost that isn't there. They have their
own query, because the ledger cache holds only the newest 1000 rows and
would stop covering a 12-month look-back within the first year.

A one-time charge (the last payment of a short plan) lands once, on its
date, in Year ahead. It stays out of a typical month for the same
reason.

Left out on purpose: budgets and income, as ever ("visibility, not
budgets"). A hint the mockup carried, that one recurring charge may
change around its renewal, because no data sits behind it and hard-coding
it would print a personal fact in a public repo. Setting a category's kind
in the manager.

Checked the same way as v1.19: the real code run on a mirror of the
ledger kept outside the repo, against the private table of expected
numbers, which reconciled to the cent. 106/106 tests. Version 1.20.0.
Snapshot, sample data:
`docs/snapshots/2026-11-07-v1.20.0-overview-sample-data.png`.

## 2026-11-07 (v1.20.1) — eighteen categories down to ten

Hours after Overview shipped, Shawn looked at the category list and said
it plainly: "There are just too many, and we're going too granular. It
defeats the purpose." A list that long costs a decision on every entry,
and the one question it was meant to answer gets harder to read.

Now ten: Groceries, Eating out, Transport, Home, Health & Wellness,
Shopping, Essentials, Travel, Investments and Gifts/Blessings. Three
small ones with a handful of entries between them went into Shopping.
Insurance, Tax, Subscriptions and Tithes went into Essentials. Gifts and
Blessing became one. Two health entries filed under Insurance moved to
Health & Wellness on the way.

Two of those were real decisions, and both reverse something. **Tithes
now count as spending,** in Essentials. That undoes a choice made earlier
the same day, when Tithes got a category of its own to stay out of the
total. **Gifts/Blessings count too,** which replaces the convention
written down on 2026-08-02 that a present counts and money given doesn't.
A category is either counted or it isn't, so merging them forced one rule
for both. Claude recommended the other way on each and laid out what it
would cost; Shawn weighed it and chose. The taxonomy has always been
retroactive by design, so past months' totals rose and two large gifts
now sit in Big one-offs. The typical month barely moved: the same money
on fewer shelves.

So nothing is left in the Giving layer, and Overview's rows now hide
themselves when empty rather than showing a zero. The first row is now
"Bills, insurance & commitments", because that is what it holds. The two
tithe rows keep their people's names, Shawn's call: "i need to know the
difference. just because entry is by diff people and also to track." That
is a deliberate exception to the no-names rule, and they now show when
Essentials opens. The kind `give` stays in the schema with
nothing using it, which costs nothing.

A near miss worth recording. The fresh CSV backup silently failed, because
Chrome blocks a second automatic download from the same page, and the
merge had already been sent before the file was checked. The only reason
it didn't run ahead of its backup was the SQL editor's own warning on
destructive queries, which paused it. It was cancelled, the CSV was taken
through the app's Export button and verified, and the merge ran after
that. The rule to keep: confirm the backup exists before sending the step
that needs it, never alongside.

Run through the SQL editor with a fresh CSV and snapshot first, and
verified against numbers predicted beforehand. A planned tidy-up came
free with it: the second household tax item sits in Essentials now, and
its past entry is linked. 106/106 tests. Version 1.20.1.

Same evening, with both phones confirmed on v1.20.1, the last three
registry rows moved to the new cadences: one half-yearly charge replaced
two yearly rows, and the final payment of a short plan became a one-time
item, so Year ahead now names the right heaviest month. The Overview
build is complete: every figure in the private table of expected numbers
reconciles, with the only differences traced to the household's own later
changes (Claire's new item, a refund, the category decisions above).

## 2026-11-07 (v1.20.2) — insurance sits with investments

Shawn, looking at the shorter list: "Should insurance combine with
investments? in a way its investment." Claude's advice was to move only
the policies that pay something back, because Investments isn't counted
as spending and pure cover is a cost. Shawn heard that and chose otherwise:
every premium goes in one category, renamed Investment & Insurance. The
cost is stated here so it isn't lost: premiums no longer reach the Money total or a typical
month's spending. They still count in Year ahead, and they still show
under Money as "not counted", so nothing disappears from view.

Essentials became Bills & Commitments, which says what it now holds. That
left Overview's first row promising insurance it no longer contained, and
reading almost the same as the category inside it, so the row became
Regular commitments. The layer that was Set aside became Investment &
insurance, "not counted as spending". Its old hint said "Still yours",
which was true of an investment and isn't of a motor premium, so the
words changed with the data.

He also asked for the home loan to sit under Home and the car loan under
Transport. Both already did, so nothing moved.

The CSV was confirmed on disk before the snapshot and the move were sent,
the rule the v1.20.1 near miss left behind. Numbers predicted and matched.
No migration. 106/106 tests. Version 1.20.2.

Later the same evening, with no app release: both loans moved from Home
and Transport into Bills & Commitments, Shawn's call ("cleaner that way").
No past entries were linked to them, so only the two registry rows changed.

## 2026-11-07 (v1.20.3) — what we spent, and what went out

Once insurance joined investments outside the Money total, Shawn asked the
question that had been sitting under it: "I still want to track what my
outflow is regardless." Overview and Year ahead already counted everything.
Only Money's headline didn't. Offered the choice of counting everything or
showing two numbers, he chose two: the headline stays spending, and a line
under it gives total outflow and how much of that isn't counted. The line
hides when the two agree, because the same number twice says nothing. It
reads each entry's amount like every other sum here, so a group bill still
counts at our share. 108/108 tests. No migration. Version 1.20.3.

## 2026-11-07 (v1.21.0) — the registry gets an editor

Shawn, reading Overview: could tapping an item take him to the recurring
entry, "so I can edit as necessary: the amount, how it is being categorized,
the naming convention, or the date." Until now the registry had no editor
at all. An amount could change only at Confirm, and everything else only
through the SQL editor.

Tapping an item under Regular commitments or Investment & insurance opens
its name, amount, category and next due date, and the Running list gets an
Edit button that also reaches one-time items. Everyday's categories aren't
tappable because they are averages, and Big one-offs are ledger entries that
already edit from the Ledger.

The founding rule holds: the registry predicts and the ledger records, so
an edit changes what comes next and never rewrites a logged entry. Only
changed fields go back. Resending an untouched due date could undo a
confirm made on the other phone while the editor was open, and would pin a
31st item to a short month's 28th, so a test holds both. A one-time item's
end date follows its due date, because the database requires it. 112/112
tests. No migration. Version 1.21.0.

