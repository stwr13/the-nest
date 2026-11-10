-- The Nest: close three functions to logged-out callers
-- Run once in the Supabase SQL Editor. Safe to re-run. No rows change.
-- Run against production and verified on 2026-11-10.
--
-- Found in the 2026-11-10 security review. Nothing was exposed: the two
-- functions that write were already stopped at the table grants, and the
-- third only does date arithmetic. This moves the refusal to the function
-- itself, so the tables are no longer the only thing in the way.
--
-- Undo:
--   begin;
--   grant execute on function public.confirm_recurring(bigint, numeric, date) to public;
--   grant execute on function public.skip_recurring(bigint, date)             to public;
--   grant execute on function public.recurring_next_due(date, text, int)      to public;
--   alter function public.confirm_recurring(bigint, numeric, date) reset search_path;
--   alter function public.skip_recurring(bigint, date)             reset search_path;
--   alter function public.recurring_next_due(date, text, int)      reset search_path;
--   commit;

begin;

-- 1. Only signed-in users may call these. Postgres gives every new
-- function to PUBLIC by default; the v1.14 migration never took it back.
revoke execute on function public.confirm_recurring(bigint, numeric, date) from public, anon;
revoke execute on function public.skip_recurring(bigint, date)             from public, anon;
revoke execute on function public.recurring_next_due(date, text, int)      from public, anon;

grant execute on function public.confirm_recurring(bigint, numeric, date) to authenticated;
grant execute on function public.skip_recurring(bigint, date)             to authenticated;
grant execute on function public.recurring_next_due(date, text, int)      to authenticated;

-- 2. Pin where each function looks up names, same as
-- reassign_and_delete_category already does.
alter function public.confirm_recurring(bigint, numeric, date) set search_path = public;
alter function public.skip_recurring(bigint, date)             set search_path = public;
alter function public.recurring_next_due(date, text, int)      set search_path = public;

commit;
