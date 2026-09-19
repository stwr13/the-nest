-- The Nest v1.15 — "Coming up" + the wishlist
-- Run once in the Supabase SQL Editor. Additive only.
--
-- Two things, one migration, because they answer the same vision line
-- ("shared calendar, things we want to do"):
--
-- 1. `events` — the only genuinely new data. Deliberately thin: a
--    title, a day, an optional time. NO recurrence rules, no invites,
--    no reminders, no external sync. The Coming-up view is not trying
--    to be a calendar — a calendar holds your dentist appointment and
--    Google already does that better on both phones. This holds what
--    the HOUSEHOLD jointly needs to see, which Google structurally
--    cannot assemble because it knows nothing about the money or the
--    lists. If it ever grows recurrence, that is the signal it drifted
--    into being a worse Google Calendar.
--
-- 2. a third value on todos.list — the wishlist. Things we want to do
--    (a restaurant, a trip, a place) are not tasks: they have no
--    deadline and are never overdue. But they are structurally the
--    same row as a to-do, so they reuse the machinery rather than
--    earning a table.

begin;

-- ── 1. shared events ────────────────────────────────────────────────
create table public.events (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(trim(title)) between 1 and 120),
  date       date not null,
  -- null = an all-day thing ("Sarah's wedding"); a time makes it a
  -- moment ("dinner, 7pm"). Both are common, neither is the default.
  at_time    time,
  note       text check (char_length(note) <= 200),
  author     text not null check (author in ('Shawn', 'Claire')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index events_date_idx on public.events (date);

alter table public.events enable row level security;

-- shared household data, same posture as todos, cards and recurring
create policy "household reads events"
  on public.events for select to authenticated using (true);
create policy "household adds events"
  on public.events for insert to authenticated with check (true);
create policy "household edits events"
  on public.events for update to authenticated using (true) with check (true);
create policy "household deletes events"
  on public.events for delete to authenticated using (true);

grant select, insert, update, delete on public.events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── 2. the wishlist joins the list discriminator ────────────────────
-- Widening a check constraint: drop and re-add is the only way, and it
-- is safe here because every existing row holds 'todo' or 'shopping',
-- both of which the new constraint still admits.
alter table public.todos
  drop constraint if exists todos_list_check;

alter table public.todos
  add constraint todos_list_check check (list in ('todo', 'shopping', 'wish'));

commit;
