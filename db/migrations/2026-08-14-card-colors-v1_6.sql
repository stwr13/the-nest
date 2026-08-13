-- The Nest v1.6 — card colour for the mini-card art (additive)
-- Run once in the Supabase SQL Editor. The colour drives a CSS-drawn
-- card thumbnail; null falls back to the house green.

alter table public.cards
  add column color text check (color ~ '^#[0-9a-fA-F]{6}$');
