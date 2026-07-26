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
- **Consolidated multi-item entry / calculator** (new, Shawn 07-23).
  Food-court case: drink + meal + snack as one log instead of three.
  Smallest shape: the amount field accepts arithmetic ("3.5+6+2").
  Bigger shape: true itemised entry — likely over-engineering at this
  stage.
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
- **AI receipt parsing** (earmarked pre-launch as the v1.1 bet,
  SPEC.md: Edge Function only, browser never holds an AI key; **zero
  live-use raises** during the trial). The itch users actually logged
  is organisation — categories, layout, filtering — not entry
  automation. Competes from behind on evidence.
