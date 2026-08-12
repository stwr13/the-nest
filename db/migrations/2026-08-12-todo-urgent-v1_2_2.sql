-- The Nest v1.2.2 — urgent flag on to-dos
-- Run once in the Supabase SQL Editor. Additive only: one new column
-- with a default, so existing rows and older clients keep working.

alter table public.todos
  add column urgent boolean not null default false;
