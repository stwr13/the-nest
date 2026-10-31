-- The Nest v1.18 — retiring a card without deleting it
-- Run once in the Supabase SQL Editor. Additive only.
--
-- A card the household stops using can't simply be deleted: past
-- entries point at it (expenses.card_id is on-delete-restrict, by
-- design — history must keep its card). Until now the only move was to
-- strip its cap and tags, which took it out of the advice but left its
-- face in the logging picker, one wrong tap away from a new entry.
--
-- retired = out of the picker and out of every recommendation, but
-- still attached to its old entries, still editable, and still shown
-- (last, dimmed) in the Cards area so it can be brought back.

begin;

alter table public.cards
  add column if not exists retired boolean not null default false;

-- the first one: the Lady's Solitaire's second bucket, retired in the
-- data on 2026-10-31 when the card converted to the standard Lady's
update public.cards set retired = true where name = 'UOB Solitaire · retired';

commit;
