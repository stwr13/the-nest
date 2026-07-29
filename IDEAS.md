# IDEAS.md — candidates for after v1.0

Not commitments. Two weeks of real use decides what earns a place
(SPEC.md rule). This file is the curated backlog; the raw inbox is the
in-app idea box (`ideas` table). Harvested 2026-07-26: 11 captures,
2026-07-17 → 07-26, both authors — Claude now drives the SQL editor
through Chrome directly (Claude in Chrome extension), so future
harvests need no copy-paste.

Ordered by evidence strength: live-use raises beat pre-launch
speculation.

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
  grouping (a variant of collapsible month groups). Root need
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
  manager). New categories append after Other; there's no in-app way
  to reorder. Wart, not blocker — a one-line SQL fixes any specific
  ordering on request. Earns a manager feature only if reordering
  requests become a pattern.
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
  settings.
