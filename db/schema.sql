-- The Nest v1.0 — schema + RLS
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Wrapped in a transaction: if any statement fails, nothing is applied.

begin;

-- ── categories ──────────────────────────────────────────────────────
create table public.categories (
  id         bigint generated always as identity primary key,
  name       text   not null unique check (char_length(trim(name)) between 1 and 40),
  sort_order int    not null default 0
);

-- ── expenses ────────────────────────────────────────────────────────
create table public.expenses (
  id          bigint generated always as identity primary key,
  amount      numeric(10,2) not null check (amount > 0),
  category_id bigint not null references public.categories (id) on delete restrict,
  paid_by     text   not null check (paid_by in ('Shawn', 'Claire')),
  date        date   not null default ((now() at time zone 'Asia/Singapore')::date),
  note        text   check (char_length(note) <= 200),
  created_by  uuid   not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);

-- ledger is always read newest-first
create index expenses_date_idx on public.expenses (date desc);

-- ── Layer 1: table privileges ───────────────────────────────────────
-- This project grants the API roles nothing by default. Only
-- authenticated gets table access; anon is never granted anything —
-- a stranger holding the publishable key is refused before RLS is
-- even consulted.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
-- identity columns draw ids from sequences; inserts need this
grant usage, select on all sequences in schema public to authenticated;

-- ── Layer 2: Row Level Security — deny-by-default ───────────────────
-- Enabling RLS with no policies blocks ALL access; each policy below
-- re-opens exactly one narrow door, for authenticated users only.
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;

-- categories: shared household data — either account manages the list
create policy "household reads categories"
  on public.categories for select to authenticated
  using (true);

create policy "household adds categories"
  on public.categories for insert to authenticated
  with check (true);

create policy "household edits categories"
  on public.categories for update to authenticated
  using (true) with check (true);

create policy "household deletes categories"
  on public.categories for delete to authenticated
  using (true);

-- expenses: both accounts read everything; edit/delete only your own
create policy "household reads all expenses"
  on public.expenses for select to authenticated
  using (true);

create policy "insert own expenses"
  on public.expenses for insert to authenticated
  with check (created_by = auth.uid());

create policy "update own expenses"
  on public.expenses for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "delete own expenses"
  on public.expenses for delete to authenticated
  using (created_by = auth.uid());

-- ── placeholder categories (final list to be decided at home) ───────
insert into public.categories (name, sort_order) values
  ('Groceries',  1),
  ('Eating out', 2),
  ('Transport',  3),
  ('Home',       4),
  ('Fun',        5),
  ('Other',      6);

commit;
