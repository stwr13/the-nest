# SPEC.md — The Nest v1.0

**One ledger, two people, joint money — visibility, not budgets.**

Working title: The Nest (rename later is cheap). Currency: SGD. Users: Shawn and Claire, exactly two accounts.

## Features — six, nothing else

1. **Log an expense** — amount (SGD), category, date (default today), who paid, optional note. Under 10 seconds on a phone.
2. **Shared ledger** — reverse-chronological list, both users see everything; edit/delete your own entries.
3. **Monthly dashboard** — this month's total, split by category, simple month-vs-last-month comparison. Z-pattern layout: headline number top-left.
4. **Duplicate warning** — same amount within ±1 day prompts "possible duplicate — save anyway?" Warns, never blocks.
5. **Two-account auth** — email + password via Supabase; signups closed after both accounts exist.
6. **CSV export** — one button, full ledger download. This is the backup story.

## Data model

- `expenses`: amount, category_id, paid_by, date, note, created_by
- `categories`: name, sort order — editable in-app, seeded with placeholders (final list to be defined together at home)

## Known limitations (recorded, not fixed)

- Supabase free tier pauses after ~7 days of inactivity — daily use keeps it alive; unpause manually in the console if it happens.
- No offline entry: a failed save shows a visible error, nothing is queued.
- Single currency (SGD).
- The ledger view shows the most recent 1000 entries (API page cap); CSV export always contains the full history.
- iOS PWA installs via the share-sheet → Add to Home Screen (Safari or Chrome; both use WebKit on iOS).

## Out of scope for v1.0

AI parsing/Q&A (v1.1 via Edge Function), income tracking, recurring expenses, card/miles tagging, budgets, and every other Shared Brain module. Two weeks of real use decides what earns a place next.
