# CLAUDE.md — The Nest: Build Standards

> Read this every session. These are standing rules for every feature built in this repo. They are not suggestions.

## Stack (non-negotiable)

- Vanilla HTML/CSS/JS only. No frameworks, no build tools, no npm dependencies in the shipped app.
- Supabase for auth and database (Postgres).
- GitHub Pages for hosting (public repo).

## Security standards — apply to every feature

- Row Level Security (RLS) on every table, deny-by-default. No table ships without a policy.
- Signups disabled in Supabase after the two household accounts exist.
- No secrets in client code, ever. The Supabase anon key is the only key that ships in the browser — it is designed to be public and is safe only because of RLS.
- No personal identifiers in the repo or client code — no email addresses, phone numbers, or real ledger data. The repo is public and GitHub Pages serves every client file to anyone; RLS protects rows, not facts printed in source. Personal data lives only in Supabase (auth metadata or RLS-protected tables). First names are the accepted exception.
- Any future AI feature calls a Supabase Edge Function; the browser never talks to an AI API directly and never holds an AI key.

## Interface standards

- Mobile-first. iPhone is the reference device (Shawn uses Chrome, which is WebKit on iOS — Safari rules apply identically); desktop is secondary.
- Installable PWA (manifest + service worker). Install path is the share-sheet → Add to Home Screen, from Safari or Chrome.
- Palette: green × pastel-pink blend — one household aesthetic for two people with different taste.
- Fail gracefully: when offline or a request fails, show a visible message ("No connection — entry not saved"). Never fail silently.

## Process standards

- Ship small; verify each feature on the phone before starting the next.
- Every session ends with working, deployed code. No half-built states on `main`.
- The spec (`SPEC.md`) is the scope contract. Anything not in it waits for the next version — usage, not imagination, earns the next decision.
- Every shipped step gets a dated JOURNEY.md entry (what shipped, what was decided, why) and, where practical, a snapshot in `docs/snapshots/`. Snapshots use sample data only — never real ledger amounts; the repo is public.
