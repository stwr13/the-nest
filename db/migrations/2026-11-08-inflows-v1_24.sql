-- The Nest v1.24 — money in
-- Run once in the Supabase SQL Editor. Additive only: a new table,
-- nothing existing changes.
--
-- Why: the app knows what goes out, but only roughly that income is
-- higher, so it can't say what the household keeps each month. Each
-- inflow is logged as it lands; a month's In is the sum.
--
-- `whose` is a tag for the list, never a per-person total. 'Both' is for
-- money given to the household or a joint dividend. Only salary is
-- marked (`kind`), so a later projection can lean on the steady part;
-- dividends, payouts and gifts are 'other' with a note.
--
-- Same posture as expenses: the household reads every row, and each
-- person adds, edits and deletes their own.
--
-- Undo (drops every inflow; take a CSV of the table first):
--   drop table public.inflows;

begin;

create table public.inflows (
  id         bigint generated always as identity primary key,
  amount     numeric(12, 2) not null check (amount > 0),
  date       date not null,
  whose      text not null check (whose in ('Shawn', 'Claire', 'Both')),
  kind       text not null default 'other' check (kind in ('salary', 'other')),
  note       text check (char_length(note) <= 200),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index inflows_date_idx on public.inflows (date);

alter table public.inflows enable row level security;

create policy "household reads inflows"
  on public.inflows for select to authenticated using (true);
create policy "own inflows are added"
  on public.inflows for insert to authenticated
  with check (created_by = auth.uid());
create policy "own inflows are edited"
  on public.inflows for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "own inflows are deleted"
  on public.inflows for delete to authenticated
  using (created_by = auth.uid());

-- Signed-in users get the four rights the policies govern, and nothing
-- else (v1.22). Logged-out users get nothing.
revoke all on public.inflows from anon, authenticated;
grant select, insert, update, delete on public.inflows to authenticated;

commit;
