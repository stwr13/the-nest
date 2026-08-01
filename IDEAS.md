# IDEAS.md — candidates for after v1.0

Not commitments. Two weeks of real use decides what earns a place
(SPEC.md rule). This file is the curated backlog; the raw inbox is the
in-app idea box (`ideas` table). Harvested 2026-07-26: 11 captures,
2026-07-17 → 07-26, both authors — Claude now drives the SQL editor
through Chrome directly (Claude in Chrome extension), so future
harvests need no copy-paste. Second harvest 2026-08-01: 3 new
captures, all Claire — she is now the module's most demanding user;
Shawn has logged nothing in-app since 07-26 (he raises things in
session instead).

**Open decisions as of 2026-08-01** (cleared when decided):
Shawn's — (1) lock v1.2 "second module" scope: both ships / Ship 1
only / keep ideating (incl. the roadmap reorder putting to-dos ahead
of zero-touch); (2) confirm the Gifts/Blessing boundary as practiced
(money given = Blessing, purchased presents = Gifts) for SPEC;
(3) declare v1.1 closed (recategorization went user-driven) → tag
v1.1. Household's — (4) Claire's two stragglers: tithe S$470 + JP
Books S$30 still in Other (July total reads high until moved);
(5) alert-channel fieldwork (SMS / email / app-popup, per bank) —
gates zero-touch scoping; (6) category list: declare settled → then
the one-off reorder on request.
From the 2026-08-01 harvest (all Claire): (7) does the **month-review
gap** — fresh, dated, unprompted friction from the trailing user —
outrank the to-do module for v1.2? (8) which build does her 07-30
ledger capture describe: is she on v1.1 yet? (9) alphabetical vs
frequency order for the one-off category reorder.

Ordered by evidence strength: live-use raises beat pre-launch
speculation.

