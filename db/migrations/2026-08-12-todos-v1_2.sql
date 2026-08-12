-- The Nest v1.2 ship 1 — shared to-dos
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Wrapped in a transaction: if any statement fails, nothing is applied.
-- Additive only: no existing table is touched.

begin;

-- One household list. author / done_by are display-name strings (same
-- convention as ideas.author): names are fine inside the private,
-- RLS-protected database — the public repo is what they stay out of.
create table public.todos (
  id         bigint generated always as identity primary key,
  body       text not null check (char_length(trim(body)) between 1 and 200),
  due_date   date,
  author     text not null,
  done_at    timestamptz,
  done_by    text,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

-- Deliberate deviation from the expenses own-rows-only precedent:
-- completing (and clearing) the OTHER person's item is the core loop of
-- a shared list — "pay MCST" added by one of us is usually done by the
-- other. Household-wide update/delete is the point, not a hole.
create policy "household reads todos"
  on public.todos for select to authenticated
  using (true);

create policy "insert own todos"
  on public.todos for insert to authenticated
  with check (created_by = auth.uid());

create policy "household updates todos"
  on public.todos for update to authenticated
  using (true) with check (true);

create policy "household deletes todos"
  on public.todos for delete to authenticated
  using (true);

grant select, insert, update, delete on public.todos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

commit;
