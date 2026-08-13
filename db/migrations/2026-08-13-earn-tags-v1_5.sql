-- The Nest v1.5 — earn tags on cards (the "which card at this shop?" data)
-- Run once in the Supabase SQL Editor. Additive only.

alter table public.cards
  add column earn_types text[] not null default '{}';
