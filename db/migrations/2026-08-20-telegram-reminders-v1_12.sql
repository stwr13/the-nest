-- The Nest v1.12 — Telegram reminders: the daily cron
-- Run once in the Supabase SQL Editor AFTER the send-reminders Edge
-- Function is deployed and its secrets are set (docs/telegram-reminders.md
-- is the step-by-step).
--
-- ⚠️ REPLACE <CRON-SECRET> below with the same value you stored as the
-- function's CRON_SECRET before running. The placeholder is deliberate:
-- this file lives in a public repo — the real secret must only ever
-- exist in the SQL editor session and the function's secret store.
--
-- Schedule is UTC: 01:00 UTC = 09:00 Singapore.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nest-telegram-reminders',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://jgenasvgeyyigfnkdvxu.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON-SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

commit;

-- Useful afterwards (run ad hoc, not part of the migration):
--   select * from cron.job;                                  -- see the schedule
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select cron.unschedule('nest-telegram-reminders');       -- turn it off
