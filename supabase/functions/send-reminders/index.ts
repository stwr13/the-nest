// The Nest — send-reminders (v1.12, the first server-side piece)
//
// Runs daily via pg_cron (see db/migrations/2026-08-20-telegram-
// reminders-v1_12.sql): reads due-today + overdue to-dos and posts one
// digest to the household Telegram chat. Outbound only — the bot never
// reads anything. Silent when nothing is due: no "all clear" spam.
//
// Deploy: Dashboard → Edge Functions → New function → paste this.
// Turn "Verify JWT" OFF for this function — the gate is CRON_SECRET
// instead (the publishable key is not a JWT, and this endpoint should
// answer only to our cron anyway).
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN  — from @BotFather
//   TELEGRAM_CHAT_ID    — the household group chat id
//   TELEGRAM_TOPIC_ID   — optional: a topic's message_thread_id, to post
//                         into one topic of a forum-style group
//   CRON_SECRET         — any long random string; must match the cron SQL
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // the only caller is our own cron job — everyone else gets a wall
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  // service role: server-side trusted read, RLS doesn't apply here.
  // The key never leaves Supabase's own infrastructure.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // "today" in the household's timezone — the UTC server date would
  // flip due-dates a day early for most of the SG evening
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
  }).format(new Date());

  const { data: todos, error } = await supabase
    .from("todos")
    .select("body, due_date, urgent")
    .eq("list", "todo")
    .is("done_at", null)
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date");

  if (error) {
    // fail visibly (function logs), never silently
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!todos || todos.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: "nothing due" }), { status: 200 });
  }

  const days = (due: string) =>
    Math.round((Date.parse(today) - Date.parse(due)) / 86400000);
  const line = (t: { body: string; due_date: string; urgent: boolean }) => {
    const d = days(t.due_date);
    const when = d === 0 ? "due today" : d === 1 ? "overdue 1 day" : `overdue ${d} days`;
    return `${t.urgent ? "‼️" : "•"} ${t.body} — ${when}`;
  };

  // Telegram caps messages at 4096 chars — a household list will never
  // get there, but truncating beats a failed send if it somehow does
  const text = `🪺 The Nest — to-dos\n${todos.map(line).join("\n")}`.slice(0, 4000);

  const tg = await fetch(
    `https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // plain text, no parse_mode: to-do bodies are user input and must
      // never be interpreted as markup (same rule as textContent in-app)
      body: JSON.stringify({
        chat_id: Deno.env.get("TELEGRAM_CHAT_ID"),
        // optional topic targeting — absent secret = plain group post
        ...(Deno.env.get("TELEGRAM_TOPIC_ID")
          ? { message_thread_id: Number(Deno.env.get("TELEGRAM_TOPIC_ID")) }
          : {}),
        text,
      }),
    },
  );

  if (!tg.ok) {
    const detail = await tg.text();
    return new Response(JSON.stringify({ error: `telegram ${tg.status}: ${detail}` }), { status: 500 });
  }
  return new Response(JSON.stringify({ sent: true, items: todos.length }), { status: 200 });
});
