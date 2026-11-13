-- The Nest v1.26 — a monthly backup inside Supabase
-- Run once in the Supabase SQL Editor. Safe to re-run. No app change,
-- and no row in any app table changes: this only ever adds copies.
-- Run against production and verified on 2026-11-13; the first copy was
-- taken by hand the same day.
--
-- What it does: on the 1st of each month a scheduled job copies every
-- table in `public` into the `snapshots` schema, one dated table each
-- (expenses_2026_12_01, cards_2026_12_01, ...), the same naming the
-- hand-made snapshots there already use. It never prunes, replaces or
-- deletes anything: a table that already exists for that date is left
-- alone and skipped.
--
-- It copies whatever tables `public` holds on the day, so a table added
-- in a later version is covered without anyone remembering to list it.
--
-- Who can reach the copies: nobody through the app. `snapshots` is not
-- an API schema and no app role has rights on it; each new table also
-- gets row security switched on with no policy, and rights taken back
-- from the app roles, so it stays closed even if the schema were ever
-- opened by mistake. No key or password is stored anywhere: the job
-- runs inside the database as its owner.
--
-- Function rights (repo rule, CLAUDE.md): execute is revoked from
-- public and anon. It is revoked from authenticated too, a step past
-- the rule, because nothing in the app calls it. search_path is pinned
-- empty and every name is written out in full.
--
-- pg_cron was not enabled before this (checked 2026-11-13: the v1.12
-- Telegram migration planned a job, but it was never run). The schedule
-- is in UTC: 00:10 UTC on the 1st = 08:10 on the 1st in Singapore.
--
-- Limits worth knowing: a job missed while the project is paused is not
-- caught up (run the function by hand, see below); and the copies live
-- in the same database as the originals, so they guard against a bad
-- edit or a bad migration, not against losing the whole project.
--
-- Undo (stops the schedule and removes the function; every snapshot
-- table already made is kept):
--   select cron.unschedule('nest-monthly-snapshot');
--   drop function if exists snapshots.take_snapshot(text);
--   -- optional, only if nothing else is scheduled:
--   -- drop extension if exists pg_cron;

begin;

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists snapshots;

-- p_label is the date part of the table names. Left empty it is today's
-- date in Singapore. Returns one line per table: copied or skipped.
create or replace function snapshots.take_snapshot(p_label text default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_label  text := coalesce(p_label, to_char(now() at time zone 'Asia/Singapore', 'YYYY_MM_DD'));
  v_source text;
  v_target text;
  v_rows   bigint;
  v_report text := '';
begin
  if v_label !~ '^[0-9a-z_]{1,24}$' then
    raise exception 'snapshot label must be lower-case letters, digits or underscores, got: %', v_label;
  end if;

  for v_source in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    v_target := v_source || '_' || v_label;

    -- never replace a copy that is already there
    if pg_catalog.to_regclass(pg_catalog.format('snapshots.%I', v_target)) is not null then
      v_report := v_report || v_target || ': already there, left alone' || E'\n';
      continue;
    end if;

    execute pg_catalog.format('create table snapshots.%I as table public.%I', v_target, v_source);
    get diagnostics v_rows = row_count;
    execute pg_catalog.format('alter table snapshots.%I enable row level security', v_target);
    execute pg_catalog.format('revoke all on table snapshots.%I from public, anon, authenticated', v_target);

    v_report := v_report || v_target || ': ' || v_rows || ' rows' || E'\n';
  end loop;

  return v_report;
end;
$$;

revoke execute on function snapshots.take_snapshot(text) from public, anon, authenticated;

-- Scheduling under a name that exists replaces that job, so a re-run of
-- this file leaves one job, not two.
select cron.schedule(
  'nest-monthly-snapshot',
  '10 0 1 * *',
  $$select snapshots.take_snapshot();$$
);

commit;

-- Useful afterwards (run ad hoc, not part of the migration):
--   select snapshots.take_snapshot();                        -- take one now
--   select jobname, schedule, command, active from cron.job; -- see the schedule
--   select status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 5;
--   select c.relname, c.relrowsecurity                       -- what is in there
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'snapshots' and c.relkind = 'r' order by 1;
