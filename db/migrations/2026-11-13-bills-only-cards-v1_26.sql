-- The Nest v1.26 — a bills-only tick on a card
-- Run once in the Supabase SQL Editor, BEFORE v1.26 goes live: the new
-- app reads this column. Additive only, safe to re-run. No rows change:
-- every card starts un-ticked, and which card gets the tick is a tap in
-- the card editor, not SQL.
-- Run against production and verified on 2026-11-13.
--
-- An account that only ever pays standing charges (a loan repayment
-- account, say) is not retired, but its tile in the logging picker is
-- one wrong tap from a new entry. bills_only = out of the logging
-- picker and out of the "which card" advice; still offered for
-- Recurring items, still confirmed from Due now, still shown in the
-- Cards area (not dimmed), still attached to its old entries.
--
-- Older app versions never ask for the column, so they carry on
-- unchanged while both phones catch up.
--
-- Undo (drops every tick; put the app back on v1.25 first, because
-- v1.26 asks for the column on every load):
--   alter table public.cards drop column if exists bills_only;

begin;

alter table public.cards
  add column if not exists bills_only boolean not null default false;

commit;

-- Check afterwards (run ad hoc):
--   select count(*) as cards, count(*) filter (where bills_only) as ticked
--   from public.cards;
