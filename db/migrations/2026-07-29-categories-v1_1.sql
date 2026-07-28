-- v1.1 category system — additive only (rollback-safe per SPEC.md):
-- two new columns on categories, icons for the existing six, four new
-- rows (Blessing excluded from totals), Other re-sorted to last.
-- Idempotent: safe to run twice. Run in the Supabase SQL Editor.
-- v1.0 code keeps working against this schema (it ignores new columns;
-- new categories simply appear in its dropdown).

begin;

alter table public.categories
  add column if not exists icon text check (char_length(icon) <= 8);
alter table public.categories
  add column if not exists excluded_from_totals boolean not null default false;

update public.categories set icon = '🛒' where name = 'Groceries'   and icon is null;
update public.categories set icon = '🍜' where name = 'Eating out'  and icon is null;
update public.categories set icon = '🚌' where name = 'Transport'   and icon is null;
update public.categories set icon = '🏠' where name = 'Home'        and icon is null;
update public.categories set icon = '🎉' where name = 'Fun'         and icon is null;
update public.categories set icon = '📦' where name = 'Other'       and icon is null;

insert into public.categories (name, sort_order, icon) values
  ('Gifts',    6, '🎁'),
  ('Wellness', 7, '💆'),
  ('Learning', 8, '📚')
on conflict (name) do nothing;

insert into public.categories (name, sort_order, icon, excluded_from_totals) values
  ('Blessing', 9, '🙏', true)
on conflict (name) do nothing;

update public.categories set sort_order = 10 where name = 'Other';

commit;
