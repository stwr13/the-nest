-- The Nest v1.14 — recurring commitments registry
-- Run once in the Supabase SQL Editor. Additive only: new table, one
-- nullable column on expenses, two RPCs; old rows and old clients keep
-- working.
--
-- The principle this whole shape protects: THE LEDGER MIRRORS MONEY
-- MOVEMENT. One row per actual charge, on the actual date, with the
-- actual payment mode. The registry never writes to the ledger by
-- itself and the ledger never derives from the registry — the only
-- bridge is a person tapping Confirm. Amortisation (a yearly premium
-- shown as a monthly figure) is a REGISTRY view and never reaches the
-- ledger, because the moment the ledger stops matching the bank
-- statement, reconciliation is dead.

begin;

-- One row per standing commitment: subscriptions, premiums, regular
-- investments, quarterly maintenance. amount = the expected charge in
-- SGD; it is updated on a confirm-with-edit, so last month's actual is
-- next month's prediction (an FX swing or a price rise gets typed once).
--
-- anchor_day is kept SEPARATE from next_due on purpose: a 31st-of-the-
-- month item must land on the 28th in February and return to the 31st
-- in March. Advancing next_due by "one month" alone would drift to the
-- 28th permanently.
--
-- end_date is what makes a commitment different from a subscription:
-- "$2,000/month until age 55" is a finite pile, and the registry can
-- say how much of it is left.
create table public.recurring (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  amount      numeric(10,2) not null check (amount > 0),
  cadence     text not null check (cadence in ('monthly', 'quarterly', 'yearly')),
  anchor_day  int  not null check (anchor_day between 1 and 31),
  next_due    date,
  end_date    date,
  category_id bigint not null references public.categories (id) on delete restrict,
  card_id     bigint references public.cards (id) on delete restrict,
  paid_by     text not null check (paid_by in ('Shawn', 'Claire')),
  active      boolean not null default true,
  last_confirmed date,
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  -- an active row must know when it is next due; a stopped one must not
  constraint active_has_due check ((active and next_due is not null)
                                   or (not active and next_due is null))
);

alter table public.recurring enable row level security;

-- shared household data, same posture as cards and todos: either
-- account manages the list. Deliberate — two people, one household.
create policy "household reads recurring"
  on public.recurring for select to authenticated using (true);
create policy "household adds recurring"
  on public.recurring for insert to authenticated with check (true);
create policy "household edits recurring"
  on public.recurring for update to authenticated using (true) with check (true);
create policy "household deletes recurring"
  on public.recurring for delete to authenticated using (true);

grant select, insert, update, delete on public.recurring to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Back-reference so a registry row can show "last confirmed 2 Oct" and
-- a ledger row can show it came from a commitment. on delete restrict:
-- a registry row with history is never deleted, only deactivated —
-- deleting it would orphan the expenses that point at it.
alter table public.expenses
  add column recurring_id bigint references public.recurring (id) on delete restrict;

-- ── date maths ──────────────────────────────────────────────────────
-- Re-anchors after each step: min(anchor_day, days in that month).
create or replace function public.recurring_next_due(
  from_due date, cadence text, anchor_day int
) returns date
language plpgsql immutable as $$
declare
  step interval;
  target date;
  dim int;
begin
  step := case cadence
            when 'monthly'   then interval '1 month'
            when 'quarterly' then interval '3 months'
            when 'yearly'    then interval '1 year'
          end;
  target := date_trunc('month', from_due + step)::date;
  dim := extract(day from (date_trunc('month', target) + interval '1 month - 1 day'));
  return target + (least(anchor_day, dim) - 1);
end;
$$;

-- ── confirm ─────────────────────────────────────────────────────────
-- ONE atomic call: write the expense, advance the schedule, and refuse
-- a second confirm of the same due date. The due strip is shared, so
-- without this guard both phones tapping Confirm at the same moment
-- would write the charge twice — the double-log trap the app already
-- works hard to avoid elsewhere.
--
-- p_expected_due pins the confirm to the due date the caller SAW. If it
-- has already moved on, someone else got there first and this call
-- writes nothing.
--
-- The expense is dated on the item's DUE date, never today: confirming
-- a week late must not misdate the charge, or the ledger stops agreeing
-- with the statement.
create or replace function public.confirm_recurring(
  p_id bigint, p_amount numeric, p_expected_due date
) returns bigint
language plpgsql security invoker as $$
declare
  r public.recurring%rowtype;
  new_expense_id bigint;
  following date;
begin
  select * into r from public.recurring where id = p_id for update;
  if not found then
    raise exception 'recurring item % not found', p_id;
  end if;
  if not r.active then
    raise exception 'recurring item % is not running', p_id;
  end if;
  if r.next_due is distinct from p_expected_due then
    raise exception 'already confirmed — % is now due %', r.name, r.next_due
      using errcode = 'serialization_failure';
  end if;

  insert into public.expenses (amount, category_id, paid_by, date, note, card_id, recurring_id)
  values (p_amount, r.category_id, r.paid_by, r.next_due, r.name, r.card_id, r.id)
  returning id into new_expense_id;

  following := public.recurring_next_due(r.next_due, r.cadence, r.anchor_day);

  -- past its end date, the commitment is complete: it stops rather than
  -- scheduling a payment that was never owed
  if r.end_date is not null and following > r.end_date then
    update public.recurring
       set active = false, next_due = null, last_confirmed = r.next_due, amount = p_amount
     where id = r.id;
  else
    update public.recurring
       set next_due = following, last_confirmed = r.next_due, amount = p_amount
     where id = r.id;
  end if;

  return new_expense_id;
end;
$$;

-- ── skip ────────────────────────────────────────────────────────────
-- Advance without writing an expense (a free month, or it was paid some
-- other way). Deliberately NOT the same thing as cancelling: the app
-- makes the caller choose, because a cancellation mistaken for a skip
-- returns as a phantom next month, while a skip mistaken for a
-- cancellation costs nothing — it can be switched back on.
create or replace function public.skip_recurring(
  p_id bigint, p_expected_due date
) returns date
language plpgsql security invoker as $$
declare
  r public.recurring%rowtype;
  following date;
begin
  select * into r from public.recurring where id = p_id for update;
  if not found or not r.active then
    raise exception 'recurring item % is not running', p_id;
  end if;
  if r.next_due is distinct from p_expected_due then
    raise exception 'already moved on — % is now due %', r.name, r.next_due
      using errcode = 'serialization_failure';
  end if;

  following := public.recurring_next_due(r.next_due, r.cadence, r.anchor_day);
  if r.end_date is not null and following > r.end_date then
    update public.recurring set active = false, next_due = null where id = r.id;
    return null;
  end if;
  update public.recurring set next_due = following where id = r.id;
  return following;
end;
$$;

grant execute on function public.confirm_recurring(bigint, numeric, date) to authenticated;
grant execute on function public.skip_recurring(bigint, date) to authenticated;
grant execute on function public.recurring_next_due(date, text, int) to authenticated;

commit;
