-- The Nest v1.19 — the groundwork for Overview
-- Run once in the Supabase SQL Editor. Additive only: one new column with
-- a default, a wider cadence check, one new check, and a date function
-- that knows two more cadences. Older clients keep working against this
-- as long as no row uses a new cadence yet — their CADENCE_MONTHS doesn't
-- know them, so rows move to 'half-yearly' or 'once' only after both
-- phones have the new code.

begin;

-- What a category MEANS to the household's picture of a month. The app
-- classifies by this and never by a category's name or a note's text,
-- because either person can rename a category in the manager at any time.
--   everyday — the default: ordinary spending
--   lumpy    — always a one-off when not a commitment (trips)
--   invest   — money set aside, still ours
--   give     — money given away
alter table public.categories
  add column kind text not null default 'everyday'
  constraint categories_kind_check check (kind in ('everyday', 'lumpy', 'invest', 'give'));

-- Two more ways for a commitment to repeat. 'once' is a commitment with
-- exactly one charge left (the last of a short payment plan): it stays in
-- the registry so it shows on its date, but it is never a monthly cost.
alter table public.recurring drop constraint recurring_cadence_check;
alter table public.recurring
  add constraint recurring_cadence_check
  check (cadence in ('monthly', 'quarterly', 'half-yearly', 'yearly', 'once'));

-- A 'once' row must stop after one confirm. confirm_recurring only stops a
-- row when the next step passes end_date, so a running 'once' row without
-- end_date = next_due would quietly come back a year later. Enforced here
-- rather than trusted to every caller.
alter table public.recurring
  add constraint once_ends_when_due
  check (cadence <> 'once' or not active or end_date = next_due);

-- Mirrored by CADENCE_MONTHS in js/recurring-view.js (a test compares the
-- two). An unknown cadence gives a null step, a null next_due, and a
-- broken active_has_due inside confirm_recurring, so every value the check
-- above allows must have a step here.
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
            when 'monthly'     then interval '1 month'
            when 'quarterly'   then interval '3 months'
            when 'half-yearly' then interval '6 months'
            when 'yearly'      then interval '12 months'
            when 'once'        then interval '12 months'
          end;
  target := date_trunc('month', from_due + step)::date;
  dim := extract(day from (date_trunc('month', target) + interval '1 month - 1 day'));
  return target + (least(anchor_day, dim) - 1);
end;
$$;

commit;
