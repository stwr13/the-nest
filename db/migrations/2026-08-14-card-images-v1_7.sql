-- The Nest v1.7 — real card images from private Storage (additive)
-- Run once in the Supabase SQL Editor.
--
-- The images live in a PRIVATE storage bucket ("cards"), never in the
-- public repo — bank card art is copyrighted; keeping it household-only
-- behind auth is personal use, committing it to GitHub would be
-- republishing. The app loads them via short-lived signed URLs.

begin;

alter table public.cards
  add column image text; -- object path inside the "cards" bucket

insert into storage.buckets (id, name, public)
values ('cards', 'cards', false)
on conflict (id) do nothing;

-- household reads; uploads happen via the dashboard (owner), so no
-- insert/update policies for the app roles
create policy "household reads card images"
  on storage.objects for select to authenticated
  using (bucket_id = 'cards');

commit;
