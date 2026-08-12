-- The Nest v1.3 — shopping list (To-buy tab)
-- Run once in the Supabase SQL Editor. Additive only: one discriminator
-- column with a default, so every existing row stays a plain to-do and
-- older clients keep working (they select specific columns and treat
-- everything as the to-do list).

alter table public.todos
  add column list text not null default 'todo'
    check (list in ('todo', 'shopping'));
