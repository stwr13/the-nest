-- v1.1 piece 2b — delete-via-reassign needs to move BOTH users' rows;
-- the expenses RLS policy (update own only) rightly blocks that from
-- the client. This SECURITY DEFINER function is the one narrow door:
-- either household account may move a category's expenses to another
-- category and delete the emptied category — nothing else. Safe to
-- re-run (create or replace). Run in the Supabase SQL Editor.

begin;

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
  update public.expenses set category_id = to_id where category_id = from_id;
  delete from public.categories where id = from_id;
end;
$$;

revoke all on function public.reassign_and_delete_category(bigint, bigint) from public, anon;
grant execute on function public.reassign_and_delete_category(bigint, bigint) to authenticated;

commit;
