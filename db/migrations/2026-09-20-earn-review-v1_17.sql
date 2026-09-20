-- The Nest v1.17 — an expiry date on card earn rules
-- Run once in the Supabase SQL Editor. Additive only.
--
-- The problem this fixes is staleness, not storage. Some cards let you
-- CHOOSE your bonus categories each quarter (UOB Lady's Solitaire).
-- The app has always been able to hold the current rule — earn_types
-- plus note — but nothing made it obvious when that rule had aged out.
-- A card whose Q4 categories are still recommended in Q1 is
-- confidently wrong, silently, for three months: no error, no flag,
-- just bad advice. Miles are lost without anything looking broken.
--
-- Deliberately NOT built: a per-period earn-rules table with
-- valid_from / valid_to and a rate per category. That models the
-- history of rules, and the history has exactly one reader — nobody is
-- ever going to ask which card was best last July. The only rule that
-- matters is the one in force right now; what it needed was an expiry,
-- not a timeline.
--
-- Who owns the rule stays the household, per the v1.5 decision
-- recorded in cards-math.js: the app ranks and does cap math, and
-- never claims to know a bank's terms. A wrong rule entered by the
-- bank's customer is a mistake; a wrong rule asserted by the app is a
-- betrayal of the one thing it is trusted for.

begin;

-- 120 characters could hold "4mpd online only" but not a real
-- condition — "10 mpd on dining + family, min $800/mo, excludes
-- utilities and insurance" is already over. Widened, not unbounded.
alter table public.cards
  drop constraint if exists cards_note_check;

alter table public.cards
  add constraint cards_note_check check (char_length(note) <= 500);

-- null = the rule does not expire (a card whose earn structure is
-- fixed). A date = "confirmed good until here", after which the app
-- flags it rather than trusting it.
alter table public.cards
  add column if not exists earn_review_date date;

commit;