- **Month-review gap — past months have no breakdown** (raised
  2026-08-01 by Claire, unprompted, on the first day of the new
  month: "i clicked the month 'July' in the dashboard but am unable
  to see the breakdown of July's expenses"). What happened: the
  dashboard rolled over to August, so July's category bars vanished —
  past months survive only as single totals in the comparison row.
  **The one moment you most want a month's breakdown is the moment
  the app stops showing it**; CSV is the only remaining route. She
  also tapped a month name expecting drill-down — a discovered
  affordance, not one we designed (and the same interaction shape
  guessed at for category filtering). Shapes: (a) tap a month in the
  comparison row → that month's breakdown, (b) month picker on the
  dashboard, (c) simple "previous month" toggle. Pairs naturally with
  per-category month-on-month below — same screen, same data.
  Strongest fresh evidence in this file: real friction, real moment,
  from the trailing user, dated to the day it hurt.

- **Categories: more of them, editable, in-app** (deferred pre-launch
  2026-07-16; re-raised in live use ×3). Claire (07-19): needs Gifts,
  Wellness, Learning — "Fun or Others is too broad". Shawn (07-19):
  instead of presets, create/edit/delete categories in-app — and his
  own caution: don't over-engineer with too many; open question raised:
  what happens to past data when a category is renamed/deleted? The
  v1.0 stopgap (Supabase Table Editor) is not being reached for — the
  case the entry said would build itself has built. Related polish:
  **category icons** (Shawn 07-18) — visual differentiation doubles as
  ledger scannability.
- **Ledger filtering / de-clutter** (raised pre-launch 2026-07-16,
  incl. long-ledger scroll fold-in; re-raised in live use by both
  users independently). Shawn (07-17): filter by person — "the entire
  ledger is a clutter. I can't easily see if I logged something I just
  bought". Claire (07-19): "view by individual dates or weekly —
  viewing in a list just looks too cluttered". Live use favours two
  shapes from the pre-launch list: per-person filter and day/week
  grouping (a variant of collapsible month groups) — both shipped
  2026-07-29 (v1.1 piece 3). Category filter re-raised same day
  (Shawn, minutes after the person filter shipped: "a drop down of
  sorts?") — deferred at the v1.1 finish line: no concrete blocked
  moment named yet, and two shapes compete (ledger dropdown vs tapping
  a dashboard category row to see its entries; the latter pairs with
  the per-category month-on-month idea below). The itch names its
  moment, then the shape picks itself. **Re-raised 2026-07-30 by
  Claire**: "Add a function to collapse and expand the Ledger
  section, and also to View By Date. The long list now is unnecessary
  and unsightly." **Resolve before acting:** this landed the day
  *after* day-grouping + filters shipped, and "View By Date" is
  precisely what day-grouping delivers — so either she had not yet
  received the update (iOS PWA caching; needs a close/reopen,
  sometimes twice), or grouping alone isn't enough and she wants
  *collapsible* day sections. **Process gap exposed:** the app shows
  no version anywhere, so a capture can't be tied to a build — we
  can't tell whether feedback describes shipped or unshipped
  behaviour. Cheap candidate fix: a small version marker in the
  header or on the idea card. Root need
  confirmed within the first week of real data.
- **Entry-first layout** (new in live use; both users independently,
  same day). Claire (07-19): "my main purpose upon opening the app is
  to log my expense... I would prefer this function right at the top"
  — the dashboard headline is "too big". Shawn (07-19): "logging of
  expense at the top, then the overview as the section below".
  Reverses the v1.0 Z-pattern decision (headline number top-left) —
  usage overrules it: the app is an input tool first, a report second.
  Cheapest item on this list.
- **"Blessing" category excluded from totals** (new, Shawn 07-19).
  Giving/tithing should be logged but not counted in household
  spending totals — "this shouldn't be calculated together with our
  expenses". Data-model wrinkle: an excluded-from-totals flag on a
  category plus dashboard math that honours it. Root need: the
  monthly total should mean "what we spent on ourselves".
- **Per-person emoji on "paid by"** (new, Shawn 07-21). Small
  personalisation; pairs with category icons under one "make the
  ledger scannable" umbrella.
- **Consolidated multi-item entry / calculator** (new, Shawn 07-23;
  expanded 2026-07-28 in scoping). Food-court case: drink + meal +
  snack as one log instead of three. Bill-split case: dinner with
  friends, 405 ÷ 4 — today that means app-switching to Calculator and
  remembering the result. Smallest shape: the amount field accepts
  arithmetic with + − × ÷ ("3.5+6+2", "405/4") and shows the computed
  amount live before saving. Bigger shape: true itemised entry or a
  separate calculator screen — both add taps/modes; likely
  over-engineering. Direction agreed 2026-07-29: inline shape, in the
  v1.1 working scope.
- **Per-category month-on-month comparison** (raised 2026-07-29 by
  Shawn during the 2b design review: "we might compare or analyse
  which category we spent more in comparison"). Today's dashboard
  compares months as absolute totals only; category bars exist for the
  current month alone. The data model already supports the full
  version (every entry keeps category_id + date forever), and the
  retroactive-taxonomy semantics recorded in SPEC.md mean past months
  re-bucket cleanly under today's categories. Shapes when it earns a
  place: per-category "vs last month" deltas on the existing bars, or
  a tap-a-category month history. Waits for live-use demand (idea box).
- **Category reordering** (noted 2026-07-29 while shipping the
  manager; decided same day by Shawn). New categories append after
  Other; no in-app reorder. **Not becoming a feature**: reordering is
  a rare, settle-once need — after the category set stabilises
  (~1-2 weeks of use), Shawn requests a one-off reorder (single SQL)
  instead. Same rule that kept the category manager out of v1.0: no
  UI for a twice-a-year task. **Re-raised in live use 2026-07-30 by
  Claire** ("Rearrange the categories in alphabetical order") — now
  raised independently by both users, the strongest evidence class at
  n=2. It does *not* overturn the decision: her ask is satisfied
  exactly by the one-off reorder already promised. Open design
  question for the household: alphabetical (predictable, what she
  asked for) vs frequency-of-use (fastest for the daily dropdown —
  Eating out and Groceries dominate the ledger). Today's order is
  neither, which is probably why it grates.
- **Inline ledger editing / return-to-place after edit** (raised and
  deferred by Shawn same breath, 2026-07-29). Editing jumps to the
  form (it IS the editor — one form, one validation path) and leaves
  you at the top afterwards. Inline editing: big surface for a rare
  action — not built. Return-to-place after save: cheap (the glideTo
  helper exists) but also deferred — the current edit spike is
  cleanup, which the one-time recategorization makes obsolete. Either
  earns a place only if the itch recurs in normal post-cleanup use.
- **Back-to-top affordance** — rejected 2026-07-29: iOS's status-bar
  tap already scrolls to top in the installed PWA (Shawn uses it
  naturally). No build for what the platform gives free; revisit only
  if it appears in the idea box (especially from Claire).
- **Recurring payments / commitments registry** (new, Shawn 07-26,
  self-flagged "may not be the immediate next fix"). Track recurring
  outflows with end dates, plus payout-bearing commitments
  (insurance / investment-linked: "$X at age/date Y"). Was explicitly
  out of scope for v1.0 (recurring expenses); big surface area —
  parks unless it survives another usage cycle.
- **Multi-currency entry** (raised pre-launch 2026-07-16, travel use
  case; **not re-raised in live use** — though no trips fell inside
  the trial window, so the silence is weak evidence either way).
  Stopgap stands: log the SGD charge, foreign amount in the note.
- **Shared to-do list — the second Nest module** (raised 2026-07-30
  by Shawn: "things we can dump there and track together"). First
  module beyond money; the Shared Brain vision always implied this
  class, so it's on-mission — the open question is *sequencing*
  against zero-touch capture. Structurally a sibling of the idea box:
  dump one-liners fast, household-shared. Smallest shape: a To-dos
  card on the current page (add, check off, clear). Bigger shapes:
  its own page/tab (the app's first navigation change — the single
  page is getting long), assignees, due dates, recurring chores.
  Scoping answers (Shawn, 2026-07-30): vision confirmed — The Nest
  was "always going to be a multi-module home… all if not most areas
  of our lives". Items live in Telegram/WhatsApp today (buried in
  scrollback, no state). Contents: everything household — errands,
  to-buy, to-plan, pay MCST, check on repair. Flat shared list, no
  assignment ("don't matter for 2 people"). Due dates: yes, and
  "notifications is good".
  Shape agreed in scoping (pending lock): **split in two ships.**
  Ship 1 = tab navigation (the multi-module skeleton: Money /
  To-dos / Ideas) + To-dos core: one-line dump at messaging speed,
  check off, optional due date shown + sorted, overdue highlighted
  in-app — no push yet. Ship 2 = **notifications platform**: iOS PWA
  Web Push (installed app only, iOS 16.4+, permission prompt; needs
  push-subscription storage + pg_cron + Edge Function sender) —
  deliberately a platform piece: the same plumbing later serves
  zero-touch capture's "pending to confirm" nudges. Adjacent notes:
  "pay MCST" is recurring — will eventually meet the parked
  recurring-payments registry; and since the household lives in
  Telegram, a future Telegram→Nest capture bridge is a natural lane
  (noted only, not scoped). Roadmap consequence to decide at lock:
  to-dos would step in front of zero-touch capture (still gated on
  alert fieldwork anyway).
- **Zero-touch capture** (reframed 2026-07-28 during v1.1 scoping —
  the root need behind the pre-launch "AI receipt parsing" earmark).
  Evidence note corrected 2026-07-29: it got zero idea-box raises
  *because both users assumed AI entry was already the next build* —
  the silence was anticipation, not absence of demand. Lesson for
  future triage: absence of raises only counts as evidence when users
  don't believe the thing is already promised. Shawn: "we want to
  avoid manual input as much as possible — based on incoming SMSs,
  transactions, or emails, pull the data directly instead of typing."
  Reality check, recorded so we don't re-litigate: a PWA — and iOS
  apps generally — cannot read SMS directly, so "the app watches my
  messages" is off the table. Workable paths: (a) bank *email* alerts
  auto-forwarded to a Supabase Edge Function that parses them into
  pending ledger entries awaiting one-tap confirm; (b) an iOS
  Shortcuts personal automation ("when a message containing X
  arrives") that posts the alert text to an Edge Function — per-phone
  setup, somewhat fragile, but real; (c) receipt-photo parsing — the
  original idea, weakest fit (still manual, still per-purchase).
  Alert texts are highly structured, so parsing is likely regex, not
  AI; any AI stays behind an Edge Function per the standing security
  rule. **Slated as the v1.2 headline** (direction agreed 2026-07-29;
  Shawn: v1.2 is this, v1.3 stays open). **Discovery runs during the
  v1.1 build, costs nothing:** for each real payment, note whether
  the alert that "pops up" is (a) an SMS, (b) an email, or (c) a
  bank-app push notification — and from which bank. The distinction
  is decisive: SMS and email are capturable (Shortcut / forwarding);
  app push notifications are sealed off by iOS and capturable by
  nothing. If most alerts turn out to be app pushes, the fix is
  usually enabling per-transaction email alerts in the bank's
  settings. Design sketch agreed in conversation 2026-07-29: shared
  spine = alert text → Edge Function parser (regex first, AI only if
  ever needed, server-side per standing rule) → RLS-protected
  `pending_expenses` pile → one-tap confirm in-app; **nothing ever
  auto-commits to the ledger**, and unparseable alerts surface as raw
  pending rows (fail visibly), never silently drop. Email path =
  Gmail auto-forward to the function (sturdy, per-account); SMS path
  = iOS Shortcuts message-trigger automation posting to the same
  function (per-phone, fragile). Existing duplicate warning covers
  alert-vs-manual overlap.
