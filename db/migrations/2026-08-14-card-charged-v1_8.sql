-- The Nest v1.8 — "charged to card" split (additive)
-- Run once in the Supabase SQL Editor.
--
-- Group-bill reality (Shawn, 2026-08-14): amount = the household's
-- TRUE expense (your share, after friends pay you back); card_charged
-- = what actually hit the card (the full bill), null = same as amount.
-- Dashboards/categories count amount; card caps and miles count
-- card_charged, because the bank neither knows nor cares who PayNow'd
-- you back.

alter table public.expenses
  add column card_charged numeric(10,2) check (card_charged > 0);
