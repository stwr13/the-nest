# JOURNEY.md — how The Nest got built

One dated entry per shipped step: what shipped, what was decided, and
why. Screenshots live in `docs/snapshots/` — **sample data only, never
real ledger amounts** (this repo is public). Raw material for a future
"how we iterated" deck.

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
