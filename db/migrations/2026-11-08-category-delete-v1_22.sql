-- The Nest v1.22 — two repairs found in the post-v1.21 review
-- Run once in the Supabase SQL Editor. Safe to re-run. No rows change.

begin;

-- 1. Deleting a category moves its Recurring items too.
-- Since v1.14, recurring.category_id points at categories with ON DELETE
-- RESTRICT, but this function only ever moved expenses. So deleting any
-- category that held a Recurring item failed with a foreign-key error,
-- and after the November merge that is most of them. Same narrow door as
-- before: either household account may empty one category into another
-- and delete it, nothing else.
create or replace function public.reassign_and_delete_category(from_id bigint, to_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if from_id = to_id then
    raise exception 'target category must differ';
  end if;
  if not exists (select 1 from public.categories where id = to_id) then
    raise exception 'target category does not exist';
  end if;
  update public.expenses  set category_id = to_id where category_id = from_id;
  update public.recurring set category_id = to_id where category_id = from_id;
  delete from public.categories where id = from_id;
end;
$$;

revoke all on function public.reassign_and_delete_category(bigint, bigint) from public, anon;
grant execute on function public.reassign_and_delete_category(bigint, bigint) to authenticated;

-- 2. Take back table rights the app never uses.
-- Supabase's defaults grant every table right to anon and authenticated
-- and leave row security to decide what each can see. RLS covers select,
-- insert, update and delete. It does not cover TRUNCATE, which empties a
-- table whatever the policies say. Nothing in the API can issue one
-- today, but nothing in the app needs it either, so it goes, along with
-- TRIGGER and REFERENCES. The future-table default changes with it, so a
-- new table doesn't bring them back.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;

commit;
