# Telegram reminders — setup (v1.12)

One daily message to the household chat: due-today + overdue to-dos.
Cloud-to-cloud (Supabase cron → Telegram API) — nothing runs on any of
our machines, no Telegram login is involved in sending. Silent on days
with nothing due.

Total hands-on time: ~10 minutes, all from the phone + one browser tab.

## 1. Create the bot (phone, ~2 min)

1. In Telegram, open **@BotFather** → send `/newbot`.
2. Name it (e.g. `The Nest`) and pick a username (e.g. `the_nest_xyz_bot`).
3. Copy the **token** it replies with (`123456:ABC-...`). That token is
   the bot's password — it goes into Supabase secrets ONLY, never into
   this repo, never into the app.

## 2. Get the chat id (~2 min)

1. Add the bot to the household group chat (Group → Add member).
2. Send any message in the group (e.g. "hello bot").
3. Open in a browser:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find `"chat":{"id":-100XXXXXXXXXX,...}` in the response — that
   (negative) number is the **chat id**. Copy it.

If the response is empty: Group settings → the bot → toggle it admin
briefly, send another message, reload. (Privacy mode hides group
messages from bots; getUpdates still shows the membership event either
way. Admin can be removed after — sending needs no admin.)

## 3. Deploy the function (browser, ~3 min)

1. Dashboard → **Edge Functions** → **Deploy a new function** → name it
   exactly `send-reminders`.
2. Paste the contents of `supabase/functions/send-reminders/index.ts`.
3. In the function's settings, turn **Verify JWT** **OFF** — the
   function gates itself with CRON_SECRET instead (the caller is our
   own cron job, not a logged-in user).
4. Edge Functions → **Secrets** → add three:
   - `TELEGRAM_BOT_TOKEN` — from step 1
   - `TELEGRAM_CHAT_ID` — from step 2
   - `CRON_SECRET` — any long random string (e.g. from a password
     generator). It only needs to match step 4's SQL.

## 4. Schedule it (browser, ~1 min)

1. SQL Editor → paste `db/migrations/2026-08-20-telegram-reminders-v1_12.sql`.
2. **Replace `<CRON-SECRET>` with the value from step 3** before running.
3. Run. `select * from cron.job;` should show `nest-telegram-reminders`
   at `0 1 * * *` (01:00 UTC = 09:00 SGT).

## 5. Test-fire (terminal or any HTTP client)

```
curl -s -X POST \
  -H "x-cron-secret: THE-SECRET" \
  https://jgenasvgeyyigfnkdvxu.supabase.co/functions/v1/send-reminders
```

- Something due → the group chat gets the digest, response `{"sent":true,...}`.
- Nothing due → `{"sent":false,"reason":"nothing due"}` and no message.
  (Add a to-do due today in the app to see a real send.)

## What it sends

```
🪺 The Nest — to-dos
‼️ Pay MCST — overdue 2 days
• Book dental — due today
```

`‼️` = the urgent flag. Sorted oldest due first. "Today" is computed in
Asia/Singapore inside the function.

## Security notes

- Bot token, chat id, cron secret: Supabase secret store only. The repo
  carries a `<CRON-SECRET>` placeholder by design.
- The function answers only to the matching `x-cron-secret` header —
  anyone else gets 403.
- Service-role access stays inside Supabase's infrastructure; the bot
  is outbound-only and reads nothing.

## Later lanes on this same plumbing

Zero-touch capture's "pending, tap to confirm" nudges · weekly money
digest · urgent to-buy pings. Each is a new query + message block in
the same function, or a sibling function on the same cron pattern.
