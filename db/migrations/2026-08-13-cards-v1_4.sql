-- The Nest v1.4 — cards + miles-cap tracking
-- Run once in the Supabase SQL Editor. Additive only: new table + one
-- nullable column on expenses; old rows and old clients keep working.

begin;

-- Household card list, managed in-app like categories. cap = the
-- monthly bonus-earn ceiling in SGD (null = no cap, e.g. PayNow);
-- note = the earn rule at a glance ("4mpd online only"). Card names
-- live only in the RLS-protected database, never in the repo.
create table public.cards (
  id         bigint generated always as identity primary key,
  name       text not null unique check (char_length(trim(name)) between 1 and 40),
  cap        numeric(10,2) check (cap > 0),
  note       text check (char_length(note) <= 120),
  sort_order int not null default 0
);

alter table public.cards enable row level security;

-- shared household data — either account manages the list
create policy "household reads cards"
  on public.cards for select to authenticated
  using (true);

create policy "household adds cards"
  on public.cards for insert to authenticated
  with check (true);

create policy "household edits cards"
  on public.cards for update to authenticated
  using (true) with check (true);

create policy "household deletes cards"
  on public.cards for delete to authenticated
  using (true);

grant select, insert, update, delete on public.cards to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- nullable: pre-v1.4 entries stay "unspecified" (clean-start decision,
-- 2026-08-13); on delete restrict so a card with history can't vanish.
alter table public.expenses
  add column card_id bigint references public.cards (id) on delete restrict;

-- seed the one universal non-card "card" so the required form select
-- works from the first launch
insert into public.cards (name, sort_order) values ('PayNow / transfer', 1);

commit;
