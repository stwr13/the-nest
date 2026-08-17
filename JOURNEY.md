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
